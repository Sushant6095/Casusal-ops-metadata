/**
 * 20 incident fixtures with ground-truth causality labels.
 * Balanced 10 TRUE causal + 10 FALSE confounded/coincident.
 */
import {
  TABLE_CAMPAIGNS,
  TABLE_CAMPAIGN_ATTRIBUTION,
  TABLE_ORDERS,
  TABLE_REVENUE_VIEW,
  TABLE_USERS,
  PIPELINE_CAMPAIGN_ETL,
  PIPELINE_ORDERS_INGEST,
  DASHBOARD_REVENUE,
  DASHBOARD_ATTRIBUTION,
  tableFqn,
  pipelineFqn,
  dashboardFqn,
  type TableFixture,
  type PipelineFixture,
  type DashboardFixture,
} from "./fixtures.js";

export type TreatmentKind =
  | "schemaChange"
  | "ownerChange"
  | "descriptionChange"
  | "tagAdded"
  | "pipelineStatusFail";

export type OutcomeKind =
  | "testFailure"
  | "dashboardStale"
  | "nullSpike"
  | "rowCountDrop"
  | "freshnessFail";

export interface IncidentFixture {
  id: number;
  label: string;
  treatment: {
    kind: TreatmentKind;
    entityKind: "table" | "pipeline";
    table?: TableFixture;
    pipeline?: PipelineFixture;
    column?: string;
    description?: string;
    details?: string;
  };
  outcome: {
    kind: OutcomeKind;
    table?: TableFixture;
    dashboard?: DashboardFixture;
    testCaseName?: string;
    column?: string;
    resultSummary: string;
  };
  isCause: boolean;
  timeGapHours: number;
}

