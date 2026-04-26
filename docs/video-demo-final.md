# CausalOps · final 3-minute demo video

The ready-to-record script. Read the **bold** lines on camera, plain text is
direction. Time-coded to the second. Every fallback line is in *italics*.

> Total: **3:00** sharp · Speaking pace: 145 wpm · ~430 words

---

## 🎬 Pre-flight checklist (do once, off camera)

```bash
# 1. Infra
docker ps | grep timescale     # confirm causalops-timescaledb is healthy
redis-cli ping                  # confirm Redis is up

# 2. Demo data — fastest path, no OM dependency
pnpm demo:seed
# expect: ✓ 9 entities  ✓ 11 lineage edges  ✓ 20 change events  ✓ 55 test results

# 3. Bring up services (if not already running)
node apps/api/dist/server.js &                                  # :3001
pnpm --filter @causalops/web dev &                              # :3000
/Users/vyapar/Downloads/CausalOps-hackathon/services/causal-worker/.venv/bin/python \
  -m uvicorn src.main:app --host 0.0.0.0 --port 8000 &          # :8000

# 4. Smoke test (run last)
curl -s http://localhost:3000   -o /dev/null -w "web    %{http_code}\n"
curl -s http://localhost:3001/health  -o /dev/null -w "api    %{http_code}\n"
curl -s http://localhost:8000/health  -o /dev/null -w "worker %{http_code}\n"
# all three must say 200
```

### Browser tabs in this exact order

1. http://localhost:3000 (CausalOps Home)
2. http://localhost:3000/graph?root=demo_postgres.default.sales.revenue_view
3. http://localhost:3000/why/demo_postgres.default.sales.revenue_view
4. http://localhost:3000/what-if?target=demo_postgres.default.sales.orders
5. README.md on GitHub: `https://github.com/Sushant6095/Casusal-ops-metadata`

### Recording setup

| Setting | Value |
|---|---|
| Resolution | 1920×1080 |
| FPS | 30 |
| Browser zoom | 110% |
| Hide bookmark bar | `⌘⇧B` |
| Cursor highlight | CleanShot or `⌘⌃⌥4` macOS |
| Mic | Lav or USB condenser, pop-filter |
| Tool | OBS Studio · scene 1: Chrome only · scene 2: terminal · scene 3: VS Code |

---

# 🎙️ THE SCRIPT

## 0:00 → 0:15 · Hook (15s)

**Tab 1 · Home page** — start here. The hero card with cyan glow is the
opener. Don't click anything yet.

> **"It's three a.m. Your data pipeline broke. OpenMetadata shows you
> fifteen things that changed upstream that day. Which one is the cause?
> Which fourteen are coincidences? OpenMetadata can't tell you — and
> guessing wrong costs you the next four hours."**

Action: Slow cursor sweep across the **Recent failures** card so the red
dots and timestamps register. Land on the *Causal engine online* badge.

---

## 0:15 → 0:30 · What it is + tech (15s)

> **"CausalOps is a causal-inference layer on top of OpenMetadata. It fits
> a structural causal model on your lineage, your change events, and your
> data quality tests — TypeScript everywhere, plus one Python service for
> DoWhy. Two flows: counterfactual root-cause and intervention simulation."**

Action: Cursor traces the four stat cards: failures, affected entities,
top-1 accuracy 80%, MRR 0.90. Linger 0.3s on each.

---

## 0:30 → 1:20 · Demo 1 · Counterfactual RCA (50s)

**Click the top failure row.** Page navigates to `/why/...revenue_view`.

> **"Click the failed `revenue_view` row-count test. Three columns —
> upstream events on the left, the lineage graph in the middle, ranked
> causes on the right."**

Pause 1 second on the cyan-ringed `revenue_view` node in the graph.

> **"The cyan-ringed node is the outcome. Now run the engine."**

**Click `Run RCA`.** While the spinner is up:

> **"Behind the scenes — the API gathers candidate ChangeEvents on every
> ancestor in the DAG, hands them to the Python worker. The worker runs
> backdoor adjustment with propensity-score matching, plus refutation
> tests."**

Result lands. **Click the top cause** to expand the EvidencePanel.

> **"Top suspect — a schema change on `orders.price` three hours before the
> failure. Effect size point eight three. With this change, the test fails
> ninety-one percent of the time. Without it, only seven. Ninety-five
> percent confidence interval point six eight to point nine four. Placebo
> p-value point three seven, subset stability eighty-five percent. The
> *high confidence* badge is earned, not assumed."**

> **"This isn't 'most recent thing wins'. This is the answer to 'what
> would have happened without it'. Causation, not correlation."**

*Recovery if RCA returns insufficient_data:* "When buckets are sparse the
engine refuses to invent a number — that's a feature, not a bug."

---

## 1:20 → 1:55 · Demo 2 · What-if simulator (35s)

**Sidebar → What-if** (Tab 4 already loaded with `target=orders`).

> **"Same DAG. Same engine. Run forward instead of backward."**

Form is pre-filled. Confirm settings: action `drop_column`, column
`discount_code`, samples `2000`, depth `4`. **Click Simulate.**

