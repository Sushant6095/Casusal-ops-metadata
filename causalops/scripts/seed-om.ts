/**
 * CausalOps — OpenMetadata seed script.
 * Idempotent: creates services, databases, schemas, tables, lineage,
 * dashboards, pipelines, DQ tests, and PII tags for the demo dataset.
 *
 * Usage:
 *   pnpm seed:om            # create/update
 *   pnpm seed:om -- --reset # hard-delete demo_* entities first, then seed
 */
import "dotenv/config";
import chalk from "chalk";
import { createOmClient, type OmClient } from "@causalops/om-client";
import {
  CLASSIFICATION,
  DASHBOARDS,
  DASHBOARD_SERVICE,
  DATABASE_NAME,
  DB_SERVICE,
  LINEAGE_EDGES,
  PIPELINES,
  PIPELINE_SERVICE,
  SALES_SCHEMA,
  MARKETING_SCHEMA,
  TABLES,
  TAG_APPLICATIONS,
  TEST_CASES,
  chartFqn,
  columnFqn,
  dashboardFqn,
  pipelineFqn,
  tableFqn,
  type DashboardFixture,
  type PipelineFixture,
  type TableFixture,
  type TestCaseFixture,
} from "./lib/fixtures.js";
import {
  formatAxiosMessage,
  getByNameOrNull,
  hardDelete,
  postOrExists,
  putUpsert,
  type UpsertOutcome,
} from "./lib/om.js";

interface Stats {
  services: number;
  databases: number;
  schemas: number;
  tables: number;
  lineage: number;
  dashboards: number;
  pipelines: number;
  tests: number;
  tags: number;
  failed: number;
}

const stats: Stats = {
  services: 0,
  databases: 0,
  schemas: 0,
  tables: 0,
  lineage: 0,
  dashboards: 0,
  pipelines: 0,
  tests: 0,
  tags: 0,
  failed: 0,
};

const mark = (outcome: UpsertOutcome, label: string): void => {
  const icon = outcome === "created" ? chalk.green("✓") : chalk.yellow("↻");
  const verb = outcome === "created" ? "created" : "exists";
  console.log(`  ${icon} ${label} (${verb})`);
};

const fail = (label: string, err: unknown): void => {
  stats.failed += 1;
  console.log(`  ${chalk.red("✗")} ${label} — ${formatAxiosMessage(err)}`);
};

const seedServices = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Services"));

  const dbSvc = {
    name: DB_SERVICE,
    serviceType: "Postgres",
    connection: {
      config: {
        type: "Postgres",
        username: "demo",
        authType: { password: "demo" },
        hostPort: "localhost:5432",
        database: "demo",
      },
    },
  };
  try {
    const r = await putUpsert(client, "/services/databaseServices", dbSvc);
    mark(r.outcome, `databaseService ${DB_SERVICE}`);
    stats.services += 1;
  } catch (e) {
    fail(`databaseService ${DB_SERVICE}`, e);
  }

  const dashSvc = {
    name: DASHBOARD_SERVICE,
    serviceType: "Superset",
    connection: {
      config: {
        type: "Superset",
        hostPort: "http://localhost:8088",
        connection: {
          provider: "db",
          username: "admin",
          password: "admin",
        },
      },
    },
  };
  try {
    const r = await putUpsert(client, "/services/dashboardServices", dashSvc);
    mark(r.outcome, `dashboardService ${DASHBOARD_SERVICE}`);
    stats.services += 1;
  } catch (e) {
    fail(`dashboardService ${DASHBOARD_SERVICE}`, e);
  }

  const pipeSvc = {
    name: PIPELINE_SERVICE,
    serviceType: "Airflow",
    connection: {
      config: {
        type: "Airflow",
        hostPort: "http://localhost:8080",
        connection: { type: "Backend" },
      },
    },
  };
  try {
    const r = await putUpsert(client, "/services/pipelineServices", pipeSvc);
    mark(r.outcome, `pipelineService ${PIPELINE_SERVICE}`);
    stats.services += 1;
  } catch (e) {
    fail(`pipelineService ${PIPELINE_SERVICE}`, e);
  }
};

const seedDatabasesAndSchemas = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Database + schemas"));

  try {
    const r = await putUpsert(client, "/databases", {
      name: DATABASE_NAME,
      service: DB_SERVICE,
    });
    mark(r.outcome, `database ${DB_SERVICE}.${DATABASE_NAME}`);
    stats.databases += 1;
  } catch (e) {
    fail(`database ${DB_SERVICE}.${DATABASE_NAME}`, e);
  }

  for (const schema of [SALES_SCHEMA, MARKETING_SCHEMA]) {
    try {
      const r = await putUpsert(client, "/databaseSchemas", {
        name: schema,
        database: `${DB_SERVICE}.${DATABASE_NAME}`,
      });
      mark(r.outcome, `schema ${DB_SERVICE}.${DATABASE_NAME}.${schema}`);
      stats.schemas += 1;
    } catch (e) {
      fail(`schema ${schema}`, e);
    }
  }
};