export const INCIDENTS: readonly IncidentFixture[] = [
  {
    id: 1,
    label: "orders.price schema change → revenue_view DQ fail",
    treatment: {
      kind: "schemaChange",
      entityKind: "table",
      table: TABLE_ORDERS,
      column: "price",
      details: "added and removed transient column price_v2",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_REVENUE_VIEW,
      testCaseName: "revenue_view_row_count",
      resultSummary: "row count out of bounds after price recast",
    },
    isCause: true,
    timeGapHours: 3.2,
  },
  {
    id: 2,
    label: "users.phone null-spike → Marketing-Attribution stale",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_USERS,
      column: "phone",
      description: "phone nullable: upstream sync dropped PII",
    },
    outcome: {
      kind: "dashboardStale",
      dashboard: DASHBOARD_ATTRIBUTION,
      resultSummary: "attribution dashboard data >48h stale",
    },
    isCause: true,
    timeGapHours: 2.1,
  },
  {
    id: 3,
    label: "campaigns.discount_code rename → campaign_attribution row drop",
    treatment: {
      kind: "schemaChange",
      entityKind: "table",
      table: TABLE_CAMPAIGNS,
      column: "discount_code",
      details: "renamed discount_code → promo_code then back",
    },
    outcome: {
      kind: "rowCountDrop",
      table: TABLE_CAMPAIGN_ATTRIBUTION,
      resultSummary: "attribution rows −80% join-key mismatch",
    },
    isCause: true,
    timeGapHours: 1.4,
  },
  {
    id: 4,
    label: "orders_ingest owner change → orders freshness fail (unrelated)",
    treatment: {
      kind: "ownerChange",
      entityKind: "pipeline",
      pipeline: PIPELINE_ORDERS_INGEST,
      details: "pipeline owner rotated",
    },
    outcome: {
      kind: "freshnessFail",
      table: TABLE_ORDERS,
      testCaseName: "orders_created_at_freshness",
      resultSummary: "freshness breach — owner change cosmetic",
    },
    isCause: false,
    timeGapHours: 2.8,
  },
  {
    id: 5,
    label: "orders.created_at timezone bug → revenue_view freshness fail",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_ORDERS,
      column: "created_at",
      description: "tz fixed from UTC+0 to source-local",
    },
    outcome: {
      kind: "freshnessFail",
      table: TABLE_REVENUE_VIEW,
      resultSummary: "revenue_view freshness breach",
    },
    isCause: true,
    timeGapHours: 3.9,
  },
  {
    id: 6,
    label: "users.email regex update → users.email DQ fail",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_USERS,
      column: "email",
      description: "regex tightened to RFC 5322",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_USERS,
      testCaseName: "users_email_format",
      resultSummary: "email regex failures +15%",
    },
    isCause: true,
    timeGapHours: 1.1,
  },
  {
    id: 7,
    label: "revenue_view description change → Revenue-Q1 stale (coincident)",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_REVENUE_VIEW,
      description: "clarified day column semantics",
    },
    outcome: {
      kind: "dashboardStale",
      dashboard: DASHBOARD_REVENUE,
      resultSummary: "dashboard stale — upstream ETL lag",
    },
    isCause: false,
    timeGapHours: 1.8,
  },
  {
    id: 8,
    label: "campaigns tag added → campaign_attribution DQ fail (coincident)",
    treatment: {
      kind: "tagAdded",
      entityKind: "table",
      table: TABLE_CAMPAIGNS,
      details: "applied PII.Sensitive tag",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_CAMPAIGN_ATTRIBUTION,
      resultSummary: "DQ fail from independent ETL issue",
    },
    isCause: false,
    timeGapHours: 2.3,
  },
  {
    id: 9,
    label: "orders comment update → orders.price null-spike (coincident)",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_ORDERS,
      description: "added business-glossary link",
    },
    outcome: {
      kind: "nullSpike",
      table: TABLE_ORDERS,
      testCaseName: "orders_price_not_null",
      column: "price",
      resultSummary: "price null rate 0.4% → 2.1%",
    },
    isCause: false,
    timeGapHours: 3.5,
  },
  {
    id: 10,
    label: "daily_campaign_etl status FAIL → campaign_attribution row drop",
    treatment: {
      kind: "pipelineStatusFail",
      entityKind: "pipeline",
      pipeline: PIPELINE_CAMPAIGN_ETL,
      details: "pipeline run failed mid-transform",
    },
    outcome: {
      kind: "rowCountDrop",
      table: TABLE_CAMPAIGN_ATTRIBUTION,
      resultSummary: "rows dropped — pipeline did not complete",
    },
    isCause: true,
    timeGapHours: 0.8,
  },
  {
    id: 11,
    label: "orders.user_id FK description change → attribution row drop",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_ORDERS,
      column: "user_id",
      description: "clarified FK to users.id",
    },
    outcome: {
      kind: "rowCountDrop",
      table: TABLE_CAMPAIGN_ATTRIBUTION,
      resultSummary: "rows drop — unrelated to doc change",
    },
    isCause: false,
    timeGapHours: 2.9,
  },
  {
    id: 12,
    label: "users.email schema widen → users.email DQ fail",
    treatment: {
      kind: "schemaChange",
      entityKind: "table",
      table: TABLE_USERS,
      column: "email",
      details: "widened VARCHAR 255 → 512 (add + drop transient col)",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_USERS,
      testCaseName: "users_email_format",
      resultSummary: "long emails breaking regex",
    },
    isCause: true,
    timeGapHours: 2.0,
  },
  {
    id: 13,
    label: "campaign_attribution owner change → dashboard stale (unrelated)",
    treatment: {
      kind: "ownerChange",
      entityKind: "table",
      table: TABLE_CAMPAIGN_ATTRIBUTION,
      details: "ownership rotated",
    },
    outcome: {
      kind: "dashboardStale",
      dashboard: DASHBOARD_ATTRIBUTION,
      resultSummary: "dashboard stale — cron skew",
    },
    isCause: false,
    timeGapHours: 3.1,
  },
  {
    id: 14,
    label: "orders_ingest status FAIL → orders freshness fail",
    treatment: {
      kind: "pipelineStatusFail",
      entityKind: "pipeline",
      pipeline: PIPELINE_ORDERS_INGEST,
      details: "source API timeout",
    },
    outcome: {
      kind: "freshnessFail",
      table: TABLE_ORDERS,
      testCaseName: "orders_created_at_freshness",
      resultSummary: "freshness breach from missing ingest run",
    },
    isCause: true,
    timeGapHours: 1.6,
  },
  {
    id: 15,
    label: "revenue_view tag added → revenue_view row_count fail (coincident)",
    treatment: {
      kind: "tagAdded",
      entityKind: "table",
      table: TABLE_REVENUE_VIEW,
      details: "tag Tier.Gold applied",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_REVENUE_VIEW,
      testCaseName: "revenue_view_row_count",
      resultSummary: "row count low — upstream backlog",
    },
    isCause: false,
    timeGapHours: 2.4,
  },
  {
    id: 16,
    label: "campaigns.starts_at description change → attribution row drop",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_CAMPAIGNS,
      column: "starts_at",
      description: "clarified timezone expectation",
    },
    outcome: {
      kind: "rowCountDrop",
      table: TABLE_CAMPAIGN_ATTRIBUTION,
      resultSummary: "rows drop — unrelated retention job",
    },
    isCause: false,
    timeGapHours: 3.7,
  },
  {
    id: 17,
    label: "orders schema drop price → revenue_view DQ fail",
    treatment: {
      kind: "schemaChange",
      entityKind: "table",
      table: TABLE_ORDERS,
      column: "price",
      details: "add + drop transient `price_audit` col",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_REVENUE_VIEW,
      testCaseName: "revenue_view_row_count",
      resultSummary: "row count breach after migration window",
    },
    isCause: true,
    timeGapHours: 2.6,
  },
  {
    id: 18,
    label: "users owner change → users.email DQ fail (unrelated)",
    treatment: {
      kind: "ownerChange",
      entityKind: "table",
      table: TABLE_USERS,
      details: "owner rotated",
    },
    outcome: {
      kind: "testFailure",
      table: TABLE_USERS,
      testCaseName: "users_email_format",
      resultSummary: "DQ fail from upstream CRM sync bug",
    },
    isCause: false,
    timeGapHours: 1.9,
  },
  {
    id: 19,
    label: "daily_campaign_etl status FAIL → Marketing-Attribution stale",
    treatment: {
      kind: "pipelineStatusFail",
      entityKind: "pipeline",
      pipeline: PIPELINE_CAMPAIGN_ETL,
      details: "pipeline failed at attribution step",
    },
    outcome: {
      kind: "dashboardStale",
      dashboard: DASHBOARD_ATTRIBUTION,
      resultSummary: "dashboard cannot refresh",
    },
    isCause: true,
    timeGapHours: 1.2,
  },
  {
    id: 20,
    label: "campaigns description change → orders freshness fail (unrelated)",
    treatment: {
      kind: "descriptionChange",
      entityKind: "table",
      table: TABLE_CAMPAIGNS,
      description: "updated owner contact info",
    },
    outcome: {
      kind: "freshnessFail",
      table: TABLE_ORDERS,
      testCaseName: "orders_created_at_freshness",
      resultSummary: "freshness breach — cross-service noise",
    },
    isCause: false,
    timeGapHours: 3.3,
  },
] as const;

// Sanity check: invariant — 10 true, 10 false
export const INCIDENT_TRUE_COUNT = INCIDENTS.filter((i) => i.isCause).length;
export const INCIDENT_FALSE_COUNT = INCIDENTS.filter((i) => !i.isCause).length;

export const fqnForTreatment = (i: IncidentFixture): string => {
  if (i.treatment.entityKind === "pipeline" && i.treatment.pipeline) {
    return pipelineFqn(i.treatment.pipeline);
  }
  if (i.treatment.table) return tableFqn(i.treatment.table);
  return "unknown";
};

export const fqnForOutcome = (i: IncidentFixture): string => {
  if (i.outcome.dashboard) return dashboardFqn(i.outcome.dashboard);
  if (i.outcome.table) return tableFqn(i.outcome.table);
  return "unknown";
};
