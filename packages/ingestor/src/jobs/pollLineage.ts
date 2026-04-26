import { sql } from "drizzle-orm";
import {
  listTables,
  getTableLineage,
  type OmClient,
  type LineageGraph,
  type Table,
} from "@causalops/om-client";
import type { Db } from "../db/client.js";
import {
  entities,
  lineageEdges,
  type NewEntity,
  type NewLineageEdge,
} from "../db/schema.js";
import { eventsTotal, errorsTotal } from "../metrics.js";
import { logger } from "../logger.js";

const BATCH = 500;

const tableToEntityRow = (t: Table): NewEntity => ({
  fqn: t.fullyQualifiedName,
  entityType: "table",
  name: t.name,
  service: t.fullyQualifiedName.split(".")[0] ?? null,
  ownerFqn: t.owner?.name ?? null,
  tags: (t.tags ?? []) as unknown[],
  raw: t as unknown as Record<string, unknown>,
  updatedAt: new Date(),
});

const upsertEntities = async (db: Db, rows: NewEntity[]): Promise<void> => {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db
      .insert(entities)
      .values(batch)
      .onConflictDoUpdate({
        target: entities.fqn,
        set: {
          entityType: sql`EXCLUDED.entity_type`,
          name: sql`EXCLUDED.name`,
          service: sql`EXCLUDED.service`,
          ownerFqn: sql`EXCLUDED.owner_fqn`,
          tags: sql`EXCLUDED.tags`,
          raw: sql`EXCLUDED.raw`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      });
  }
};

const edgesFromGraph = (graph: LineageGraph): NewLineageEdge[] => {
  const now = new Date();
  const rows: NewLineageEdge[] = [];
  const rootFqn = graph.entity.fullyQualifiedName;
  const byId = new Map<string, string>();
  byId.set(graph.entity.id, rootFqn);
  for (const n of graph.nodes) byId.set(n.id, n.fullyQualifiedName);

  const emit = (fromId: string, toId: string, sqlQuery?: string): void => {
    const fromFqn = byId.get(fromId);
    const toFqn = byId.get(toId);
    if (!fromFqn || !toFqn) return;
    rows.push({
      fromFqn,
      toFqn,
      fromColumn: null,
      toColumn: null,
      transformation: sqlQuery ?? null,
      discoveredAt: now,
    });
  };

  const emitColumn = (
    fromId: string,
    toId: string,
    fromColumn: string,
    toColumn: string,
  ): void => {
    const fromFqn = byId.get(fromId);
    const toFqn = byId.get(toId);
    if (!fromFqn || !toFqn) return;
    rows.push({
      fromFqn,
      toFqn,
      fromColumn,
      toColumn,
      transformation: null,
      discoveredAt: now,
    });
  };

  for (const e of graph.upstreamEdges) {
    emit(e.fromEntity, e.toEntity, e.lineageDetails?.sqlQuery);
    for (const cl of e.lineageDetails?.columnsLineage ?? []) {
      const toCol = cl.toColumn;
      if (!toCol) continue;
      for (const fc of cl.fromColumns ?? []) {
        emitColumn(e.fromEntity, e.toEntity, fc, toCol);
      }
    }
  }
  for (const e of graph.downstreamEdges) {
    emit(e.fromEntity, e.toEntity, e.lineageDetails?.sqlQuery);
    for (const cl of e.lineageDetails?.columnsLineage ?? []) {
      const toCol = cl.toColumn;
      if (!toCol) continue;
      for (const fc of cl.fromColumns ?? []) {
        emitColumn(e.fromEntity, e.toEntity, fc, toCol);
      }
    }
  }
  return rows;
};

const upsertEdges = async (
  db: Db,
  rows: NewLineageEdge[],
): Promise<number> => {
  if (rows.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.insert(lineageEdges).values(batch).onConflictDoNothing();
    written += batch.length;
  }
  return written;
};

export interface PollLineageResult {
  entitiesUpserted: number;
  edgesUpserted: number;
}

/** Full sweep: list tables, fetch depth-3 lineage, upsert entities + edges. */
export const pollLineage = async (
  db: Db,
  client: OmClient,
): Promise<PollLineageResult> => {
  try {
    const tables: Table[] = [];
    let after: string | undefined;
    // paginated list
    for (;;) {
      const page = await listTables(
        client,
        after ? { limit: 100, after } : { limit: 100 },
      );
      tables.push(...page.data);
      if (!page.paging?.after) break;
      after = page.paging.after;
    }

    await upsertEntities(db, tables.map(tableToEntityRow));
    eventsTotal.inc({ stream: "entities" }, tables.length);

    const allEdges: NewLineageEdge[] = [];
    for (const t of tables) {
      try {
        const graph = await getTableLineage(client, t.fullyQualifiedName, {
          upstreamDepth: 3,
          downstreamDepth: 3,
        });
        allEdges.push(...edgesFromGraph(graph));
      } catch (err) {
        errorsTotal.inc({ stream: "lineage" });
        logger.warn({ err, fqn: t.fullyQualifiedName }, "lineage fetch failed");
      }
    }
    const written = await upsertEdges(db, allEdges);
    eventsTotal.inc({ stream: "lineage" }, written);

    logger.info(
      { entities: tables.length, edges: written },
      "pollLineage: ok",
    );
    return { entitiesUpserted: tables.length, edgesUpserted: written };
  } catch (err) {
    errorsTotal.inc({ stream: "lineage" });
    logger.error({ err }, "pollLineage failed");
    throw err;
  }
};
