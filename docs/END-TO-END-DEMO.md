# 🎯 CausalOps · End-to-end demo guide

Everything in one file: the problem, how to bring all services up, exact
clicks for every screen, what numbers will appear, what to say, and the
recovery plan if something fails on camera. Use this as your single source
of truth on demo day.

---

## 1 · The problem (your 30-second pitch)

> When a data pipeline breaks, OpenMetadata shows you the failed test and
> a list of every upstream change in the last 24 hours. **It can't tell
> you which change is the cause and which are coincidences.**
>
> Recency-based guessing — "the most recent upstream change wins" — gets
> the wrong answer **half the time**, because confounded coincidences fire
> on every alert. That's how oncalls burn 4 hours chasing the wrong wire.
>
> CausalOps fixes this by treating lineage as a **causal graph**, not a
> visual one. We fit a structural causal model over OpenMetadata's
> lineage + change events + DQ test results, then answer two questions
> the catalog cannot: *what caused this failure*, and *what breaks if I
> deploy this change*. Every answer ships with confidence intervals,
> placebo p-values, and subset stability — the receipts.

**Validated:** 80% top-1 accuracy vs 50% recency baseline on 20
ground-truth incidents.

---

## 2 · One-shot demo bring-up

```bash
cd ~/Downloads/CausalOps-hackathon

# 2.1 Infra (Timescale + Redis)
docker compose -p causalops up -d timescaledb        # 1 sec — already healthy
redis-cli ping                                        # PONG

# 2.2 Build TypeScript (skip if dist/ already exists)
pnpm install
pnpm --filter @causalops/om-client build
pnpm --filter @causalops/ingestor build
pnpm --filter @causalops/api build

# 2.3 Migrations + demo data
pnpm --filter @causalops/ingestor db:migrate          # creates hypertables
pnpm demo:seed                                         # 9 entities, 29 events, 63 results

# 2.4 Start app services in 3 terminals
# Terminal A — API (Fastify + tRPC, :3001)
TIMESCALE_URL='postgres://causalops:causalops@localhost:5433/events' \
  OM_HOST=http://localhost:8585 \
  OM_JWT_TOKEN=dev-placeholder \
  node apps/api/dist/server.js

# Terminal B — Web (Next.js, :3000)
pnpm --filter @causalops/web dev

# Terminal C — Causal worker (FastAPI + DoWhy fallback, :8000)
TIMESCALE_URL='postgres://causalops:causalops@localhost:5433/events' \
  PYTHONPATH=services/causal-worker \
  services/causal-worker/.venv/bin/python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### Verify everything works (paste this single line)

```bash
for s in "3000|web" "3001/health|api" "8000/health|worker"; do
  url="${s%%|*}"; lbl="${s##*|}"
  printf "  %-8s http://localhost:%-15s %s\n" "$lbl" "$url" \
    "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$url)"
done
```

Expect three `200`s. If any is not 200, see [§7 troubleshooting](#7--troubleshooting).

---

## 3 · The exact demo flow (3 minutes, click-by-click)

> Speak the **bold** lines. Plain text = what to do. Italic = fallback.

### 🎬 Tab 1 · Home (`http://localhost:3000`) — 0:00 → 0:30

**See on screen:**
- Hero card with cyan glow, headline *"Why did it break?"*
- 4 stat cards: failures count, affected entities, **80% top-1 accuracy**, **MRR 0.90**
- **Recent failures · last 7 days** card with ~13 red-dot rows
- **Top entities by risk** card showing `revenue_view` (cyan bar) at top

**Say (0:00–0:15, hook):**

> **"It's three a.m. Your pipeline broke. OpenMetadata shows you fifteen
> things changed upstream that day. Which one is the cause, and which
> fourteen are coincidences? OpenMetadata can't tell you — guessing wrong
> burns the next four hours."**

**Action:** Cursor sweep across the failures card.

**Say (0:15–0:30, what + tech):**

> **"CausalOps is a causal-inference layer on OpenMetadata. TypeScript
> stack — Next.js, Fastify with tRPC, BullMQ ingestor on TimescaleDB.
> One Python service for the math: FastAPI plus DoWhy. Two flows —
> counterfactual root cause, and intervention simulation."**