const seedTables = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Tables"));
  for (const t of TABLES) {
    const payload = {
      name: t.name,
      databaseSchema: `${DB_SERVICE}.${DATABASE_NAME}.${t.schema}`,
      columns: t.columns.map((c) => ({
        name: c.name,
        dataType: c.dataType,
        dataLength: c.dataLength,
        constraint: c.constraint,
      })),
    };
    try {
      const r = await putUpsert(client, "/tables", payload);
      mark(r.outcome, `table ${tableFqn(t)}`);
      stats.tables += 1;
    } catch (e) {
      fail(`table ${tableFqn(t)}`, e);
    }
  }
};

interface EntityRef {
  id: string;
  type: string;
}

const refForTable = async (
  client: OmClient,
  t: TableFixture,
): Promise<EntityRef | null> => {
  const row = await getByNameOrNull<{ id: string }>(
    client,
    `/tables/name/${encodeURIComponent(tableFqn(t))}`,
  );
  return row ? { id: row.id, type: "table" } : null;
};

const refForDashboard = async (
  client: OmClient,
  d: DashboardFixture,
): Promise<EntityRef | null> => {
  const row = await getByNameOrNull<{ id: string }>(
    client,
    `/dashboards/name/${encodeURIComponent(dashboardFqn(d))}`,
  );
  return row ? { id: row.id, type: "dashboard" } : null;
};

const refForPipeline = async (
  client: OmClient,
  p: PipelineFixture,
): Promise<EntityRef | null> => {
  const row = await getByNameOrNull<{ id: string }>(
    client,
    `/pipelines/name/${encodeURIComponent(pipelineFqn(p))}`,
  );
  return row ? { id: row.id, type: "pipeline" } : null;
};

const seedLineage = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Lineage (table + column)"));
  for (const edge of LINEAGE_EDGES) {
    const from = await refForTable(client, edge.from);
    const to = await refForTable(client, edge.to);
    if (!from || !to) {
      fail(`lineage ${edge.from.name}→${edge.to.name}`, "missing endpoint");
      continue;
    }
    const body = {
      edge: {
        fromEntity: from,
        toEntity: to,
        lineageDetails: edge.columns
          ? {
              columnsLineage: edge.columns.map((c) => ({
                fromColumns: c.fromColumns,
                toColumn: c.toColumn,
              })),
            }
          : undefined,
      },
    };
    try {
      await client.http.put("/lineage", body);
      mark("created", `lineage ${edge.from.name} → ${edge.to.name}`);
      stats.lineage += 1;
    } catch (e) {
      fail(`lineage ${edge.from.name}→${edge.to.name}`, e);
    }
  }
};

const seedDashboards = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Dashboards + charts"));
  for (const d of DASHBOARDS) {
    for (const chart of d.charts) {
      try {
        const r = await putUpsert(client, "/charts", {
          name: chart,
          service: DASHBOARD_SERVICE,
          chartType: "Line",
        });
        mark(r.outcome, `chart ${chartFqn(d, chart)}`);
      } catch (e) {
        fail(`chart ${chart}`, e);
      }
    }
    try {
      const r = await putUpsert(client, "/dashboards", {
        name: d.name,
        displayName: d.displayName,
        service: DASHBOARD_SERVICE,
        charts: d.charts.map((c) => chartFqn(d, c)),
      });
      mark(r.outcome, `dashboard ${dashboardFqn(d)}`);
      stats.dashboards += 1;
    } catch (e) {
      fail(`dashboard ${dashboardFqn(d)}`, e);
      continue;
    }

    const dashRef = await refForDashboard(client, d);
    const tableRef = await refForTable(client, d.sourceTable);
    if (dashRef && tableRef) {
      try {
        await client.http.put("/lineage", {
          edge: { fromEntity: tableRef, toEntity: dashRef },
        });
        mark(
          "created",
          `lineage ${d.sourceTable.name} → dashboard ${d.name}`,
        );
        stats.lineage += 1;
      } catch (e) {
        fail(`lineage dashboard ${d.name}`, e);
      }
    }
  }
};

const seedPipelines = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Pipelines"));
  for (const p of PIPELINES) {
    try {
      const r = await putUpsert(client, "/pipelines", {
        name: p.name,
        displayName: p.displayName,
        service: PIPELINE_SERVICE,
      });
      mark(r.outcome, `pipeline ${pipelineFqn(p)}`);
      stats.pipelines += 1;
    } catch (e) {
      fail(`pipeline ${pipelineFqn(p)}`, e);
      continue;
    }

    const pipeRef = await refForPipeline(client, p);
    if (!pipeRef) continue;

    for (const up of p.upstreamTables) {
      const upRef = await refForTable(client, up);
      for (const down of p.downstreamTables) {
        const downRef = await refForTable(client, down);
        if (!upRef || !downRef) continue;
        try {
          await client.http.put("/lineage", {
            edge: {
              fromEntity: upRef,
              toEntity: downRef,
              lineageDetails: { pipeline: pipeRef },
            },
          });
          mark(
            "created",
            `lineage ${up.name} → ${down.name} via ${p.name}`,
          );
          stats.lineage += 1;
        } catch (e) {
          fail(`lineage ${up.name}→${down.name}`, e);
        }
      }
    }
  }
};

