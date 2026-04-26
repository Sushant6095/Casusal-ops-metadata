/**
 * Deterministic demo fixtures for CausalOps.
 * Referenced by seed-om, inject-incidents, backtest scripts.
 */

export const DEMO_PREFIX = "demo_";

export const DB_SERVICE = "demo_postgres";
export const DASHBOARD_SERVICE = "demo_superset";
export const PIPELINE_SERVICE = "demo_airflow";

export const DATABASE_NAME = "default";
export const SALES_SCHEMA = "sales";
export const MARKETING_SCHEMA = "marketing";

export interface ColumnFixture {
  name: string;
  dataType: string;
  dataTypeDisplay?: string;
  dataLength?: number;
  constraint?: "PRIMARY_KEY" | "NOT_NULL" | "NULL" | "UNIQUE";
  description?: string;
}

export interface TableFixture {
  name: string;
  schema: string;
  columns: ColumnFixture[];
}

export const TABLE_ORDERS: TableFixture = {
  name: "orders",
  schema: SALES_SCHEMA,
  columns: [
    { name: "id", dataType: "BIGINT", constraint: "PRIMARY_KEY" },
    { name: "user_id", dataType: "BIGINT", constraint: "NOT_NULL" },
    { name: "price", dataType: "DECIMAL", constraint: "NOT_NULL" },
    { name: "discount_code", dataType: "VARCHAR", dataLength: 64 },
    { name: "created_at", dataType: "TIMESTAMP", constraint: "NOT_NULL" },
  ],
};

export const TABLE_USERS: TableFixture = {
  name: "users",
  schema: SALES_SCHEMA,
  columns: [
    { name: "id", dataType: "BIGINT", constraint: "PRIMARY_KEY" },
    { name: "email", dataType: "VARCHAR", dataLength: 255, constraint: "NOT_NULL" },
    { name: "phone", dataType: "VARCHAR", dataLength: 32 },
    { name: "created_at", dataType: "TIMESTAMP", constraint: "NOT_NULL" },
  ],
};

export const TABLE_REVENUE_VIEW: TableFixture = {
  name: "revenue_view",
  schema: SALES_SCHEMA,
  columns: [
    { name: "day", dataType: "DATE" },
    { name: "revenue", dataType: "DECIMAL" },
    { name: "order_count", dataType: "INT" },
  ],
};

export const TABLE_CAMPAIGNS: TableFixture = {
  name: "campaigns",
  schema: MARKETING_SCHEMA,
  columns: [
    { name: "id", dataType: "BIGINT", constraint: "PRIMARY_KEY" },
    { name: "name", dataType: "VARCHAR", dataLength: 128 },
    { name: "discount_code", dataType: "VARCHAR", dataLength: 64 },
    { name: "starts_at", dataType: "TIMESTAMP" },
  ],
};

export const TABLE_CAMPAIGN_ATTRIBUTION: TableFixture = {
  name: "campaign_attribution",
  schema: MARKETING_SCHEMA,
  columns: [
    { name: "user_id", dataType: "BIGINT" },
    { name: "campaign_id", dataType: "BIGINT" },
    { name: "attributed_revenue", dataType: "DECIMAL" },
  ],
};

export const TABLES: readonly TableFixture[] = [
  TABLE_ORDERS,
  TABLE_USERS,
  TABLE_REVENUE_VIEW,
  TABLE_CAMPAIGNS,
  TABLE_CAMPAIGN_ATTRIBUTION,
] as const;

export const tableFqn = (t: TableFixture): string =>
  `${DB_SERVICE}.${DATABASE_NAME}.${t.schema}.${t.name}`;

export const columnFqn = (t: TableFixture, col: string): string =>
  `${tableFqn(t)}.${col}`;

export interface ColumnLineage {
  fromColumns: string[];
  toColumn: string;
}

export interface LineageEdgeFixture {
  from: TableFixture;
  to: TableFixture;
  columns?: ColumnLineage[];
}

export const LINEAGE_EDGES: readonly LineageEdgeFixture[] = [
  {
    from: TABLE_USERS,
    to: TABLE_ORDERS,
    columns: [
      {
        fromColumns: [columnFqn(TABLE_USERS, "id")],
        toColumn: columnFqn(TABLE_ORDERS, "user_id"),
      },
    ],
  },
  {
    from: TABLE_ORDERS,
    to: TABLE_REVENUE_VIEW,
    columns: [
      {
        fromColumns: [columnFqn(TABLE_ORDERS, "price")],
        toColumn: columnFqn(TABLE_REVENUE_VIEW, "revenue"),
      },
      {
        fromColumns: [columnFqn(TABLE_ORDERS, "created_at")],
        toColumn: columnFqn(TABLE_REVENUE_VIEW, "day"),
      },
    ],
  },
  {
    from: TABLE_CAMPAIGNS,
    to: TABLE_CAMPAIGN_ATTRIBUTION,
    columns: [
      {
        fromColumns: [columnFqn(TABLE_CAMPAIGNS, "id")],
        toColumn: columnFqn(TABLE_CAMPAIGN_ATTRIBUTION, "campaign_id"),
      },
    ],
  },
  {
    from: TABLE_ORDERS,
    to: TABLE_CAMPAIGN_ATTRIBUTION,
    columns: [
      {
        fromColumns: [columnFqn(TABLE_ORDERS, "user_id")],
        toColumn: columnFqn(TABLE_CAMPAIGN_ATTRIBUTION, "user_id"),
      },
    ],
  },
] as const;

