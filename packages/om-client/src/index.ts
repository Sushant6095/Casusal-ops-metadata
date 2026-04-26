export { createOmClient, OmApiError } from "./client.js";
export type { OmClient, OmClientOptions } from "./client.js";

export {
  EntitySchema,
  LineageNodeSchema,
  LineageEdgeSchema,
  LineageGraphSchema,
  ChangeDescriptionSchema,
  ChangeEventSchema,
  TestCaseSchema,
  TestCaseResultSchema,
  ColumnSchema,
  TableProfileSchema,
  TableSchema,
  PagingSchema,
  WebhookSubscriptionSchema,
} from "./types.js";
export type {
  Entity,
  LineageNode,
  LineageEdge,
  LineageGraph,
  ChangeDescription,
  ChangeEvent,
  TestCase,
  TestCaseResult,
  Column,
  TableProfile,
  Table,
  Paging,
  WebhookSubscription,
} from "./types.js";

export { getTableLineage, getColumnLineage } from "./lineage.js";
export type { LineageDepthOptions } from "./lineage.js";

export { listEvents, streamEvents } from "./events.js";
export type { ListEventsOptions, StreamEventsOptions } from "./events.js";

export { getTable, patchTableExtension, listTables } from "./tables.js";
export type { GetTableOptions, ListTablesOptions } from "./tables.js";

export { listTestCaseResults, listFailingTests } from "./testResults.js";
export type { ListTestResultsOptions } from "./testResults.js";

export { createSubscription, deleteSubscription } from "./webhook.js";