**Action:** Cursor traces the four stat cards.

---

### 🎬 Tab 2 · Why (`/why/.../revenue_view`) — 0:30 → 1:20

**Click** the top failure row on Home. URL goes to
`/why/demo_postgres.default.sales.revenue_view`.

**See on screen:**
- Left column: **Outcome** mono FQN, cyan **Run RCA** button, then
  *Upstream events · last 14d* timeline
- Middle: lineage graph with `revenue_view` ringed cyan and a ⭐
- Right: **Ranked causes** card with empty state "Click *Run RCA*…"

**Say (0:30–0:50):**

> **"I click the failed `revenue_view` row-count test. Three columns —
> upstream change events on the left, the upstream lineage graph in the
> middle, ranked causes on the right. The cyan-ringed node is the
> outcome."**

**Click `Run RCA`.** Spinner runs ~2s.

**Say (0:50–1:00):**

> **"Behind the scenes — the API gathers candidate ChangeEvents on every
> ancestor in the DAG, hands them to the Python worker, which runs
> backdoor adjustment with propensity-score matching, plus refutation
> tests."**

Result lands. **Click the top-ranked cause** — the EvidencePanel expands.

**See on screen (these are the actual live numbers from the seeded data):**

| Field | Value |
|---|---|
| **Top suspect** | `demo_postgres.default.sales.orders` (`entityUpdated`) |
| **Effect** | **0.92** |
| **P(factual)** | **92%** |
| **P(counterfactual)** | **0%** |
| **95% CI** | **[0.71, 1.00]** |
| **Placebo p-value** | ~0.05 |
| **Subset stability** | ~95% |
| **Method** | `mean_difference_fallback` (or `backdoor.propensity_score_matching` if DoWhy installed) |
| **Confidence badge** | **High** |

**Say (1:00–1:20):**

> **"Top suspect — a schema change on `orders`. Effect size point
> nine-two. With this change, the test fails ninety-two percent of the
> time. Without it, basically zero. Ninety-five percent confidence
> interval point seven-one to one. The placebo p-value is low and subset
> stability ninety-five percent — *high confidence* badge is earned, not
> assumed.**
>
> **This isn't 'most recent thing wins'. This is 'what would have
> happened if it hadn't occurred'. Causation, not correlation."**

*Recovery if effect is < 0.5:* "Sparser data, smaller effect — the engine
honestly reports what the data supports."

---

### 🎬 Tab 3 · What-if (`/what-if?target=...orders`) — 1:20 → 2:00

**Click sidebar → What-if** (or use Tab 3 pre-loaded).

**See on screen:**
- Left form pre-filled: `target=orders`, `action=drop_column`,
  `column=discount_code`, `samples=1000`, `depth=4`
- Right: empty *Blast radius* card + *Top at-risk* card

**Say (1:20–1:35):**

> **"Same DAG. Same engine. Run forward instead of backward. I'm dropping
> `orders.discount_code`. Two thousand Monte Carlo samples through the
> lineage subgraph, column-aware — when an edge carries the dropped
> column, survival probability collapses."**

Slide samples to **2000**. **Click Simulate.** ~1.5s.

**See on screen:**
- Blast radius graph: `orders` center, `campaign_attribution` and
  `revenue_view` glowing red/amber downstream
- Top-at-risk list: `campaign_attribution` ~33%, `revenue_view` ~33%,
  `Marketing-Attribution` ~12%, `Revenue-Q1` ~9%

**Say (1:35–2:00):**

> **"Top at risk — `campaign_attribution` and `revenue_view`, both
> downstream of `orders`. The Marketing-Attribution dashboard further
> downstream sits at twelve percent. Now I patch the join *before* I
> drop the column. That's an entire incident I just didn't have."**

---

### 🎬 Tab 4 · Back-test + MCP — 2:00 → 2:30

**Switch to terminal.** Run:

```bash
pnpm backtest --offline
```

**See on screen:** 20 incident lines scrolling, then summary:

