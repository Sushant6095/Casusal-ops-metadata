<div align="center">

# 🧬 CausalOps

### Causal inference, not correlation, on top of OpenMetadata.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596be?logo=trpc&logoColor=white)](https://trpc.io/)
[![DoWhy](https://img.shields.io/badge/DoWhy-0.11-7c3aed)](https://www.pywhy.org/dowhy/)
[![OpenMetadata](https://img.shields.io/badge/OpenMetadata-1.5.13-22c55e)](https://open-metadata.org/)
[![Hackathon](https://img.shields.io/badge/Hackathon-OpenMetadata-22D3EE)]()

**[Live demo](#-the-product) · [Architecture](#-architecture) · [Back-test results](#-back-test-results) · [Quickstart](#-quickstart) · [MCP integration](#-mcp-integration)**

</div>

---

## 🎯 The problem

> *It's 3 a.m. Your pipeline broke. OpenMetadata shows you fifteen things that changed upstream that day. Which one is the cause? Which fourteen are coincidences?*

OpenMetadata gives you **lineage + a list of events**. It cannot answer *why*. So oncalls fall back to **"the most recent upstream change wins"** — a heuristic that gets the wrong answer **half the time**, because confounded coincidences fire on every alert. That's how teams burn 4 hours chasing the wrong wire.

## ✨ The solution

CausalOps adds a **causal-inference layer** on top of OpenMetadata. It treats lineage as a **causal graph**, fits a **structural causal model** over your change events and DQ test results, and answers two questions the catalog cannot:

| Question | Flow | Algorithm |
|---|---|---|
| **Why did this fail?** | Counterfactual RCA | Backdoor adjustment + propensity-score matching |
| **What breaks if I deploy this?** | Intervention simulation | Monte-Carlo forward propagation |

Every answer ships with **placebo p-values, subset stability, and 95% confidence intervals** — so you can tell a confident model from a correct one.

> 🏆 **Validated:** 80% top-1 accuracy vs 50% recency baseline on 20 ground-truth incidents.

---

## 📸 The product

### Home — failures + risk at a glance

<p align="center"><img width="1465" height="786" alt="Screenshot 2026-04-26 at 11 15 24 PM" src="https://github.com/user-attachments/assets/5846618d-6a62-4d66-ab80-1f72cd96b1fb" /></p>

> Dark-mode dashboard with a gradient-mesh background. The hero card frames the value prop. Four stat cards expose key health metrics. Recent failures stream in on the left; entities ranked by risk on the right. Hit *Investigate a failure* to drop into RCA, or *Simulate a change* to forecast blast radius.

---

### Graph — lineage as a causal DAG

<p align="center"><img width="1465" height="786" alt="Screenshot 2026-04-26 at 11 15 35 PM" src="https://github.com/user-attachments/assets/5ebdb861-80c1-4f2e-8eb9-be3ab9fee100" /></p>

> Force-directed DAG with risk-coloured nodes. The cyan-ringed `revenue_view` is the entity in focus. `campaign_attribution` glows red (risk 0.71), `Marketing-Attribution` glows amber (risk 0.62). Filter by entity type, scrub the time window, click any node for owner / risk score / action buttons.

---

### What-if — interventional blast radius

<p align="center"><img width="1465" height="786" alt="Screenshot 2026-04-26 at 11 15 49 PM" src="https://github.com/user-attachments/assets/09535127-d469-4430-9df0-b02f11008cb7" /></p>

> Pre-fill target entity, action (`drop_column`), and column. Slide Monte-Carlo samples up to 5000. The simulator runs forward propagation through the causal subgraph and returns per-asset breakage probabilities. The path column shows *why* — `discount_code referenced in join`, etc.

---

## 🎬 Demo video

3-minute walkthrough: **[YouTube](#)** _(paste link after upload)_

---

## 📊 Back-test results

> The model is only as good as its validation. We injected **20 ground-truth incidents** — 10 true causal pairs and 10 confounded coincidences — and replayed them through both CausalOps and a naive recency baseline.

| Metric | CausalOps | Baseline (most-recent-wins) |
|---|---|---|
| **Top-1 accuracy** *(true causes)* | **80%** | 50% |
| Top-3 hit rate *(true causes)* | **100%** | — |
| Mean reciprocal rank | **0.900** | — |
| False-positive rate *(confounded picked)* | 30% | 100% |
| **Overall correctness** | **75%** | 50% |

Reproduce the back-test:

```bash
pnpm incidents:inject --seed 42
pnpm backtest
```

---

## 🏗️ Architecture

![Architecture](docs/architecture.svg)

| Layer | Service | Tech |
|---|---|---|
| **Source of truth** | OpenMetadata | OM 1.5.13 — lineage, events, DQ, tags |
| **Stream ingest** | `packages/ingestor` | BullMQ + Drizzle + postgres-js |
| **Storage** | TimescaleDB | 1-day hypertable chunks for events + results |
| **Causal engine** | `services/causal-worker` | FastAPI · DoWhy · EconML · NetworkX |
| **API** | `apps/api` | Fastify 5 + tRPC 11 + Zod |
| **Web** | `apps/web` | Next.js 15 + React 19 + D3 + Tailwind |
| **MCP** | `apps/mcp` | @modelcontextprotocol/sdk · stdio + SSE |

---

## 🔌 OpenMetadata integration

| Endpoint | Purpose | Code path |
|---|---|---|
| `GET /lineage/table/name/{fqn}` | Build the causal DAG | [`pollLineage.ts`](packages/ingestor/src/jobs/pollLineage.ts) |
| `GET /events` | Collect treatments (schema/owner/tag/desc changes) | [`pollEvents.ts`](packages/ingestor/src/jobs/pollEvents.ts) |
| `GET /dataQuality/testCases/testCaseResults` | Collect outcomes (DQ failures) | [`pollTestResults.ts`](packages/ingestor/src/jobs/pollTestResults.ts) |
| `PUT /lineage` | Seed column-level lineage in demos | [`seed-om.ts`](scripts/seed-om.ts) |
| `PATCH /tables/name/{fqn}` *(JSON Patch)* | Write **risk score + top cause** back to entity `extension` | [`omWriteBack.ts`](apps/api/src/services/omWriteBack.ts) |
| `POST /webhook/om` *(receiver)* | Live-ingest OM ChangeEvents | [`omEvents.ts`](apps/api/src/webhooks/omEvents.ts) |
| `POST /events/subscriptions` | Register CausalOps as an OM subscription target | [`webhook.ts`](packages/om-client/src/webhook.ts) |

---

## 🚀 Run it yourself

A fork-friendly guide. Follow top-to-bottom; takes ~10 min on a warm cache, ~20 min cold (image pulls + npm + pip).

### 1 · Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Docker Desktop** | 24+ | <https://docs.docker.com/desktop> |
| **Node.js** | 20 LTS | `nvm install 20` or <https://nodejs.org> |
| **pnpm** | 9.14.4 | `corepack enable && corepack prepare pnpm@9.14.4 --activate` |
| **Python** | 3.12 | `brew install python@3.12` (macOS) · `apt install python3.12 python3.12-venv` (Debian/Ubuntu) |
| **Git** | any recent | preinstalled on macOS / `apt install git` |

Hardware: **8 GB RAM minimum** (OpenMetadata + OpenSearch + Postgres + Redis is hungry). 16 GB if you also run a browser + IDE.

### 2 · Fork + clone

1. Click **Fork** at the top-right of <https://github.com/Sushant6095/Casusal-ops-metadata>
2. Clone your fork:

```bash
git clone https://github.com/<your-username>/Casusal-ops-metadata.git CausalOps
cd CausalOps
```

### 3 · Configure environment

```bash
cp .env.example .env
```

Open `.env` in your editor. Defaults work for local dev — only **two** values may need changing:

| Variable | When to change | How to get it |
|---|---|---|
| `OM_JWT_TOKEN` | Only if you want full OM round-trip (lineage poll, risk write-back). Skip for the no-OM-token demo path. | OM UI → Settings → Bots → `ingestion-bot` → Reveal Token |
| `OPENAI_API_KEY` | Only if you want LLM narration in the EvidencePanel | <https://platform.openai.com/api-keys> · `gpt-4o-mini` is enough |

Everything else (`TIMESCALE_URL`, `REDIS_URL`, `CAUSAL_WORKER_URL`, ports) already points at the local Docker stack.

### 4 · Pick a path

#### 🅰 No-OM-token path (fastest, recommended for first run)

Bypasses OpenMetadata entirely — `pnpm demo:seed` writes 9 entities, 29 events, and 63 DQ results straight into TimescaleDB. Lets you see the full UI working in ~5 min.

```bash
# Start only the infra you need (skip OM)
docker compose up -d timescaledb postgres redis

# Install + build packages
pnpm install
pnpm --filter @causalops/om-client build
pnpm --filter @causalops/ingestor build
pnpm --filter @causalops/api build

# Create Timescale schema + populate demo data
pnpm --filter @causalops/ingestor db:migrate
pnpm demo:seed
```

#### 🅱 Full OM integration

Boots the full stack. Adds ~5 min for OM cold-start.

```bash
docker compose up -d                              # everything
# wait for OM to be healthy (~3 min)
curl -fs http://localhost:8586/healthcheck && echo OK

pnpm install
pnpm --filter @causalops/om-client build
pnpm --filter @causalops/ingestor build
pnpm --filter @causalops/api build
pnpm --filter @causalops/ingestor db:migrate

# Now seed OM with demo entities + 20 ground-truth incidents
pnpm seed:om
pnpm incidents:inject --seed 42
# Wait ~2 min for the ingestor to poll OM and populate Timescale
```

### 5 · Set up the Python causal worker

```bash
cd services/causal-worker
python3.12 -m venv .venv
.venv/bin/pip install fastapi 'uvicorn[standard]' asyncpg pydantic numpy pandas networkx scikit-learn
# Optional heavy deps for production-grade inference:
# .venv/bin/pip install dowhy econml causal-learn
cd ../..
```

### 6 · Run the four services

Open **4 terminals**, run one command in each:

```bash
# Terminal 1 — API (Fastify + tRPC, port 3001)
TIMESCALE_URL='postgres://causalops:causalops@localhost:5433/events' \
OM_HOST=http://localhost:8585 \
OM_JWT_TOKEN="${OM_JWT_TOKEN:-dev-placeholder}" \
node apps/api/dist/server.js

# Terminal 2 — Web (Next.js, port 3000)
pnpm --filter @causalops/web dev

# Terminal 3 — Causal worker (FastAPI, port 8000)
TIMESCALE_URL='postgres://causalops:causalops@localhost:5433/events' \
PYTHONPATH=services/causal-worker \
services/causal-worker/.venv/bin/python -m uvicorn src.main:app --host 0.0.0.0 --port 8000

# Terminal 4 (Path B only) — Ingestor
METRICS_PORT=9091 \
REDIS_URL=redis://localhost:6379 \
TIMESCALE_URL='postgres://causalops:causalops@localhost:5433/events' \
OM_HOST=http://localhost:8585 \
OM_JWT_TOKEN="$OM_JWT_TOKEN" \
node packages/ingestor/dist/index.js
```

### 7 · Verify it's running

```bash
for s in 3000 3001/health 8000/health; do
  printf "  %-15s %s\n" "$s" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$s)"
done
```

All three should print `200`. Then open <http://localhost:3000> — you should see real failures, a populated graph, and 80% top-1 accuracy in the stat cards.

### 8 · Try the demos

| Goal | Steps |
|---|---|
| **See ranked causes for a failure** | Click any red row on Home → click **Run RCA** on the next page |
| **Forecast blast radius** | Sidebar → **What-if** → fill `discount_code` → **Simulate** |
| **Run the back-test** | `pnpm backtest` (Path B) or `pnpm backtest --offline` (Path A) — should print `80% top-1 vs 50% baseline` |
| **MCP from Claude Desktop** | Build with `pnpm --filter @causalops/mcp build`, then paste the [Claude Desktop config](#claude-desktop-config) below into `~/Library/Application Support/Claude/claude_desktop_config.json` |

### 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE :3001` | Another process owns the port: `lsof -ti :3001 \| xargs kill -9` |
| Web shows "Could not load failures" | Check api/worker are up. Hard-refresh browser (`⌘⇧R`). |
| RCA returns empty `ranked` | TimescaleDB has no events yet — re-run `pnpm demo:seed` |
| OM health check fails | OpenMetadata cold-start takes up to 3 min. Run `docker logs openmetadata-server -f` to watch progress. |
| `Could not find a declaration file for module '@causalops/om-client'` | Stale tsbuildinfo — `rm -rf packages/*/dist apps/*/dist **/tsconfig.tsbuildinfo` then re-run build chain |
| Port `9090` collision (ingestor metrics) | Set `METRICS_PORT=9091` (already in the example above) |
| `pnpm demo:seed` fails on `relation "entities" does not exist` | Run `pnpm --filter @causalops/ingestor db:migrate` first |

### Reset everything

```bash
docker compose down -v                       # nukes all volumes
rm -rf node_modules packages/*/dist apps/*/dist apps/web/.next
pnpm install
# then start over from step 4
```

---

## 🎩 MCP integration

CausalOps exposes 4 tools over the Model Context Protocol — callable from OpenMetadata's chat panel **or** any MCP client.

| Tool | What it does |
|---|---|
| `rank_causes` | Counterfactual RCA on a failed outcome |
| `simulate_intervention` | Blast-radius forecast for a proposed change |
| `get_risk_score` | Read CausalOps risk score from OM extension |
| `list_failures` | Recent DQ failures within a window |

### Claude Desktop config

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

### OpenMetadata MCP host config

See [`apps/mcp/mcp.config.json`](apps/mcp/mcp.config.json) — paste into OM Settings → Integrations → MCP Servers.

---

## 🧠 Theory — what makes this different

1. **Correlation ≠ causation in lineage.** Two tests failing at the same time are usually downstream of a *shared* cause, not of each other. Recency-based attribution gets this wrong by construction.
2. **Do-calculus is the right algebra.** `P(Y | do(X))` is a different quantity than `P(Y | X)`. CausalOps computes the former by **backdoor adjustment** over OM's lineage DAG.
3. **Backdoor + propensity score matching.** We pick the minimal adjustment set (parents of the treatment, minus descendants), then match propensity scores between treated and untreated time-buckets. EconML's Double-ML kicks in when the adjustment set grows past 20 covariates.
4. **Refutation is non-negotiable.** Placebo permutation p-value + subset stability ship on every estimate. *Confidence in the UI* is a weighted function of both, not a tone-of-voice decision.

---

## 📂 Repository structure

```
CausalOps-hackathon/
├── apps/
│   ├── api/                 # Fastify + tRPC backend
│   ├── web/                 # Next.js 15 dashboard
│   └── mcp/                 # Model Context Protocol server
├── packages/
│   ├── om-client/           # Typed OpenMetadata REST wrapper (zod + axios)
│   └── ingestor/            # BullMQ workers + Drizzle schema
├── services/
│   └── causal-worker/       # FastAPI + DoWhy + EconML
├── scripts/
│   ├── seed-om.ts           # Seed OM with demo entities + lineage
│   ├── inject-incidents.ts  # 20 ground-truth (treatment, outcome) pairs
│   ├── demo-seed-timescale.ts # No-OM-token demo seed
│   └── backtest.ts          # Validation harness
├── docs/
│   ├── architecture.svg     # System diagram
│   └── screenshots/         # Product screenshots
├── docker-compose.yml
└── README.md
```

---

## 🗺️ Roadmap

- [ ] Column-level DoWhy with SQL-transformation-aware propagation
- [ ] Time-varying confounders (Granger + synthetic control as additional baselines)
- [ ] Slack + PagerDuty narration channels — push the causal explanation to the on-call before they open a tab
- [ ] Live cache invalidation tied to OM webhooks
- [ ] Multi-tenant deployments + SSO

---

## 📝 License

[Apache 2.0](LICENSE) — use it, fork it, ship it.

## 🙏 Acknowledgements

- [**OpenMetadata**](https://open-metadata.org/) and **Collate** — the catalog and lineage substrate.
- [**DoWhy**](https://www.pywhy.org/dowhy/) and [**EconML**](https://econml.azurewebsites.net/) for the causal-inference plumbing.
- [**TimescaleDB**](https://www.timescale.com/) — 30-day event windows at low cost.
- **Model Context Protocol** — for the tool-calling spec.

---

<div align="center">

**Built for the OpenMetadata × Collate hackathon.**

⭐ Star the repo · [Open an issue](https://github.com/Sushant6095/Casusal-ops-metadata/issues)

</div>
