/**
 * Demo-data seeder. Bypasses OpenMetadata and writes realistic rows
 * straight into TimescaleDB so the web UI lights up without needing an
 * OM bot token. Idempotent.
 *
 * Usage:
 *   pnpm demo:seed
 */
import "dotenv/config";
import postgres from "postgres";
import chalk from "chalk";

const SVC = "demo_postgres";
const DB = "default";
const SALES = "sales";
const MKT = "marketing";

const fqnTable = (schema: string, name: string): string =>
  `${SVC}.${DB}.${schema}.${name}`;
const fqnDash = (name: string): string => `demo_superset.${name}`;
const fqnPipe = (name: string): string => `demo_airflow.${name}`;

interface EntityRow {
  fqn: string;
  type: string;
  name: string;
  service: string;
  riskScore?: number;
  topCause?: string;
}

interface EdgeRow {
  from: string;
  to: string;
  fromCol?: string | null;
  toCol?: string | null;
}

const ENTITIES: EntityRow[] = [
  { fqn: fqnTable(SALES, "orders"), type: "table", name: "orders", service: SVC },
  { fqn: fqnTable(SALES, "users"), type: "table", name: "users", service: SVC },
  {
    fqn: fqnTable(SALES, "revenue_view"),
    type: "table",
    name: "revenue_view",
    service: SVC,
    riskScore: 0.83,
    topCause: "demo_postgres.default.sales.orders (entityUpdated)",
  },
  { fqn: fqnTable(MKT, "campaigns"), type: "table", name: "campaigns", service: SVC },
  {
    fqn: fqnTable(MKT, "campaign_attribution"),
    type: "table",
    name: "campaign_attribution",
    service: SVC,
    riskScore: 0.71,
    topCause: "demo_postgres.default.marketing.campaigns (entityUpdated)",
  },
  { fqn: fqnDash("Revenue-Q1"), type: "dashboard", name: "Revenue-Q1", service: "demo_superset" },
  {
    fqn: fqnDash("Marketing-Attribution"),
    type: "dashboard",
    name: "Marketing-Attribution",
    service: "demo_superset",
    riskScore: 0.62,
    topCause: "demo_postgres.default.sales.users (descriptionChange)",
  },
  { fqn: fqnPipe("daily_campaign_etl"), type: "pipeline", name: "daily_campaign_etl", service: "demo_airflow" },
  { fqn: fqnPipe("orders_ingest"), type: "pipeline", name: "orders_ingest", service: "demo_airflow" },
];

const EDGES: EdgeRow[] = [
  // table-level
  { from: fqnTable(SALES, "users"), to: fqnTable(SALES, "orders") },
  { from: fqnTable(SALES, "orders"), to: fqnTable(SALES, "revenue_view") },
  { from: fqnTable(MKT, "campaigns"), to: fqnTable(MKT, "campaign_attribution") },
  { from: fqnTable(SALES, "orders"), to: fqnTable(MKT, "campaign_attribution") },
  // dashboards
  { from: fqnTable(SALES, "revenue_view"), to: fqnDash("Revenue-Q1") },
  { from: fqnTable(MKT, "campaign_attribution"), to: fqnDash("Marketing-Attribution") },
  // pipelines (table → table via pipeline shows up as plain edges in our schema)
  // column-level
  {
    from: fqnTable(SALES, "users"),
    to: fqnTable(SALES, "orders"),
    fromCol: `${fqnTable(SALES, "users")}.id`,
    toCol: `${fqnTable(SALES, "orders")}.user_id`,
  },
  {
    from: fqnTable(SALES, "orders"),
    to: fqnTable(SALES, "revenue_view"),
    fromCol: `${fqnTable(SALES, "orders")}.price`,
    toCol: `${fqnTable(SALES, "revenue_view")}.revenue`,
  },
  {
    from: fqnTable(SALES, "orders"),
    to: fqnTable(SALES, "revenue_view"),
    fromCol: `${fqnTable(SALES, "orders")}.created_at`,
    toCol: `${fqnTable(SALES, "revenue_view")}.day`,
  },
  {
    from: fqnTable(MKT, "campaigns"),
    to: fqnTable(MKT, "campaign_attribution"),
    fromCol: `${fqnTable(MKT, "campaigns")}.id`,
    toCol: `${fqnTable(MKT, "campaign_attribution")}.campaign_id`,
  },
  {
    from: fqnTable(SALES, "orders"),
    to: fqnTable(MKT, "campaign_attribution"),
    fromCol: `${fqnTable(SALES, "orders")}.discount_code`,
    toCol: `${fqnTable(MKT, "campaign_attribution")}.user_id`,
  },
];

interface ChangeEventSeed {
  entityFqn: string;
  entityType: string;
  eventType: string;
  hoursAgo: number;
  description: string;
}

// orders → revenue_view: tightly aligned (schema change ~30 min before each rv failure)
// This makes the causal engine pick orders as the top cause for revenue_view.
const ORDERS_REVENUE_PAIRS = [0.5, 4, 14, 50, 100, 150, 200, 260, 320, 400, 500, 600];
const NOISE_HOURS = [11, 27, 55, 88, 115, 170, 240, 380, 540];

