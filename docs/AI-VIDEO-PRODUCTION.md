# 🎬 CausalOps · AI-generated demo video — production kit

A turnkey package for producing a 3-minute hackathon demo without filming.
Feed the script into a TTS engine, the visuals into a screen recorder or
AI generator, then assemble in a free editor. Total time: **~30 min**.

---

## 📦 What you'll produce

| Asset | Length | Tool |
|---|---|---|
| Voiceover MP3 | 2:55 | ElevenLabs / OpenAI TTS |
| Screen capture clips | 7 segments, ~25s each | OBS / CleanShot X / Loom |
| Optional AI avatar | inset bubble | HeyGen / Synthesia (skip for cleaner look) |
| Background music | bed under voice | YouTube Audio Library (free) |
| Captions | auto from voiceover | Captions.ai or DaVinci's auto-subtitle |
| Final MP4 | 3:00 sharp | DaVinci Resolve (free) or CapCut |

---

## 🎙️ Voiceover script (TTS-ready)

Designed for **ElevenLabs "Adam"** or **OpenAI tts-1 "onyx"**. Reads in
~2:55 at default speed. Punctuation tuned so TTS pauses correctly.

```
=== SECTION 1 — THE HOOK (15 seconds) ===

It's three a.m. Your data pipeline broke. OpenMetadata shows you
fifteen things that changed upstream that day. Which one is the cause?
Which fourteen are coincidences? OpenMetadata can't tell you... and
guessing wrong burns the next four hours.

=== SECTION 2 — ABOUT THE PROJECT (25 seconds) ===

This is CausalOps. A causal-inference layer on top of OpenMetadata.

Instead of treating lineage as a visual graph, we treat it as a causal
graph, and fit a structural causal model on your change events and
data-quality test results. The result: two flows that OpenMetadata
alone cannot offer. Counterfactual root cause analysis — what actually
caused this failure. And interventional simulation — what breaks if I
deploy this change.

=== SECTION 3 — TECH STACK AND ARCHITECTURE (30 seconds) ===

The stack: a TypeScript monorepo. Next.js fifteen on the front end.
Fastify with tRPC on the API. A BullMQ ingestor pumping OpenMetadata
data into TimescaleDB hypertables. And one focused Python service —
FastAPI plus DoWhy and EconML — for the causal estimator.

The data flow: OpenMetadata feeds the ingestor. The ingestor projects
change events, lineage, and DQ results into TimescaleDB. The Python
worker fits a structural causal model on that. The API serves both the
web UI and a Model Context Protocol server. So OpenMetadata's chat,
or Claude Desktop, can call our four causal tools directly.

=== SECTION 4 — THE DEMO (75 seconds) ===

Here's the home dashboard. Recent failures on the left, top entities by
risk on the right. Eighty percent top-one accuracy. Mean reciprocal
rank zero point nine.

I click into the failed revenue-view test. Three columns: upstream
events, the lineage graph with the failed entity ringed in cyan, and
ranked candidate causes on the right. I hit Run R-C-A.

Top suspect: a schema change on orders dot price, three hours before
the failure. Effect size zero point nine two. With this change, the
test fails ninety-two percent of the time. Without it, basically zero.
Ninety-five percent confidence interval is point seven one to one.
The placebo p-value and subset stability earn the high-confidence
badge. This is causation, not correlation.

Now the what-if simulator. I'm dropping orders dot discount-code. Two
thousand Monte Carlo samples through the lineage subgraph. Top at risk:
campaign-attribution and revenue-view, both downstream. The Marketing
Attribution dashboard further out, twelve percent. So I patch the join
before I drop the column. That's an entire incident I just didn't have.

=== SECTION 5 — VALIDATION (20 seconds) ===

We validated this. Twenty ground-truth incidents — ten true causal,
ten confounded coincidences. CausalOps eighty percent top-one
accuracy. The naive most-recent-upstream baseline: fifty percent.
That's the entire point of the engine.

=== SECTION 6 — LEARNING AND GROWTH (20 seconds) ===

Biggest learning: lineage quality dominates everything. Missing edges
in OpenMetadata become missing covariates in the causal model — which
silently biases estimates upward. The catalog you keep clean is the
engine you actually trust. Coming next: column-level causal graphs,
Slack narration, and time-varying confounders.

=== SECTION 7 — CLOSE (10 seconds) ===

CausalOps. Counterfactual root cause, intervention simulation, MCP —
all on top of the OpenMetadata you already run. Apache two point oh.
Repository link in the description. Thank you.
```

**Word count:** ~470 · **Reading time at 150wpm:** 2:55 · **TTS cost:** ~$0.40 on ElevenLabs, ~$0.04 on OpenAI tts-1

---

## 🎨 Visual storyboard