While Monte Carlo runs (~1.5s):

> **"I'm dropping `orders.discount_code`. Two thousand Monte Carlo samples
> through the lineage subgraph, column-aware — when an edge carries the
> dropped column, survival probability collapses."**

Result lands. Cursor on the top-at-risk row.

> **"`campaign_attribution` lights up at eighty-three percent — the
> column's referenced in a join. `Marketing-Attribution` dashboard
> downstream, seventy-one percent. Now I patch the join *before* I drop
> the column. That's an entire incident I just didn't have."**

---

## 1:55 → 2:15 · Demo 3 · MCP + back-test (20s)

Cut to a terminal.

```bash
pnpm backtest --offline
```

While output scrolls:

> **"We validated this. Twenty ground-truth incidents — ten true causal,
> ten confounded coincidences. CausalOps hits eighty percent top-one
> accuracy. The 'most recent upstream' baseline gets fifty. That's the
> entire point of the engine."**

Briefly switch to a tab showing `apps/mcp/mcp.config.json` open in VS Code:

> **"Same four tools — `rank_causes`, `simulate_intervention`,
> `get_risk_score`, `list_failures` — exposed over MCP. OpenMetadata's
> chat or Claude Desktop can call them in-context."**

---

## 2:15 → 2:40 · Architecture + learning (25s)

Cut to **`docs/architecture.svg`** open in browser.

> **"The stack — Next.js 15 web, Fastify-tRPC API, BullMQ ingestor on
> TimescaleDB hypertables. Python FastAPI worker with DoWhy for the
> backdoor estimator. Risk scores write back to OpenMetadata as entity
> extension fields, so the catalog itself becomes the source of truth."**

Cut briefly to README "Roadmap" section.

> **"Biggest learning: lineage *quality* dominates. Missing edges in OM
> become missing covariates in the model — the catalog you keep clean is
> the engine you actually trust. Next up: column-level DoWhy, time-varying
> confounders, and Slack narration."**

---

## 2:40 → 3:00 · Close (20s)

Cut to GitHub README hero.

> **"CausalOps. Counterfactual root cause, intervention simulation, MCP —
> all on top of the OpenMetadata you already run. Apache 2.0, one
> `docker compose up`. Repo and back-test report linked below. Thanks for
> watching."**

Slow zoom on the hero, fade to black at exactly 3:00.

---

## 🛟 Failure-mode recovery lines

| If… | Say (in voice, no panic) |
|---|---|
| Spinner > 5s | *"Causal fits cache — re-running this would be instant."* |
| RCA returns 0 ranked causes | *"Sparse bucket — engine refuses to invent. That's by design."* |
| Web shows "Could not load" | *"Backend's still warming"* — wait 3s, click again |
| MCP tab doesn't load | Skip it, continue with backtest segment |
| What-if returns empty blast | *"Disconnected node — DAG isolates protect each other."* |

---

## 📊 Word + timing budget

| Section | Words | Time | Cumulative |
|---|---|---|---|
| Hook | 38 | 0:15 | 0:15 |
| What + tech | 42 | 0:15 | 0:30 |
| Demo 1 (RCA) | 145 | 0:50 | 1:20 |
| Demo 2 (What-if) | 80 | 0:35 | 1:55 |
| Demo 3 (backtest + MCP) | 60 | 0:20 | 2:15 |
| Architecture + learning | 70 | 0:25 | 2:40 |
| Close | 35 | 0:20 | 3:00 |
| **Total** | **~470 words** | **3:00** | |

Speaking @ 156 wpm — natural-fast. If you record voice separately and
overlay on screen capture (the recommended path), trim breath gaps in
DaVinci to land at 3:00 exactly.

---

## 📤 Post-recording checklist

- [ ] Trim head and tail to exactly 0:00–3:00 in DaVinci
- [ ] Add 1-frame hold at frame 1 for thumbnail
- [ ] Loudness normalize to −16 LUFS (YouTube standard)
- [ ] Export H.264 1080p, 8 Mbps target → ≤ 100 MB
- [ ] Filename: `causalops-3min-final.mp4`
- [ ] Upload to YouTube, **Unlisted**, title = *"CausalOps — causal RCA on OpenMetadata (3-min hackathon demo)"*
- [ ] Description: paste the README's tagline + 3-bullet feature list + repo link
- [ ] Paste YouTube URL into the hackathon portal field
- [ ] Update README hero: replace `docs/demo.gif` with `[![demo](docs/screenshots/home.png)](https://youtu.be/<id>)`
- [ ] Push the commit

---

## 🎯 Two-take strategy (recommended)

1. **Take 1** — silent screen capture only. Click through everything in
   real time. Don't worry about voice.
2. **Take 2** — voiceover only, watching take 1 as reference. Read this
   doc on a teleprompter (Big Read app, free) at 145 wpm.
3. **Editing** — drop voice over screen, slip clips ±2 frames where the
   timing cracks, kill 70% of breath gaps with strip silence (DaVinci
   shortcut: `Alt+S`).

This avoids the live-narration tax — you'll save 30 minutes of retakes.
