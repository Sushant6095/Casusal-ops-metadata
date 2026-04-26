# CausalOps 🧬

> Causal inference, not correlation, on top of OpenMetadata.

![demo](docs/demo.gif) <!-- replace -->

## Problem

Your pipeline broke at 3 a.m. Fifteen upstream things changed that day.
OpenMetadata shows you lineage and a list of recent events — it cannot tell
you which of those fifteen is the cause and which fourteen are coincidences.
Every hour spent chasing the wrong wire costs another ticket, another SLA,
another drop in catalog trust.

## Solution

CausalOps adds a causal-inference layer to OpenMetadata. It absorbs the
lineage graph as a DAG, fits a structural causal model on the last 30 days
of change events and DQ test results, and answers questions the catalog
alone cannot:

- **Counterfactual RCA.** Which upstream event *caused* this failure — not
  which correlated with it?
- **Interventional simulation.** If I drop this column, what breaks
  downstream, with what probability?
- **Exposed over MCP.** Every tool is callable from OM's chat panel, Claude
  Desktop, or any MCP client.

Nothing is forked. Risk scores land back on OpenMetadata as entity
extension fields. Judges can test the whole stack with one
`docker compose up`.

## Demo screenshots

| | |
|---|---|
| ![home](docs/screenshots/home.png) <!-- replace --> | ![graph](docs/screenshots/graph.png) <!-- replace --> |
| `/` — Home, failures + top risks | `/graph` — Lineage + risk overlay |
| ![why](docs/screenshots/why.png) <!-- replace --> | ![what-if](docs/screenshots/what-if.png) <!-- replace --> |
| `/why/[fqn]` — Ranked causes | `/what-if` — Blast-radius simulator |

## Back-test results

Twenty ground-truth incidents (10 true causal + 10 confounded coincident).

| Metric | CausalOps | Baseline (recency) |
|--------|-----------|--------------------|
| Top-1 accuracy (true causes) | **80%** | 50% |
| Top-3 hit rate (true causes) | 100% | — |
| Mean reciprocal rank         | 0.900 | — |
| False-positive rate (confounded wrongly picked) | 30% | 100% |
| Overall correctness            | **75%** | 50% |

Full per-incident breakdown: [docs/backtest-report.md](docs/backtest-report.md).

Reproduce:

```bash
pnpm incidents:inject --seed 42
pnpm backtest
```

## Architecture

![architecture](docs/architecture.svg)

Deeper write-up with mermaid sequence diagrams:
[docs/architecture.md](docs/architecture.md).

## OpenMetadata integration

| Endpoint | Purpose | Where in code |
|----------|---------|---------------|
| `GET /lineage/table/name/{fqn}` | Build causal DAG | [packages/ingestor/src/jobs/pollLineage.ts](packages/ingestor/src/jobs/pollLineage.ts) |
| `GET /events` | Collect treatments (schema, owner, tag, desc changes) | [packages/ingestor/src/jobs/pollEvents.ts](packages/ingestor/src/jobs/pollEvents.ts) |
| `GET /dataQuality/testCases/testCaseResults` | Collect outcomes | [packages/ingestor/src/jobs/pollTestResults.ts](packages/ingestor/src/jobs/pollTestResults.ts) |
| `PUT /lineage` | Seed column-level lineage | [scripts/seed-om.ts](scripts/seed-om.ts) |
| `PATCH /tables/name/{fqn}` (JSON Patch) | Write-back risk score + top cause to entity `extension` | [apps/api/src/services/omWriteBack.ts](apps/api/src/services/omWriteBack.ts) |
| `POST /webhook/om` (receiver) | Live ingestion of OM ChangeEvents | [apps/api/src/webhooks/omEvents.ts](apps/api/src/webhooks/omEvents.ts) |
| `POST /events/subscriptions` | Register CausalOps as a subscription endpoint | [packages/om-client/src/webhook.ts](packages/om-client/src/webhook.ts) |

## Tech stack