Number maps to script section. Each scene is **one continuous clip** — no
cuts within a scene, just smooth screen recording.

| § | Time | Visual | Capture method |
|---|---|---|---|
| 1 | 0:00–0:15 | Slow zoom on OpenMetadata UI showing red failed test + 15 events scrolling | Screen-record OM at `localhost:8585` for 20s, then trim |
| 2 | 0:15–0:40 | Cut to CausalOps Home page. Cursor sweeps the hero, then the four stat cards | Record `localhost:3000`, slow cursor movement |
| 3 | 0:40–1:10 | `docs/architecture.svg` rendered fullscreen, then pan across the diagram | Open SVG in browser at full window, screenshot/scroll |
| 4 | 1:10–2:25 | Three sub-clips:<br/>• 0:10s on `/why/.../revenue_view` clicking Run RCA<br/>• 0:15s on the EvidencePanel showing 0.92 effect, CI, refutation<br/>• 0:30s on `/what-if` form fill + Simulate + blast radius | Three screen records, cut together |
| 5 | 2:25–2:45 | Terminal showing `pnpm backtest --offline` output, then `docs/backtest-report.md` table | Record terminal, then markdown preview |
| 6 | 2:45–3:00 | README.md hero on GitHub, scrolling slowly to the roadmap | Record `https://github.com/Sushant6095/...` |
| 7 | 2:50–3:00 | Slow zoom on README, fade to black on the wordmark | Same recording, end frame |

---

## 🛠️ Tool stack

### TTS voiceover (pick one)

**Option A · OpenAI TTS** *(cheapest, ~$0.04, best quality-per-dollar)*
```bash
pip install openai
python3 <<'EOF'
from openai import OpenAI
client = OpenAI()  # uses OPENAI_API_KEY env
with open("script.txt") as f: text = f.read()
resp = client.audio.speech.create(model="tts-1-hd", voice="onyx", input=text)
resp.stream_to_file("voiceover.mp3")
EOF
```

Voices to try: `onyx` (deep, confident — recommended), `nova` (warm), `echo` (neutral).

**Option B · ElevenLabs** *(more natural, ~$0.40)*
1. Sign up at <https://elevenlabs.io/> (free 10k chars/month)
2. Voice library → pick "Adam" or "Antoni"
3. Paste script → Generate → download MP3
4. Set stability: 50, similarity: 75, style: 30 for natural delivery

**Option C · macOS built-in** *(free, robotic)*
```bash
say -v Daniel -o voiceover.aiff -f script.txt
ffmpeg -i voiceover.aiff voiceover.mp3
```
Only use if you have zero budget — sounds like a 2010 GPS.

### Screen captures

**OBS Studio** *(free, recommended)*
- Scene 1: Browser only, 1920×1080
- Scene 2: Terminal only
- Scene 3: VS Code only
- Hotkey scene-switching for clean cuts
- Output: `mkv` then convert to `mp4` with ffmpeg

**CleanShot X** *(macOS, $29 once, easiest)*
- ⌘⇧5 → Record screen → highlight cursor → done

**Captions.app** *(macOS, simplest)*
- Imports your voiceover MP3
- Generates AI avatar reading it OR uses your screen capture
- Auto-captions burn in
- Best if you want zero editing

### Background music

YouTube Audio Library: <https://www.youtube.com/audiolibrary>

Search filters: **Genre = Cinematic**, **Mood = Inspirational**,
**Duration = 3:00–4:00**. Recommendations:

| Track | Vibe | Why |
|---|---|---|
| "Solitude" — Asher Fulero | Sparse piano | Opens cleanly, sustains under voice |
| "First Light" — Patrick Patrikios | Building synth | Matches the "we built this" tone |
| "Phoenix" — Slynk (instrumental) | Chill electronic | Modern tech-product feel |

Set music gain at **−18dB** under voice (so dialog stays primary).

### Editor

**DaVinci Resolve** *(free, professional)*
- Import voiceover.mp3 to track A1
- Drop screen-capture clips on V1
- Music on A2 at −18dB
- Auto-captions: Workspace → Captions → Generate from Audio Track A1
- Export: H.264, 1080p, 8 Mbps target

**CapCut Desktop** *(free, easier)*
- Same workflow, fewer pro features
- Auto-captions are excellent

---

## ⚡ The 30-minute assembly workflow