const CHANGE_EVENTS: ChangeEventSeed[] = [
  // === Causal cluster: orders.price schema events 0.4–0.6h before each revenue_view failure ===
  ...ORDERS_REVENUE_PAIRS.map(
    (h, i): ChangeEventSeed => ({
      entityFqn: fqnTable(SALES, "orders"),
      entityType: "table",
      eventType: "entityUpdated",
      hoursAgo: h + 0.5,
      description: `schema: added/removed transient column price_audit_${i}`,
    }),
  ),
  // === Noise events on other entities — uncorrelated with revenue_view failures ===
  ...NOISE_HOURS.map(
    (h): ChangeEventSeed => ({
      entityFqn: fqnTable(SALES, "users"),
      entityType: "table",
      eventType: "entityUpdated",
      hoursAgo: h,
      description: "email regex / phone null / owner rotated",
    }),
  ),
  { entityFqn: fqnTable(MKT, "campaigns"), entityType: "table", eventType: "entityUpdated", hoursAgo: 5, description: "discount_code renamed → promo_code then back" },
  { entityFqn: fqnTable(MKT, "campaigns"), entityType: "table", eventType: "entityUpdated", hoursAgo: 28, description: "applied PII.Sensitive tag" },
  { entityFqn: fqnTable(MKT, "campaigns"), entityType: "table", eventType: "entityUpdated", hoursAgo: 48, description: "starts_at description added" },
  { entityFqn: fqnPipe("daily_campaign_etl"), entityType: "pipeline", eventType: "pipelineStatusFail", hoursAgo: 1, description: "run FAILED at attribution step" },
  { entityFqn: fqnPipe("daily_campaign_etl"), entityType: "pipeline", eventType: "pipelineStatusFail", hoursAgo: 96, description: "pipeline failed mid-transform" },
  { entityFqn: fqnPipe("orders_ingest"), entityType: "pipeline", eventType: "pipelineStatusFail", hoursAgo: 9, description: "source API timeout" },
  { entityFqn: fqnTable(MKT, "campaign_attribution"), entityType: "table", eventType: "entityUpdated", hoursAgo: 90, description: "ownership rotated" },
  { entityFqn: fqnTable(SALES, "revenue_view"), entityType: "table", eventType: "entityUpdated", hoursAgo: 156, description: "tag Tier.Gold applied" },
];

interface TestResultSeed {
  testCaseFqn: string;
  entityFqn: string;
  status: "Failed" | "Success";
  hoursAgo: number;
}

const TEST_RESULTS: TestResultSeed[] = [
  // === Failures aligned with orders.price treatments (causal cluster) ===
  ...ORDERS_REVENUE_PAIRS.map(
    (h): TestResultSeed => ({
      testCaseFqn: `${fqnTable(SALES, "revenue_view")}.revenue_view_row_count`,
      entityFqn: fqnTable(SALES, "revenue_view"),
      status: "Failed" as const,
      hoursAgo: h,
    }),
  ),
  // === Other recent failures (visible in UI but not on revenue_view) ===
  { testCaseFqn: `${fqnTable(MKT, "campaign_attribution")}.attribution_row_count`, entityFqn: fqnTable(MKT, "campaign_attribution"), status: "Failed", hoursAgo: 2 },
  { testCaseFqn: `${fqnTable(MKT, "campaign_attribution")}.attribution_row_count`, entityFqn: fqnTable(MKT, "campaign_attribution"), status: "Failed", hoursAgo: 7 },
  { testCaseFqn: `${fqnTable(SALES, "users")}.users_email_format`, entityFqn: fqnTable(SALES, "users"), status: "Failed", hoursAgo: 6 },
  { testCaseFqn: `${fqnTable(SALES, "orders")}.orders_price_not_null`, entityFqn: fqnTable(SALES, "orders"), status: "Failed", hoursAgo: 8 },
  { testCaseFqn: `${fqnTable(SALES, "orders")}.orders_created_at_freshness`, entityFqn: fqnTable(SALES, "orders"), status: "Failed", hoursAgo: 10 },
  { testCaseFqn: `${fqnTable(MKT, "campaign_attribution")}.attribution_row_count`, entityFqn: fqnTable(MKT, "campaign_attribution"), status: "Failed", hoursAgo: 20 },
  { testCaseFqn: `${fqnTable(SALES, "users")}.users_email_format`, entityFqn: fqnTable(SALES, "users"), status: "Failed", hoursAgo: 26 },
  { testCaseFqn: `${fqnTable(SALES, "orders")}.orders_created_at_freshness`, entityFqn: fqnTable(SALES, "orders"), status: "Failed", hoursAgo: 35 },
  { testCaseFqn: `${fqnTable(MKT, "campaign_attribution")}.attribution_row_count`, entityFqn: fqnTable(MKT, "campaign_attribution"), status: "Failed", hoursAgo: 70 },
  { testCaseFqn: `${fqnTable(SALES, "orders")}.orders_price_not_null`, entityFqn: fqnTable(SALES, "orders"), status: "Failed", hoursAgo: 96 },
  { testCaseFqn: `${fqnTable(SALES, "users")}.users_email_format`, entityFqn: fqnTable(SALES, "users"), status: "Failed", hoursAgo: 130 },
  // background passes
  ...Array.from({ length: 40 }, (_, i): TestResultSeed => ({
    testCaseFqn: `${fqnTable(SALES, "revenue_view")}.revenue_view_row_count`,
    entityFqn: fqnTable(SALES, "revenue_view"),
    status: "Success",
    hoursAgo: i * 4 + 1,
  })),
];

