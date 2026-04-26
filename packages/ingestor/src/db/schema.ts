import {
  pgTable,
  text,
  timestamp,
  jsonb,
  bigserial,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** OM entities (tables, dashboards, pipelines, ...). */
export const entities = pgTable(
  "entities",
  {
    fqn: text("fqn").primaryKey(),
    entityType: text("entity_type").notNull(),
    name: text("name").notNull(),
    service: text("service"),
    ownerFqn: text("owner_fqn"),
    tags: jsonb("tags").$type<unknown[]>().notNull().default([]),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    entityTypeIdx: index("entities_type_idx").on(t.entityType),
  }),
);

/** Directed lineage edges between entities (column-level when set). */
export const lineageEdges = pgTable(
  "lineage_edges",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    fromFqn: text("from_fqn").notNull(),
    toFqn: text("to_fqn").notNull(),
    fromColumn: text("from_column"),
    toColumn: text("to_column"),
    transformation: text("transformation"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    edgeUniq: uniqueIndex("lineage_edge_uniq").on(
      t.fromFqn,
      t.toFqn,
      t.fromColumn,
      t.toColumn,
    ),
    fromIdx: index("lineage_from_idx").on(t.fromFqn),
    toIdx: index("lineage_to_idx").on(t.toFqn),
  }),
);

/** OM change events — hypertable on `timestamp` (created in init SQL). */
export const changeEvents = pgTable(
  "change_events",
  {
    id: text("id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    entityFqn: text("entity_fqn").notNull(),
    entityType: text("entity_type").notNull(),
    eventType: text("event_type").notNull(),
    changeFields: jsonb("change_fields")
      .$type<Record<string, unknown>>()
      .notNull(),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.timestamp] }),
    entityIdx: index("change_events_entity_idx").on(t.entityFqn, t.timestamp),
  }),
);

/** Test-case results — hypertable on `timestamp` (created in init SQL). */
export const testCaseResults = pgTable(
  "test_case_results",
  {
    id: text("id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    testCaseFqn: text("test_case_fqn").notNull(),
    entityFqn: text("entity_fqn").notNull(),
    status: text("status").notNull(),
    resultValue: jsonb("result_value").$type<Record<string, unknown> | null>(),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.timestamp] }),
    entityIdx: index("test_results_entity_idx").on(t.entityFqn, t.timestamp),
    statusIdx: index("test_results_status_idx").on(t.status, t.timestamp),
  }),
);

/** Per-stream ingestion cursor (last-seen timestamp). */
export const ingestionCursors = pgTable("ingestion_cursors", {
  stream: text("stream").primaryKey(),
  lastTs: timestamp("last_ts", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type LineageEdge = typeof lineageEdges.$inferSelect;
export type NewLineageEdge = typeof lineageEdges.$inferInsert;
export type ChangeEventRow = typeof changeEvents.$inferSelect;
export type NewChangeEvent = typeof changeEvents.$inferInsert;
export type TestCaseResultRow = typeof testCaseResults.$inferSelect;
export type NewTestCaseResult = typeof testCaseResults.$inferInsert;
