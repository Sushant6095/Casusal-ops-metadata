# CausalOps demo — recording script

Read this top-to-bottom on camera. Each block = one shot.
Total runtime: **~3:00**. Screen: 1920×1080. Cursor highlight on.

---

## Pre-flight (do once, off-camera)

```bash
docker compose up -d
# wait ~3 min for OM to be healthy
pnpm install
pnpm --filter @causalops/om-client build
pnpm --filter @causalops/ingestor build
pnpm --filter @causalops/api build
pnpm --filter @causalops/ingestor db:migrate
pnpm seed:om
pnpm incidents:inject --seed 42

# in three terminals:
pnpm --filter @causalops/api start            # :3001
pnpm --filter @causalops/web dev               # :3000
pnpm --filter @causalops/ingestor start        # picks up new events

# tabs to pre-open in Chrome:
#   1. http://localhost:3000           (CausalOps Home)
#   2. http://localhost:3000/why/demo_postgres.default.sales.revenue_view
#   3. http://localhost:3000/what-if?target=demo_postgres.default.sales.orders
#   4. http://localhost:8585           (OpenMetadata)
```

Have your terminal pre-loaded with `pnpm backtest --offline` ready to run.

---

## SHOT 1 · 0:00–0:15 — The hook

**On screen:** OpenMetadata UI (tab 4) showing the failed `revenue_view_row_count` test.

**You say:**
> "It's 3 a.m. Your pipeline broke. OpenMetadata shows you the failure and
> fifteen upstream things that changed in the last day. Which one is the
> cause? Which fourteen are coincidences? You don't know — and the catalog
> can't tell you."

**Action:** Slowly scroll the OM events panel so the viewer sees the noise.

---

## SHOT 2 · 0:15–0:30 — The pitch

**On screen:** Switch to tab 1 (CausalOps Home `/`).

**You say:**
> "CausalOps is a causal-inference layer on top of OpenMetadata. It fits a
> structural causal model on your lineage, your events, and your data quality
> tests. Instead of correlation, it gives you cause — with refutation
> evidence on every claim."

**Action:** Linger on the hero. Hover the **Investigate a failure** CTA so
the cyan glow highlights it. Read the headline aloud:
*"Why did it break — and what breaks if I change this?"*

---

## SHOT 3 · 0:30–1:15 — Demo 1: Counterfactual RCA

**On screen:** Click the top failure in the *Recent failures* list.
URL: `/why/demo_postgres.default.sales.revenue_view`.

**You say (while page loads, ~5s):**
> "I click into the `revenue_view` row-count failure. On the left, every
> upstream event from the last fourteen days. In the middle, the upstream
> lineage graph — the failed entity has the cyan ring."

**Action:** Click the **Run RCA** button.

**You say (while RCA runs, ~3s):**
> "Behind the scenes: the API pulls candidate ChangeEvents on the
> ancestors, calls our Python worker, which runs backdoor adjustment with
> propensity-score matching. Refutation tests fire automatically."

**Action:** Result lands. Click the top-ranked cause to expand the
EvidencePanel.

**You say (point at numbers):**
> "Top suspect: a schema change on `orders.price`, three hours before the
> failure. Effect size 0.83. P(factual) ninety-one percent — given this
> change happened, the test failed nine times out of ten. P(counterfactual)
> seven percent — without it, only seven percent. Ninety-five-percent
> confidence interval [0.68, 0.94]. The placebo p-value is 0.37 and subset
> stability eighty-five percent — the high-confidence badge is honest."

**Action:** Hover the *High confidence* chip to show the tooltip.

> "This isn't 'the most recent thing changed'. This is 'this is the thing
> whose absence would have prevented the failure'. That's the difference
> between correlation and causation."

---

## SHOT 4 · 1:15–2:00 — Demo 2: What-if simulator

**On screen:** Click sidebar → **What-if** (tab 3).

**You say:**
> "Same engine, same DAG, run forward instead of backward. I'm about to drop
> `discount_code` from the `orders` table. Before I merge — what breaks?"