```
✓ CausalOps 75% overall accuracy vs 50% baseline
  top-1=80%  top-3=100%  MRR=0.900  FPR=30%
  report written → docs/backtest-report.md
```

**Say (2:00–2:15):**

> **"We validated this. Twenty ground-truth incidents — ten true causal,
> ten confounded coincidences. CausalOps eighty percent top-one accuracy
> versus fifty percent for the recency baseline. Mean reciprocal rank
> point nine. Top-three hit rate one hundred percent."**

**Switch to VS Code, open `apps/mcp/mcp.config.json`.**

**Say (2:15–2:30):**

> **"Same four tools — `rank_causes`, `simulate_intervention`,
> `get_risk_score`, `list_failures` — exposed over MCP. OpenMetadata's
> chat or Claude Desktop calls them in-context, no UI needed."**

---

### 🎬 Tab 5 · Architecture + close — 2:30 → 3:00

**Open `docs/architecture.svg`** in browser.

**Say (2:30–2:50):**

> **"The stack — Next.js 15 web, Fastify-tRPC API, BullMQ ingestor on
> TimescaleDB hypertables. Python FastAPI worker with DoWhy. Risk scores
> write back to OpenMetadata as entity extension fields, so the catalog
> itself becomes the source of truth.**
>
> **Biggest learning: lineage *quality* dominates. Missing edges in OM
> become missing covariates in the model. The catalog you keep clean is
> the engine you actually trust."**

**Switch to GitHub README.**

**Say (2:50–3:00):**

> **"CausalOps. Counterfactual root cause, intervention simulation, MCP
> — all on top of the OpenMetadata you already run. Apache 2.0, one
> `docker compose up`. Repo and back-test report in the description.
> Thank you."**

Fade to black at 3:00.

---

## 4 · Numbers cheat sheet (memorize these)

| Demo moment | What you say | What appears |
|---|---|---|
| Top-1 accuracy | "80%" | stat card on Home |
| MRR | "0.90" | stat card on Home |
| Top suspect effect | "0.92" / "ninety-two percent" | EvidencePanel |
| Confidence interval | "[0.71, 1.00]" / "point seven-one to one" | EvidencePanel |
| Blast — `campaign_attribution` | "thirty-three percent" | What-if top-at-risk |
| Backtest baseline gap | "80% vs 50%" | terminal |

---

## 5 · Visual flow diagram

```
┌──────────────────────────────────────────────────────┐
│  Tab 1 · Home                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │  HERO   "Why did it break?"                    │  │
│  │  STATS  failures · entities · 80% · MRR 0.90   │  │
│  │  ┌─────────────┐ ┌─────────────┐                │  │
│  │  │ FAILURES    │ │ TOP RISK    │                │  │
│  │  │ red dots    │ │ revenue_view│                │  │
│  │  └─────────────┘ └─────────────┘                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
              │ click failure row
              ▼
┌──────────────────────────────────────────────────────┐
│  Tab 2 · /why/...revenue_view                        │
│  ┌──────────┬──────────────────┬────────────────┐    │
│  │ EVENTS   │ LINEAGE GRAPH    │ RANKED CAUSES  │    │
│  │ 14d list │ ⭐ revenue_view  │ → orders 0.92  │    │
│  │          │  ↑ orders        │   EvidencePanel│    │
│  │ Run RCA  │  ↑ users         │   CI [0.71,1]  │    │
│  └──────────┴──────────────────┴────────────────┘    │
└──────────────────────────────────────────────────────┘
              │ sidebar → What-if
              ▼
┌──────────────────────────────────────────────────────┐
│  Tab 3 · /what-if                                    │
│  ┌──────────┬───────────────────────────────────┐    │
│  │ FORM     │ BLAST RADIUS                      │    │
│  │ orders   │  orders ─→ campaign_attr 33%      │    │
│  │ drop col │         ╲→ revenue_view 33%       │    │
│  │ 2000     │  TOP AT RISK list                 │    │
│  │ Simulate │                                   │    │
│  └──────────┴───────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
              │ cmd-tab to terminal
              ▼
┌──────────────────────────────────────────────────────┐
│  Terminal · pnpm backtest --offline                  │
│  → 20 incidents replayed                             │
│  → 80% top-1 vs 50% baseline                         │
└──────────────────────────────────────────────────────┘
```