const main = async (): Promise<void> => {
  const url =
    process.env.TIMESCALE_URL ??
    "postgres://causalops:causalops@localhost:5433/events";
  const sql = postgres(url, { max: 4 });

  try {
    console.log(chalk.cyan(`→ seeding demo data into ${url}`));
    const now = new Date();

    // entities
    for (const e of ENTITIES) {
      const extension: Record<string, unknown> = {};
      if (e.riskScore != null) {
        extension["causalOpsRiskScore"] = e.riskScore;
        extension["causalOpsTopCause"] = e.topCause ?? "";
        extension["causalOpsLastAnalysis"] = now.toISOString();
      }
      const raw = { name: e.name, fullyQualifiedName: e.fqn, extension };
      await sql`
        INSERT INTO entities (fqn, entity_type, name, service, owner_fqn, tags, raw, updated_at)
        VALUES (${e.fqn}, ${e.type}, ${e.name}, ${e.service}, ${"demo-team"},
                ${sql.json([])}, ${sql.json(raw)}, ${now})
        ON CONFLICT (fqn) DO UPDATE SET
          entity_type = EXCLUDED.entity_type,
          name = EXCLUDED.name,
          service = EXCLUDED.service,
          owner_fqn = EXCLUDED.owner_fqn,
          tags = EXCLUDED.tags,
          raw = EXCLUDED.raw,
          updated_at = EXCLUDED.updated_at
      `;
    }
    console.log(chalk.green(`  ✓ ${ENTITIES.length} entities`));

    // lineage edges (truncate + reinsert for idempotency)
    await sql`TRUNCATE lineage_edges`;
    for (const e of EDGES) {
      await sql`
        INSERT INTO lineage_edges (from_fqn, to_fqn, from_column, to_column, transformation, discovered_at)
        VALUES (${e.from}, ${e.to}, ${e.fromCol ?? null}, ${e.toCol ?? null}, ${null}, ${now})
      `;
    }
    console.log(chalk.green(`  ✓ ${EDGES.length} lineage edges`));

    // change_events
    let evCount = 0;
    for (const ev of CHANGE_EVENTS) {
      const ts = new Date(now.getTime() - ev.hoursAgo * 3_600_000);
      const id = `evt-${ev.entityFqn.replace(/[^a-z0-9]/gi, "-")}-${Math.floor(ts.getTime() / 1000)}`;
      const changeFields = {
        fieldsUpdated: [{ name: "description", oldValue: "", newValue: ev.description }],
      };
      const raw = {
        id,
        eventType: ev.eventType,
        entityType: ev.entityType,
        entityFullyQualifiedName: ev.entityFqn,
        timestamp: ts.getTime(),
        description: ev.description,
      };
      await sql`
        INSERT INTO change_events (id, timestamp, entity_fqn, entity_type, event_type, change_fields, raw)
        VALUES (${id}, ${ts}, ${ev.entityFqn}, ${ev.entityType}, ${ev.eventType},
                ${sql.json(changeFields)}, ${sql.json(raw)})
        ON CONFLICT (id, timestamp) DO NOTHING
      `;
      evCount += 1;
    }
    console.log(chalk.green(`  ✓ ${evCount} change events`));

    // test_case_results
    let trCount = 0;
    for (const r of TEST_RESULTS) {
      const ts = new Date(now.getTime() - r.hoursAgo * 3_600_000);
      const id = `tcr-${r.testCaseFqn}-${Math.floor(ts.getTime() / 1000)}`;
      const raw = {
        timestamp: ts.getTime(),
        testCaseStatus: r.status,
        testCaseFQN: r.testCaseFqn,
      };
      await sql`
        INSERT INTO test_case_results (id, timestamp, test_case_fqn, entity_fqn, status, result_value, raw)
        VALUES (${id}, ${ts}, ${r.testCaseFqn}, ${r.entityFqn}, ${r.status},
                ${null}, ${sql.json(raw)})
        ON CONFLICT (id, timestamp) DO NOTHING
      `;
      trCount += 1;
    }
    console.log(chalk.green(`  ✓ ${trCount} test results`));

    console.log(
      chalk.bold.green(
        `\n✓ demo data seeded — open http://localhost:3000 and refresh`,
      ),
    );
  } finally {
    await sql.end();
  }
};

main().catch((err: unknown) => {
  console.error(chalk.red("fatal:"), (err as Error).message);
  process.exit(1);
});