**Action:** Verify the form: target `demo_postgres.default.sales.orders`,
action `drop_column`, column `discount_code`, samples 2000, depth 4.
Click **Simulate**.

**You say (while it runs):**
> "Two thousand Monte Carlo samples through the lineage subgraph,
> column-aware: when an edge is column-level and the column matches, the
> survival probability drops."

**Action:** Result lands. Top-at-risk list visible.

> "Top at risk: `campaign_attribution`, eighty-three percent probability of
> breaking. Path: `orders` → `campaign_attribution`, reason — column
> `discount_code` referenced in join. Marketing-Attribution dashboard is
> next, seventy-one percent. Now I know to patch the join first, drop the
> column second."

**Action:** Hover a downstream node so its glow ring is visible.

---

## SHOT 5 · 2:00–2:20 — Demo 3: MCP inside OpenMetadata

**On screen:** Switch to tab 4 (OpenMetadata UI). Open the chat panel.

**You say:**
> "Same tools, no UI. CausalOps ships as a Model Context Protocol server.
> OpenMetadata's chat — and Claude Desktop — can call it directly."

**Action:** Paste from clipboard:
> *"Rank the upstream causes of today's revenue_view failure."*

Press enter. Wait for response.

**You say (while response renders):**
> "OM's chat invokes the `rank_causes` tool. Same ranked list, same
> evidence numbers, returned as structured content the model can reason
> over. Four tools in total — rank causes, simulate intervention, get risk
> score, list failures."

---

## SHOT 6 · 2:20–2:40 — Back-test validation

**On screen:** Switch to a terminal. Run:

```bash
pnpm backtest --offline
```

**You say (while output scrolls):**
> "We validated this. Twenty ground-truth incidents — ten where the
> upstream change actually caused the downstream failure, and ten where
> they were just coincidental. CausalOps picks the correct cause eighty
> percent of the time at top-1. The naive 'most recent upstream wins'
> baseline succeeds on the causal cases but loses on every confounded one
> — that's the entire point. Top-3 hit rate is one hundred percent. Mean
> reciprocal rank, 0.90."

**Action:** Open `docs/backtest-report.md` in VS Code preview, scroll to
the summary table.

---

## SHOT 7 · 2:40–3:00 — Close

**On screen:** Repo on GitHub (or `README.md` rendered locally).

**You say:**
> "CausalOps. Counterfactual root-cause analysis, interventional
> simulation, and an MCP server — all on top of the OpenMetadata you
> already run. One `docker compose up`, Apache 2.0 licensed. Link in the
> submission. Thank you."

**Action:** Slowly scroll the README hero, then fade.

---

## Recording tips

- Mic at mouth-distance, pop-filter on, room treated.
- Browser zoom 110% so numbers in EvidencePanel are legible at 1080p.
- Hide bookmark bar (`⌘+Shift+B` in Chrome).
- One-Tab so other tabs don't appear.
- Hide `.env` and `node_modules` in the file tree if you record VS Code.
- Record voiceover separately if your speaking voice cracks live —
  capture screen on first take, voice on second, sync in DaVinci.
- Use `cmd+ctrl+space` for cursor highlight on macOS or set CleanShot's
  cursor zoom to follow.

## Failure modes (and on-camera recovery lines)

| If… | Say |
|---|---|
| RCA spinner hangs > 5s | "Causal fits are cached — re-running this would be instant." |
| Worker returns `insufficient_data` | "When we have too few buckets the engine refuses to invent a number — that's a feature." |
| OM chat tool-call errors | "Demo on the web UI — same engine, same numbers, same MCP tools just unwrapped." |
| Web shows "Could not load failures" | "Backend's still warming up — give me one second" → re-click after 3s. |

## What to upload

- 1080p MP4, ≤ 100 MB if possible. Trim to 3:00 sharp.
- Filename: `causalops-demo-3min.mp4`
- Link in README hero (replace `docs/demo.gif`).
- Mirror to YouTube unlisted for hackathon portal.
