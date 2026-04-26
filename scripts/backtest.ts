/**
 * CausalOps back-test.
 * Replays ground-truth incidents through the causal worker (via apps/api)
 * and measures root-cause accuracy against a naive recency baseline.
 *
 * Usage:
 *   pnpm backtest
 *   pnpm backtest -- --api http://localhost:3001
 *   pnpm backtest -- --offline  # skips HTTP, uses deterministic mock
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";

interface GroundTruthEntry {
  id: number;
  label: string;
  seed: number;
  treatmentRef: string;
  treatmentFqn: string;
  treatmentTs: number;
  treatmentKind: string;
  outcomeResultTs: number;
  outcomeFqn: string;
  outcomeTestCaseFqn?: string;
  isCause: boolean;
  timeGapHours: number;
}

interface RankedCauseShape {
  treatment: { entity_fqn: string; event_type: string; timestamp: string };
  effect: number;
  p_factual: number;
  p_counterfactual: number;
  confidence_interval: [number, number];
  refutation: { placebo_pvalue: number; subset_stability: number };
  method: string;
  insufficient_data: boolean;
}

interface RankCausesResponse {
  ranked: RankedCauseShape[];
  candidateCount: number;
  outcomeFqn: string;
}

const GROUND_TRUTH_PATH = resolve(
  process.cwd(),
  "scripts/.incidents-ground-truth.json",
);
const REPORT_PATH = resolve(process.cwd(), "docs/backtest-report.md");

const argFlag = (name: string): string | null => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? "";
};
const hasFlag = (name: string): boolean =>
  process.argv.includes(`--${name}`);

const loadGroundTruth = (): GroundTruthEntry[] => {
  if (!existsSync(GROUND_TRUTH_PATH)) {
    throw new Error(
      `ground-truth file missing at ${GROUND_TRUTH_PATH}. Run \`pnpm incidents:inject\` first.`,
    );
  }
  return JSON.parse(readFileSync(GROUND_TRUTH_PATH, "utf8")) as GroundTruthEntry[];
};

/** Call the real api/causal-worker via HTTP. */
const callApi = async (
  apiBase: string,
  entry: GroundTruthEntry,
): Promise<RankCausesResponse> => {
  const windowEnd = new Date(entry.outcomeResultTs + 3_600_000).toISOString();
  const windowStart = new Date(
    entry.outcomeResultTs - 6 * 3_600_000,
  ).toISOString();
  const body = [
    {
      json: {
        outcomeFqn: entry.outcomeFqn,
        outcomeWindow: { start: windowStart, end: windowEnd },
        lookbackDays: 30,
        ancestorDepth: 4,
      },
    },
  ];
  const res = await fetch(`${apiBase}/trpc/counterfactual.rankCauses?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 0: body[0]!.json }),
  });
  const payload = (await res.json()) as Array<{
    result?: { data?: RankCausesResponse };
    error?: { json?: { message?: string } };
  }>;
  const first = payload[0];
  if (!first?.result?.data) {
    throw new Error(
      `api error: ${first?.error?.json?.message ?? JSON.stringify(first).slice(0, 200)}`,
    );
  }
  return first.result.data;
};

/**
 * Deterministic offline stub. Returns a plausible ranking where the
 * ground-truth cause is #1 ~80% of the time (simulates a ~80% accuracy engine)
 * so CI and dry-runs can exercise the pipeline.
 */
const callOffline = (entry: GroundTruthEntry): RankCausesResponse => {
  const other = `${entry.treatmentFqn}.__noise`;
  const hash = (s: string): number => {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };
  const pickTruthFirst =
    entry.isCause ? hash(entry.label) % 10 > 1 : hash(entry.label) % 10 < 3;
  const first = pickTruthFirst
    ? { fqn: entry.treatmentFqn, effect: 0.82 }
    : { fqn: other, effect: 0.71 };
  const second = pickTruthFirst
    ? { fqn: other, effect: 0.21 }
    : { fqn: entry.treatmentFqn, effect: 0.33 };
  const make = (fqn: string, effect: number): RankedCauseShape => ({
    treatment: {
      entity_fqn: fqn,
      event_type: entry.treatmentKind,
      timestamp: new Date(entry.treatmentTs).toISOString(),
    },
    effect,
    p_factual: Math.min(1, effect + 0.1),
    p_counterfactual: Math.max(0, 0.3 - effect / 3),
    confidence_interval: [Math.max(0, effect - 0.15), Math.min(1, effect + 0.15)],
    refutation: { placebo_pvalue: 0.25, subset_stability: 0.8 },
    method: "mean_difference_fallback",
    insufficient_data: false,
  });
  return {
    ranked: [make(first.fqn, first.effect), make(second.fqn, second.effect)],
    candidateCount: 2,
    outcomeFqn: entry.outcomeFqn,
  };
};

interface PerIncidentResult {
  id: number;
  label: string;
  isCause: boolean;
  truthRank: number; // 0 = not found; 1 = #1
  topCauseFqn: string | null;
  topEffect: number | null;
  baselineTopFqn: string | null;
  causalCorrect: boolean;
  baselineCorrect: boolean;
}

const truthRankIn = (
  ranked: RankedCauseShape[],
  truthFqn: string,
): number => {
  const idx = ranked.findIndex((r) => r.treatment.entity_fqn === truthFqn);
  return idx === -1 ? 0 : idx + 1;
};

/** Naive baseline: most recent upstream ChangeEvent wins. */
const baselinePick = (entry: GroundTruthEntry): string => {
  // Without a live db, we approximate "most recent upstream" by returning the
  // recorded treatment entity — which is what the recency heuristic would
  // always pick on the synthetic data. This is intentionally a weak baseline.
  return entry.treatmentFqn;
};

const fmt = (n: number, digits = 2): string => {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
};

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;

const main = async (): Promise<void> => {
  const entries = loadGroundTruth();
  const offline = hasFlag("offline");
  const apiBase =
    argFlag("api") ?? process.env.API_BASE_URL ?? "http://localhost:3001";

  console.log(
    chalk.cyan(
      `→ backtest ${entries.length} incidents (${offline ? "offline mock" : `api=${apiBase}`})`,
    ),
  );

  const results: PerIncidentResult[] = [];

  for (const entry of entries) {
    let resp: RankCausesResponse;
    try {
      resp = offline ? callOffline(entry) : await callApi(apiBase, entry);
    } catch (err) {
      console.log(
        chalk.red(`  [${entry.id}/${entries.length}] ✗ ${entry.label} — ${(err as Error).message}`),
      );
      results.push({
        id: entry.id,
        label: entry.label,
        isCause: entry.isCause,
        truthRank: 0,
        topCauseFqn: null,
        topEffect: null,
        baselineTopFqn: baselinePick(entry),
        causalCorrect: false,
        baselineCorrect: false,
      });
      continue;
    }

    const ranked = resp.ranked;
    const truthRank = truthRankIn(ranked, entry.treatmentFqn);
    const top = ranked[0];
    const causalCorrect = entry.isCause
      ? truthRank === 1
      : truthRank !== 1 || (top?.effect ?? 0) < 0.2;

    const baselineTop = baselinePick(entry);
    const baselineCorrect = entry.isCause
      ? baselineTop === entry.treatmentFqn
      : baselineTop !== entry.treatmentFqn;

    results.push({
      id: entry.id,
      label: entry.label,
      isCause: entry.isCause,
      truthRank,
      topCauseFqn: top?.treatment.entity_fqn ?? null,
      topEffect: top?.effect ?? null,
      baselineTopFqn: baselineTop,
      causalCorrect,
      baselineCorrect,
    });

    const status = causalCorrect ? chalk.green("✓") : chalk.red("✗");
    console.log(
      `  [${entry.id}/${entries.length}] ${status} rank=${truthRank} top=${top?.treatment.entity_fqn ?? "—"} (effect=${fmt(top?.effect ?? 0)}) — ${entry.label}`,
    );
  }

  // ---- metrics --------------------------------------------------------------
  const trueCausal = results.filter((r) => r.isCause);
  const confounded = results.filter((r) => !r.isCause);

  const rootCauseAccuracy =
    trueCausal.length === 0
      ? 0
      : trueCausal.filter((r) => r.truthRank === 1).length / trueCausal.length;

  const falsePositiveRate =
    confounded.length === 0
      ? 0
      : confounded.filter((r) => r.truthRank === 1).length / confounded.length;

  const mrr =
    trueCausal.length === 0
      ? 0
      : trueCausal.reduce(
          (sum, r) => sum + (r.truthRank > 0 ? 1 / r.truthRank : 0),
          0,
        ) / trueCausal.length;

  const topK = (k: number): number =>
    trueCausal.length === 0
      ? 0
      : trueCausal.filter((r) => r.truthRank > 0 && r.truthRank <= k).length /
        trueCausal.length;

  const baselineAccuracy =
    results.length === 0
      ? 0
      : results.filter((r) => r.baselineCorrect).length / results.length;

  const causalOverall =
    results.length === 0
      ? 0
      : results.filter((r) => r.causalCorrect).length / results.length;

  // ---- report ---------------------------------------------------------------
  const lines: string[] = [];
  lines.push("# CausalOps back-test report");
  lines.push("");
  lines.push(`**Incidents evaluated:** ${results.length}`);
  lines.push(`**True causal:** ${trueCausal.length} · **Confounded:** ${confounded.length}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | CausalOps | Baseline (recency) |");
  lines.push("|--------|-----------|--------------------|");
  lines.push(`| Top-1 accuracy (true causes) | **${pct(rootCauseAccuracy)}** | ${pct(baselineAccuracy)} |`);
  lines.push(`| Top-3 hit rate (true causes) | ${pct(topK(3))} | — |`);
  lines.push(`| Top-5 hit rate (true causes) | ${pct(topK(5))} | — |`);
  lines.push(`| Mean reciprocal rank          | ${fmt(mrr, 3)} | — |`);
  lines.push(`| False-positive rate (confounded wrongly picked) | ${pct(falsePositiveRate)} | — |`);
  lines.push(`| Overall correctness            | ${pct(causalOverall)} | ${pct(baselineAccuracy)} |`);
  lines.push("");
  lines.push("## Per-incident breakdown");
  lines.push("");
  lines.push("| # | Incident | Ground truth | Truth rank | Top (effect) | CausalOps | Baseline |");
  lines.push("|---|----------|--------------|------------|--------------|-----------|----------|");
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${r.label} | ${r.isCause ? "causal" : "confounded"} | ${r.truthRank || "—"} | ${r.topCauseFqn ?? "—"} (${fmt(r.topEffect ?? 0)}) | ${r.causalCorrect ? "✓" : "✗"} | ${r.baselineCorrect ? "✓" : "✗"} |`,
    );
  }
  lines.push("");
  lines.push(
    `_Baseline_ = "most recent upstream ChangeEvent wins". It picks the ground-truth treatment entity every time, so it always "succeeds" on causal incidents and always "fails" on confounded ones — exposing why recency alone is not a causal explanation.`,
  );
  writeFileSync(REPORT_PATH, lines.join("\n") + "\n", "utf8");

  // ---- summary --------------------------------------------------------------
  const headline =
    causalOverall >= 0.7
      ? chalk.bold.green(
          `✓ CausalOps ${pct(causalOverall)} overall accuracy vs ${pct(baselineAccuracy)} baseline`,
        )
      : chalk.bold.yellow(
          `△ CausalOps ${pct(causalOverall)} overall accuracy (< 70% target) vs ${pct(baselineAccuracy)} baseline — tune engine`,
        );
  console.log("");
  console.log(headline);
  console.log(
    chalk.cyan(
      `  top-1=${pct(rootCauseAccuracy)}  top-3=${pct(topK(3))}  MRR=${fmt(mrr, 3)}  FPR=${pct(falsePositiveRate)}`,
    ),
  );
  console.log(chalk.gray(`  report written → ${REPORT_PATH}`));
};

main().catch((err: unknown) => {
  console.error(chalk.red("fatal:"), (err as Error).message);
  process.exit(1);
});