```bash
# === MINUTE 0–5 ===
# 1. Generate voiceover MP3
echo "<paste script>" > script.txt
python3 -c "..."   # OpenAI TTS one-liner above

# === MINUTE 5–20 ===
# 2. Record 7 screen-capture clips matching the storyboard
#    Use the END-TO-END-DEMO.md as click-by-click reference.
#    Don't worry about timing perfectly — you'll match to voiceover later.
#
#    pnpm demo:seed   # ensure data is fresh
#    open the 4 browser tabs
#    record each scene as a separate file:
#       scene1-om.mov, scene2-home.mov, scene3-arch.mov,
#       scene4a-rca.mov, scene4b-evidence.mov, scene4c-whatif.mov,
#       scene5-backtest.mov, scene6-readme.mov

# === MINUTE 20–28 ===
# 3. Drop into DaVinci/CapCut
#    - voiceover on A1 (locked)
#    - clips on V1, slip to align with the script section markers
#    - music on A2, gain -18dB
#    - generate captions from A1
#    - add 0.5s fade-in / fade-out at top and tail

# === MINUTE 28–30 ===
# 4. Export
#    Settings: H.264, MP4, 1920×1080, 30fps, 8 Mbps avg, AAC audio 192kbps
#    Filename: causalops-3min-final.mp4
#    Duration target: 2:58–3:00
```

---

## 🎬 Optional · AI avatar inset

If you want a talking-head bubble in the corner (like a YouTube reaction
overlay), use **HeyGen**:

1. <https://heygen.com> → free trial
2. Upload your voiceover MP3
3. Pick an avatar (Daniel, Sofia, etc.)
4. Generate → 1080p MP4 of avatar speaking
5. In DaVinci, drop on V2 layer at top-right corner, scale 25%

**Skip this if your screen capture is busy.** The bubble can distract.
For a hackathon demo, screen + voiceover is plenty.

---

## 🎯 Polish tips that 5x the perceived quality

1. **Add a 1-second branded title card at frame 1.** Just the CausalOps
   wordmark on the dark gradient bg. Frame-1 is what YouTube uses for the
   thumbnail.
2. **Mute the music for 2 seconds** during the most important number
   ("effect size zero point nine two"). Silence makes numbers stick.
3. **Subtle zoom on every static shot.** DaVinci → Edit → enable
   "Dynamic Zoom" on each clip. 1.0 → 1.05 over the duration. Costs
   nothing, looks alive.
4. **Burn in captions** even though YouTube auto-generates them. People
   watch on mute.
5. **Loud, then quiet ending.** Last 5 seconds: music drops out, just the
   voice over the silent README zoom. More memorable than music-out fade.
6. **Don't use stock B-roll.** Resist the urge. Real screen captures
   beat any "data center with glowing servers" stock clip.

---

## 📤 Upload checklist

- [ ] Title: **CausalOps — Causal RCA on OpenMetadata · 3-min demo**
- [ ] Description (paste this):

```
CausalOps adds a causal-inference layer on top of OpenMetadata.

Counterfactual root-cause analysis: which upstream change actually
caused this failure (not just what happened around the same time).
Interventional simulation: what breaks downstream if you deploy this
change. Every answer ships with refutation evidence — placebo
p-values, subset stability, 95% confidence intervals.

Validated: 80% top-1 accuracy vs 50% recency baseline on 20
ground-truth incidents.

🔗 Repo: https://github.com/Sushant6095/Casusal-ops-metadata
🔧 Stack: Next.js 15, Fastify + tRPC, TimescaleDB, FastAPI + DoWhy, MCP
📜 Apache 2.0 — one `docker compose up`

Built for the OpenMetadata × Collate hackathon.

Chapters:
0:00 The problem
0:15 What CausalOps is
0:40 Architecture
1:10 Demo · Counterfactual RCA
1:55 Demo · What-if simulator
2:25 Backtest validation
2:45 Learnings + roadmap
2:50 Close
```

- [ ] Thumbnail: capture frame 1 (the title card) → upload as 1280×720 JPG
- [ ] Visibility: **Unlisted** (judges get the link, not the public)
- [ ] Tags: `openmetadata`, `causal-inference`, `data-engineering`, `mcp`, `hackathon`
- [ ] Add YouTube link to README hero (`![demo](docs/demo.gif)` → `[![demo](docs/screenshots/home.png)](https://youtu.be/<id>)`)
- [ ] Paste link into hackathon submission portal

---

## 💡 If you have ZERO time (10-minute version)

1. Generate voiceover on OpenAI TTS — 2 minutes
2. Single screen recording of you clicking through the 4 pages following
   `END-TO-END-DEMO.md`, no narration, no editing — 5 minutes
3. In CapCut, drop voiceover on top of screen recording, slip-align
   roughly, add auto-captions, export — 3 minutes

Done. Won't win style points but covers all four rubric items and lands
under 3 minutes.

---

## 🚫 Things I cannot do for you

- Render the actual MP4 (text-only assistant)
- Provide a voiceover voice clip (no TTS execution here)
- Click through your live screen
- Pay for the TTS / video tools

But the script, storyboard, tool choices, and assembly steps in this
file are everything you need. The most expensive part — figuring out
*what* to record and *what* to say — is done.
