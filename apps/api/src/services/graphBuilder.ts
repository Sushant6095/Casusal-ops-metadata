import { sql } from "drizzle-orm";
import {
  entities,
  lineageEdges,
} from "@causalops/ingestor/db/schema";
import type { Db } from "../context.js";

export interface GraphNode {
  fqn: string;
  entityType: string;
  name: string;
  owner: string | null;
  tags: unknown[];
  riskScore: number | null;
  topCause: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  fromColumn: string | null;
  toColumn: string | null;
}

export interface LineageGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootFqn: string;
  depth: number;
}

type EntityRow = {
  fqn: string;
  entityType: string;
  name: string;
  ownerFqn: string | null;
  tags: unknown[];
  raw: Record<string, unknown>;
};

const extractRisk = (
  raw: Record<string, unknown> | null | undefined,
): {
  riskScore: number | null;
  topCause: string | null;
} => {
  const safe = raw ?? {};
  const ext = (safe["extension"] as Record<string, unknown> | undefined) ?? {};
  const score = ext["causalOpsRiskScore"];
  const top = ext["causalOpsTopCause"];
  return {
    riskScore: typeof score === "number" ? score : null,
    topCause: typeof top === "string" ? top : null,
  };
};

export const getLineageSubgraph = async (
  db: Db,
  rootFqn: string,
  depth: number,
  direction: "both" | "downstream" | "upstream" = "both",
): Promise<LineageGraphResult> => {
  const visited = new Set<string>([rootFqn]);
  const collected: GraphEdge[] = [];
  let frontier = new Set<string>([rootFqn]);

  for (let level = 0; level < depth; level += 1) {
    if (frontier.size === 0) break;
    const frontierArr = Array.from(frontier);
    const rows = await db
      .select({
        from: lineageEdges.fromFqn,
        to: lineageEdges.toFqn,
        fromCol: lineageEdges.fromColumn,
        toCol: lineageEdges.toColumn,
      })
      .from(lineageEdges)
      .where(
        direction === "downstream"
          ? sql`${lineageEdges.fromFqn} = ANY(${frontierArr})`
          : direction === "upstream"
            ? sql`${lineageEdges.toFqn} = ANY(${frontierArr})`
            : sql`${lineageEdges.fromFqn} = ANY(${frontierArr}) OR ${lineageEdges.toFqn} = ANY(${frontierArr})`,
      );

    const next = new Set<string>();
    for (const r of rows) {
      collected.push({
        from: r.from,
        to: r.to,
        fromColumn: r.fromCol,
        toColumn: r.toCol,
      });
      if (!visited.has(r.from)) next.add(r.from);
      if (!visited.has(r.to)) next.add(r.to);
    }
    for (const n of next) visited.add(n);
    frontier = next;
  }

  const nodeRows = (await db
    .select({
      fqn: entities.fqn,
      entityType: entities.entityType,
      name: entities.name,
      ownerFqn: entities.ownerFqn,
      tags: entities.tags,
      raw: entities.raw,
    })
    .from(entities)
    .where(sql`${entities.fqn} = ANY(${Array.from(visited)})`)) as EntityRow[];

  const nodes: GraphNode[] = nodeRows.map((r) => {
    const { riskScore, topCause } = extractRisk(r.raw);
    return {
      fqn: r.fqn,
      entityType: r.entityType,
      name: r.name,
      owner: r.ownerFqn,
      tags: r.tags,
      riskScore,
      topCause,
    };
  });

  // Dedup edges (from,to,fromCol,toCol)
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const e of collected) {
    const key = `${e.from}|${e.to}|${e.fromColumn ?? ""}|${e.toColumn ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(e);
  }

  return { nodes, edges, rootFqn, depth };
};

export const ancestorsOf = async (
  db: Db,
  fqn: string,
  depth: number,
): Promise<string[]> => {
  const result = await getLineageSubgraph(db, fqn, depth, "upstream");
  return result.nodes.filter((n) => n.fqn !== fqn).map((n) => n.fqn);
};