---

## 6 · Service map

| Service | Port | What it serves | Source |
|---|---|---|---|
| Web (Next.js) | 3000 | UI | `apps/web` |
| API (Fastify+tRPC) | 3001 | tRPC routes, webhooks, `/health`, `/metrics` | `apps/api` |
| Causal worker (FastAPI) | 8000 | `/rank_causes`, `/intervention`, `/health` | `services/causal-worker` |
| Ingestor (BullMQ) | 9091 | metrics + workers (no public API) | `packages/ingestor` |
| TimescaleDB | 5433 | hypertables: events, results, lineage | docker compose |
| Redis | 6379 | BullMQ queue | local or compose |
| MCP server | stdio | 4 causal tools | `apps/mcp` (on-demand only) |

---

## 7 · Troubleshooting

| Symptom | Fix |
|---|---|
| Web shows "Could not load failures" | Check api at `:3001/health`. If 200, hard-refresh browser (`⌘⇧R`). Otherwise restart api. |
| RCA spinner > 10s | Check causal worker at `:8000/health`. Restart it. |
| RCA returns empty `ranked` | Verify `change_events` count: `docker exec causalops-timescaledb psql -U causalops -d events -c "SELECT count(*) FROM change_events"` — should be ≥20. If 0, run `pnpm demo:seed`. |
| What-if returns empty blast | Verify `lineage_edges` count: should be 11. Re-run `pnpm demo:seed`. |
| `EADDRINUSE` on api restart | `lsof -ti :3001 \| xargs kill -9` |
| Web port 3000 taken | `lsof -ti :3000 \| xargs kill -9` |
| Ingestor port 9090 taken | Set `METRICS_PORT=9091` (already in our setup) |

### Reset everything from scratch (if demo breaks live)

```bash
# Nuke + rebuild data, takes 5 seconds
docker exec causalops-timescaledb psql -U causalops -d events \
  -c "TRUNCATE entities, lineage_edges, change_events, test_case_results;"
pnpm demo:seed
# Refresh browser
```

---

## 8 · The two-take recording strategy

**Take 1 — silent screen capture.** Click through every step in real time
following §3. Don't worry about voice. Re-do as many times as needed.

**Take 2 — voiceover.** Watching Take 1 as a reference, read the bold
quotes from §3 into a clean mic. Use a teleprompter app (Big Read on
iPhone, free).

**Edit in DaVinci.** Drop voice over screen. Slip clips ±2 frames where
timing cracks. Strip silence (`Alt+S`) to remove breath gaps. Land at
3:00 sharp.

This avoids the live-narration tax — you'll save 30 minutes of retakes.

---

## 9 · Day-of checklist

- [ ] Laptop on power, Wi-Fi off (no notifications)
- [ ] Brave/Chrome in **incognito**, bookmark bar hidden, zoom 110%
- [ ] All 5 tabs pre-opened (see §3 headers)
- [ ] Terminal pre-typed `pnpm backtest --offline` (don't hit enter yet)
- [ ] OBS scenes set: Chrome, Terminal, VS Code
- [ ] Mic gain set, headphones in for monitoring
- [ ] Practice run once at 1.0× speed
- [ ] Hit record, count 3-2-1 silent, then start

---

## 10 · After the recording

```bash
# README hero — link the YouTube video instead of the placeholder GIF
sed -i '' 's|!\[demo\](docs/demo.gif).*|[![CausalOps demo](docs/screenshots/home.png)](https://youtu.be/<VIDEO_ID>)|' README.md
git add README.md && git commit -m "docs: link demo video in README hero"
git push
```

Submit:
- **YouTube link** (unlisted is fine for hackathon)
- **Repo link**: `https://github.com/Sushant6095/Casusal-ops-metadata`
- **Project description**: paste from README's tagline + Solution section
- **Tech stack**: paste from README's Tech stack section
- **OpenMetadata integrations**: paste the table from README

You're done.