export interface DashboardFixture {
  name: string;
  displayName: string;
  charts: string[];
  sourceTable: TableFixture;
}

export const DASHBOARD_REVENUE: DashboardFixture = {
  name: "Revenue-Q1",
  displayName: "Revenue Q1",
  charts: ["revenue_by_day"],
  sourceTable: TABLE_REVENUE_VIEW,
};

export const DASHBOARD_ATTRIBUTION: DashboardFixture = {
  name: "Marketing-Attribution",
  displayName: "Marketing Attribution",
  charts: ["attribution_by_campaign"],
  sourceTable: TABLE_CAMPAIGN_ATTRIBUTION,
};

export const DASHBOARDS: readonly DashboardFixture[] = [
  DASHBOARD_REVENUE,
  DASHBOARD_ATTRIBUTION,
] as const;

export const dashboardFqn = (d: DashboardFixture): string =>
  `${DASHBOARD_SERVICE}.${d.name}`;

export const chartFqn = (d: DashboardFixture, chart: string): string =>
  `${DASHBOARD_SERVICE}.${chart}`;

export interface PipelineFixture {
  name: string;
  displayName: string;
  upstreamTables: TableFixture[];
  downstreamTables: TableFixture[];
  externalUpstream?: boolean;
}

export const PIPELINE_CAMPAIGN_ETL: PipelineFixture = {
  name: "daily_campaign_etl",
  displayName: "Daily Campaign ETL",
  upstreamTables: [TABLE_CAMPAIGNS, TABLE_ORDERS],
  downstreamTables: [TABLE_CAMPAIGN_ATTRIBUTION],
};

export const PIPELINE_ORDERS_INGEST: PipelineFixture = {
  name: "orders_ingest",
  displayName: "Orders Ingest",
  upstreamTables: [],
  downstreamTables: [TABLE_ORDERS],
  externalUpstream: true,
};

export const PIPELINES: readonly PipelineFixture[] = [
  PIPELINE_CAMPAIGN_ETL,
  PIPELINE_ORDERS_INGEST,
] as const;

export const pipelineFqn = (p: PipelineFixture): string =>
  `${PIPELINE_SERVICE}.${p.name}`;

export interface TestCaseFixture {
  name: string;
  table: TableFixture;
  column?: string;
  testDefinition: string;
  parameterValues: Array<{ name: string; value: string }>;
}

export const TEST_CASES: readonly TestCaseFixture[] = [
  {
    name: "orders_price_not_null",
    table: TABLE_ORDERS,
    column: "price",
    testDefinition: "columnValuesToBeNotNull",
    parameterValues: [],
  },
  {
    name: "orders_created_at_freshness",
    table: TABLE_ORDERS,
    column: "created_at",
    testDefinition: "columnValuesToBeBetween",
    parameterValues: [
      { name: "minValue", value: "2020-01-01" },
      { name: "maxValue", value: "2099-12-31" },
    ],
  },
  {
    name: "users_email_format",
    table: TABLE_USERS,
    column: "email",
    testDefinition: "columnValuesToMatchRegex",
    parameterValues: [{ name: "regex", value: "^[^@]+@[^@]+\\.[^@]+$" }],
  },
  {
    name: "revenue_view_row_count",
    table: TABLE_REVENUE_VIEW,
    testDefinition: "tableRowCountToBeBetween",
    parameterValues: [
      { name: "minValue", value: "1" },
      { name: "maxValue", value: "1000000" },
    ],
  },
] as const;

export const CLASSIFICATION = {
  name: "PII",
  description: "Personally Identifiable Information",
  tags: ["Sensitive", "Email", "Phone"],
} as const;

export interface TagApplication {
  table: TableFixture;
  column: string;
  tagFqn: string;
}

export const TAG_APPLICATIONS: readonly TagApplication[] = [
  { table: TABLE_USERS, column: "email", tagFqn: "PII.Email" },
  { table: TABLE_USERS, column: "phone", tagFqn: "PII.Phone" },
] as const;
