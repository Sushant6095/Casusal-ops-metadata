import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import type { ToolResult } from "./types.js";

export const rankCausesInput = {
  outcomeFqn: z
    .string()
    .describe("Fully qualified name of the failing entity"),
  outcomeWindowStart: z.string().datetime(),
  outcomeWindowEnd: z.string().datetime(),
  lookbackDays: z.number().int().min(1).max(90).default(30),
  topK: z.number().int().min(1).max(20).default(5),
} as const;

const InputSchema = z.object(rankCausesInput);
export type RankCausesInput = z.infer<typeof InputSchema>;

export const rankCausesDescription =
  "Rank likely upstream causes of a data quality failure in OpenMetadata using causal inference. Returns effect size, factual and counterfactual probabilities, and refutation scores.";

export const rankCauses = async (
  api: ApiClient,
  raw: unknown,
): Promise<ToolResult> => {
  const input = InputSchema.parse(raw);
  const res = await api.counterfactual.rankCauses.mutate({
    outcomeFqn: input.outcomeFqn,
    outcomeWindow: {
      start: input.outcomeWindowStart,
      end: input.outcomeWindowEnd,
    },
    lookbackDays: input.lookbackDays,
    ancestorDepth: 3,
  });

  const top = res.ranked.slice(0, input.topK);
  const header = top.length
    ? `Ranked ${top.length} causes of "${input.outcomeFqn}" (${res.candidateCount} candidates evaluated).`
    : `No causes could be ranked for "${input.outcomeFqn}".`;

  const lines = top.map((c, i) => {
    const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
    return `${i + 1}. ${c.treatment.entity_fqn} [${c.treatment.event_type}]
   effect=${c.effect.toFixed(2)}  p_factual=${pct(c.p_factual)}  p_counterfactual=${pct(c.p_counterfactual)}
   95% CI=[${c.confidence_interval[0].toFixed(2)}, ${c.confidence_interval[1].toFixed(2)}]
   refutation: placebo p=${c.refutation.placebo_pvalue.toFixed(2)}, subset stability=${pct(c.refutation.subset_stability)}
   method=${c.method}${c.insufficient_data ? "  [insufficient_data]" : ""}`;
  });

  const text = [
    header,
    ...(res.narration ? ["", res.narration] : []),
    "",
    ...lines,
  ].join("\n");

  return {
    content: [{ type: "text", text }],
    structuredContent: { ranked: top, narration: res.narration ?? null },
  };
};
