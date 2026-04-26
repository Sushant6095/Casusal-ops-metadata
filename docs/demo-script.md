# CausalOps — 3-minute demo voiceover

Target length: 3:00. Record in 1920×1080, 30fps, OBS Studio. Mic: lav or
USB condenser, pop-filter on. Cursor highlight on.

Environment before recording:
- `docker compose up -d` + OM healthy
- `pnpm seed:om` + `pnpm incidents:inject --seed 42` already run
- `pnpm dev` running (api, ingestor, web)
- Browser tabs pre-opened: `/`, `/graph`, `/why/...revenue_view`, `/what-if`,
  OM chat with CausalOps MCP connected

---

## 0:00 – 0:15 · Hook
**Voiceover:** "Your pipeline broke at 3 a.m. Fifteen upstream things
changed that day. Which one is the cause — and which one just happened to
fire at the same time?"

**On screen:** Split-screen. Left: OM dashboard showing a red failed
`revenue_view_row_count` test. Right: an events timeline with 15 upstream
ChangeEvents in the last 24h, all flashing red in sequence.

**Recording note:** Open the split with `⌘+Shift+T` tab-group preset.
Zoom the timeline to 150% so viewers can read event types.

---

## 0:15 – 0:30 · Pitch
**VO:** "CausalOps adds a causal-inference layer on top of OpenMetadata.
It answers two questions the catalog alone cannot: which upstream event
actually caused this failure, and if I deploy this change — what breaks
downstream?"

**On screen:** CausalOps home page (`/`). Left: FailureList. Right: top-10
risk bar chart. Cursor hovers over "Investigate a failure" CTA.

**Recording note:** Cursor settles on the top failure row — but don't
click yet.

---

## 0:30 – 1:15 · Demo 1 · Counterfactual RCA
**VO:** "Click the failure. Three seconds of causal fit later — done. The
top suspect isn't the most recent event; it's the one whose removal would
have prevented the failure. Effect size 0.83, high-confidence refutation:
placebo shuffle kills the signal, subset stability holds."

**On screen:**
1. Click the `revenue_view` failure → navigate to `/why/...`.
2. Left column: 14-day upstream events.
3. Middle: upstream-only graph, `revenue_view` pulsing cyan with a ⭐.
4. Click "Run RCA" button.
5. Right column fills in 2 seconds with a ranked list.
6. Expand top cause → EvidencePanel with effect=0.83, CI [0.68, 0.94],
   placebo p=0.37, stability=85%, method=backdoor.propensity_score_matching.
7. Narration paragraph ("The schema change on orders.price…").

**Recording note:** Pause 1.5s on the EvidencePanel so the CI numbers are
legible. Narrate slowly here — this is the core slide.

---

## 1:15 – 2:00 · Demo 2 · Intervention simulator
**VO:** "Same engine, run in reverse. I'm about to drop
`orders.discount_code`. Before I merge, what does the causal model predict
will break?"

**On screen:**
1. Navigate to `/what-if`.
2. Target: `demo_postgres.default.sales.orders`.
3. Action: `drop_column`, column `discount_code`.
4. Samples: slide to 2000.
5. Click Simulate.
6. Blast radius graph: `campaign_attribution` lights up red
   (p_break 83%), `Marketing-Attribution` dashboard amber (p_break 71%).
7. Top-at-risk list shows the path `orders → campaign_attribution →
   Marketing-Attribution` with "column referenced in join" reason.

**VO continues:** "Eighty-three percent probability the marketing
attribution table breaks. Path: discount_code used in a join. I now know
to patch the pipeline first, drop the column second."

**Recording note:** The animation on the Monte Carlo is short — don't
linger on the spinner.

---

## 2:00 – 2:20 · Demo 3 · MCP inside OpenMetadata
**VO:** "Same tools, no UI. CausalOps ships as an MCP server that
OpenMetadata's chat calls directly."

**On screen:**
1. Switch to OM UI → AI chat panel.
2. Type: *"Rank the upstream causes of today's revenue_view failure."*
3. Chat responds with the structured ranked list identical to the web UI.
4. Zoom on the "rank_causes" tool-call trace in OM's chat debugger.

**Recording note:** Pre-type the prompt into the clipboard; paste with
`⌘V` so it lands instantly.

---

## 2:20 – 2:40 · Back-test validation
**VO:** "We validated this. Twenty ground-truth incidents, ten true causes
and ten confounded coincidences. CausalOps picks the correct cause 80% of
the time. Recency — 'most recent upstream wins' — wins on the causal ones,
loses on every confounded one. That's the whole point."

**On screen:**
- Terminal: `pnpm backtest --offline` output scrolling.
- Transition to `docs/backtest-report.md` rendered in GitHub preview.
- Highlight the summary table row: **80% top-1 vs 50% baseline**.

**Recording note:** Pre-run the backtest; record its output separately
so you can speed up the scroll in post.

---

## 2:40 – 3:00 · Close
**VO:** "CausalOps — counterfactual root cause, interventional simulation,
and MCP, all plugged into OpenMetadata you already run. Apache-licensed,
deployable with one `docker compose up`. Link in the submission."

**On screen:**
- README hero on GitHub.
- Zoom out to full repo tree.
- Fade to CausalOps wordmark (cyan dot + "CausalOps") on #0B1220.

**Recording note:** End on exactly 3:00.0 — trim tail in DaVinci.