const seedTestCases = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Data-quality test cases"));
  for (const tc of TEST_CASES) {
    const entityLink = tc.column
      ? `<#E::table::${tableFqn(tc.table)}::columns::${tc.column}>`
      : `<#E::table::${tableFqn(tc.table)}>`;
    const body = {
      name: tc.name,
      entityLink,
      testDefinition: tc.testDefinition,
      parameterValues: tc.parameterValues,
    };
    try {
      const r = await postOrExists<TestCaseFixture>(
        client,
        "/dataQuality/testCases",
        body,
      );
      mark(r.outcome, `test ${tc.name}`);
      stats.tests += 1;
    } catch (e) {
      fail(`test ${tc.name}`, e);
    }
  }
};

const seedTags = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold("\n▸ Classification + tags"));
  try {
    const r = await putUpsert(client, "/classifications", {
      name: CLASSIFICATION.name,
      description: CLASSIFICATION.description,
    });
    mark(r.outcome, `classification ${CLASSIFICATION.name}`);
  } catch (e) {
    fail(`classification ${CLASSIFICATION.name}`, e);
  }

  for (const tag of CLASSIFICATION.tags) {
    try {
      const r = await putUpsert(client, "/tags", {
        name: tag,
        classification: CLASSIFICATION.name,
        description: `${tag} PII tag`,
      });
      mark(r.outcome, `tag ${CLASSIFICATION.name}.${tag}`);
    } catch (e) {
      fail(`tag ${tag}`, e);
    }
  }

  for (const app of TAG_APPLICATIONS) {
    const fqn = tableFqn(app.table);
    const patch = [
      {
        op: "add",
        path: `/columns/${app.table.columns.findIndex(
          (c) => c.name === app.column,
        )}/tags/0`,
        value: { tagFQN: app.tagFqn, source: "Classification" },
      },
    ];
    try {
      await client.http.patch(`/tables/name/${encodeURIComponent(fqn)}`, patch, {
        headers: { "Content-Type": "application/json-patch+json" },
      });
      mark(
        "created",
        `tag apply ${app.tagFqn} → ${columnFqn(app.table, app.column)}`,
      );
      stats.tags += 1;
    } catch (e) {
      fail(`tag apply ${app.tagFqn}`, e);
    }
  }
};

const resetDemo = async (client: OmClient): Promise<void> => {
  console.log(chalk.bold.red("\n▸ Reset: hard-deleting demo_* entities"));
  for (const t of TABLES) {
    await hardDelete(
      client,
      `/tables/name/${encodeURIComponent(tableFqn(t))}`,
    );
  }
  for (const d of DASHBOARDS) {
    await hardDelete(
      client,
      `/dashboards/name/${encodeURIComponent(dashboardFqn(d))}`,
    );
  }
  for (const p of PIPELINES) {
    await hardDelete(
      client,
      `/pipelines/name/${encodeURIComponent(pipelineFqn(p))}`,
    );
  }
  await hardDelete(
    client,
    `/services/databaseServices/name/${encodeURIComponent(DB_SERVICE)}`,
  );
  await hardDelete(
    client,
    `/services/dashboardServices/name/${encodeURIComponent(DASHBOARD_SERVICE)}`,
  );
  await hardDelete(
    client,
    `/services/pipelineServices/name/${encodeURIComponent(PIPELINE_SERVICE)}`,
  );
  console.log(chalk.red("  reset complete"));
};

const main = async (): Promise<void> => {
  const host = process.env.OM_HOST ?? "http://localhost:8585";
  const token = process.env.OM_JWT_TOKEN;
  if (!token) {
    console.error(
      chalk.red("OM_JWT_TOKEN missing. Set it in .env (bot token from OM UI)."),
    );
    process.exit(1);
  }
  const client = createOmClient({ host, token });
  const shouldReset = process.argv.includes("--reset");

  console.log(chalk.cyan(`→ seeding ${host}`));

  if (shouldReset) await resetDemo(client);

  await seedServices(client);
  await seedDatabasesAndSchemas(client);
  await seedTables(client);
  await seedLineage(client);
  await seedDashboards(client);
  await seedPipelines(client);
  await seedTestCases(client);
  await seedTags(client);

  console.log(
    chalk.bold.green(
      `\n✓ ${stats.services} services, ${stats.databases} databases, ${stats.tables} tables, ${stats.tests} tests, ${stats.dashboards} dashboards, ${stats.pipelines} pipelines`,
    ),
  );
  if (stats.failed > 0) {
    console.log(chalk.red(`✗ ${stats.failed} failures`));
    process.exit(1);
  }
};

main().catch((err: unknown) => {
  console.error(chalk.red("\nFatal:"), formatAxiosMessage(err));
  process.exit(1);
});
