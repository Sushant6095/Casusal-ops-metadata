import { z } from "zod";

/** Minimal OpenMetadata entity reference. */
export const EntitySchema = z.object({
  id: z.string(),
  fullyQualifiedName: z.string(),
  name: z.string(),
  entityType: z.string(),
});
export type Entity = z.infer<typeof EntitySchema>;

/** Lineage node — a single entity in the lineage graph. */
export const LineageNodeSchema = z.object({
  id: z.string(),
  fullyQualifiedName: z.string(),
  type: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
});
export type LineageNode = z.infer<typeof LineageNodeSchema>;

/** Lineage edge — a directed relationship between two entities. */
export const LineageEdgeSchema = z.object({
  fromEntity: z.string(),
  toEntity: z.string(),
  lineageDetails: z
    .object({
      sqlQuery: z.string().optional(),
      columnsLineage: z
        .array(
          z.object({
            fromColumns: z.array(z.string()).optional(),
            toColumn: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type LineageEdge = z.infer<typeof LineageEdgeSchema>;

/** Lineage graph returned by OM lineage endpoints. */
export const LineageGraphSchema = z.object({
  entity: LineageNodeSchema,
  nodes: z.array(LineageNodeSchema).default([]),
  upstreamEdges: z.array(LineageEdgeSchema).default([]),
  downstreamEdges: z.array(LineageEdgeSchema).default([]),
});
export type LineageGraph = z.infer<typeof LineageGraphSchema>;

/** OM change-event description diff. */
export const ChangeDescriptionSchema = z.object({
  fieldsAdded: z.array(z.unknown()).optional(),
  fieldsUpdated: z.array(z.unknown()).optional(),
  fieldsDeleted: z.array(z.unknown()).optional(),
  previousVersion: z.number().optional(),
});
export type ChangeDescription = z.infer<typeof ChangeDescriptionSchema>;

/** OM change event (created/updated/deleted entity activity). */
export const ChangeEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  entityType: z.string(),
  entityFullyQualifiedName: z.string(),
  timestamp: z.number(),
  userName: z.string().optional(),
  changeDescription: ChangeDescriptionSchema.optional(),
});
export type ChangeEvent = z.infer<typeof ChangeEventSchema>;

/** A single data-quality test case definition. */
export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  fullyQualifiedName: z.string(),
  entityLink: z.string().optional(),
  testDefinition: z
    .object({ fullyQualifiedName: z.string().optional() })
    .optional(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

/** Result of executing a test case at a point in time. */
export const TestCaseResultSchema = z.object({
  timestamp: z.number(),
  testCaseStatus: z.enum(["Success", "Failed", "Aborted", "Queued"]),
  result: z.string().optional(),
  testResultValue: z
    .array(
      z.object({
        name: z.string().optional(),
        value: z.string().optional(),
      }),
    )
    .optional(),
  testCaseFQN: z.string().optional(),
});
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

/** Column definition inside a table. */
export const ColumnSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  fullyQualifiedName: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.object({ tagFQN: z.string() })).optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

/** Profile stats snapshot for a table. */
export const TableProfileSchema = z.object({
  timestamp: z.number(),
  rowCount: z.number().optional(),
  columnCount: z.number().optional(),
  sizeInByte: z.number().optional(),
});
export type TableProfile = z.infer<typeof TableProfileSchema>;

/** OM Table entity (partial — only fields CausalOps reads). */
export const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  fullyQualifiedName: z.string(),
  entityType: z.literal("table").optional(),
  columns: z.array(ColumnSchema).default([]),
  tableProfile: TableProfileSchema.optional(),
  tags: z.array(z.object({ tagFQN: z.string() })).optional(),
  owner: z
    .object({ id: z.string(), type: z.string(), name: z.string().optional() })
    .optional(),
  extension: z.record(z.unknown()).optional(),
});
export type Table = z.infer<typeof TableSchema>;

/** OM paging cursor for list endpoints. */
export const PagingSchema = z.object({
  total: z.number().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
});
export type Paging = z.infer<typeof PagingSchema>;

/** Webhook / event subscription registration. */
export const WebhookSubscriptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  alertType: z.string().default("ChangeEvent"),
  subscriptionType: z.string().default("Webhook"),
  subscriptionConfig: z.object({
    endpoint: z.string(),
    secretKey: z.string().optional(),
  }),
  filteringRules: z
    .object({
      resources: z.array(z.string()).optional(),
    })
    .optional(),
  enabled: z.boolean().default(true),
});
export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;