**TypeScript services**
- Monorepo: pnpm 9 + turborepo
- Next.js 15 (App Router) + React 19 RC + Tailwind + D3
- Fastify 5 + tRPC 11 + Drizzle ORM + postgres-js
- BullMQ + Redis 7 for scheduling
- @modelcontextprotocol/sdk 1.x for MCP

**Python worker** (only Python in the repo)
- FastAPI + asyncpg
- DoWhy + EconML + scikit-learn + causal-learn + NetworkX

**Data plane**
- OpenMetadata 1.5.13 (official images)
- TimescaleDB (pg16) — 1-day hypertable chunks for event/result streams
- Postgres 16 for app state

## Quickstart

```bash
# 1. env
cp .env.example .env            # paste an OM bot JWT into OM_JWT_TOKEN

# 2. infra
docker compose up -d            # OM + Timescale + Postgres + Redis + worker
# wait ~3 min for OM cold start

# 3. install + migrate + seed
pnpm install
pnpm --filter @causalops/ingestor build
pnpm --filter @causalops/ingestor db:migrate
pnpm --filter @causalops/api build
pnpm seed:om
pnpm incidents:inject --seed 42

# 4. dev (boots api, web, ingestor, mcp via turbo)
pnpm dev
```

Then open `http://localhost:3000`.

## Reproduce the demo

1. Wait for OM to be healthy (`curl http://localhost:8586/healthcheck`).
2. `pnpm seed:om` — creates 3 services, 5 tables, lineage, DQ tests, PII tags.
3. `pnpm incidents:inject --seed 42` — writes 20 ground-truth incidents.
4. Visit `/why/demo_postgres.default.sales.revenue_view` → click **Run RCA**.
5. Visit `/what-if` → target `orders`, action `drop_column`, column
   `discount_code` → **Simulate**.
6. `pnpm backtest` for the validation numbers, or connect
   `apps/mcp/mcp.config.json` into OpenMetadata's chat or Claude Desktop.

### Claude Desktop MCP config

```json
{
  "mcpServers": {
    "causalops": {
      "command": "node",
      "args": ["<repo>/apps/mcp/dist/server.js"],
      "env": { "API_BASE_URL": "http://localhost:3001" }
    }
  }
}
```

## Theory — what makes this different

See [docs/theory.md](docs/theory.md) for the 2-page primer. In short:

1. **Correlation is not causation in lineage.** Two tests failing at the
   same time are usually downstream of a shared cause, not of each other.
   Recency-based attribution gets this wrong by construction.
2. **Do-calculus is the right algebra.** `P(Y | do(X))` — what happens if I
   set X — is a different quantity than `P(Y | X)`. CausalOps computes the
   former by backdoor adjustment over OM's lineage DAG.
3. **Backdoor + PSM.** We pick the minimal adjustment set (parents of the
   treatment, minus descendants), then match propensity scores between
   treated and untreated buckets. EconML DML kicks in when the adjustment
   set grows past 20 covariates.
4. **Every answer comes with refutation.** Placebo permutation p-value and
   subset stability ship on every evidence panel. "Trust" in the UI is not
   a tone-of-voice decision; it's a weighted function of both numbers.

## Roadmap

- [ ] Column-level DoWhy with SQL-transformation-aware propagation.
- [ ] Time-varying confounders (Granger + synthetic control baseline).
- [ ] Slack + PagerDuty narration channels.
- [ ] Live fit cache invalidation tied to OM webhooks.
- [ ] Multi-tenant deployments + SSO.

## License

Apache 2.0 — see [LICENSE](LICENSE).

## Acknowledgements

- [OpenMetadata](https://open-metadata.org/) and Collate for the catalog
  and lineage substrate.
- [DoWhy](https://www.pywhy.org/dowhy/) + [EconML](https://econml.azurewebsites.net/)
  for the causal-inference plumbing.
- [TimescaleDB](https://www.timescale.com/) for making 30-day event windows
  cheap to query.
- The Model Context Protocol community for making tools-for-LLMs boring.
