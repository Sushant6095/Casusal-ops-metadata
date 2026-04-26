import { logger } from "../logger.js";
import type { RankedCause } from "./causalClient.js";

/** Optional: narrate a causal ranking in plain English. No-op if no API key. */
export const narrateRanking = async (
  outcomeFqn: string,
  ranked: RankedCause[],
): Promise<string | null> => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || ranked.length === 0) return null;
  const top = ranked[0]!;

  const prompt = `You explain data-platform failures in 2 short lines.
Outcome (failed): ${outcomeFqn}
Top suspected cause: ${top.treatment.entity_fqn} (${top.treatment.event_type})
Causal effect estimate: ${top.effect.toFixed(2)} (p_factual=${top.p_factual.toFixed(2)}, p_counterfactual=${top.p_counterfactual.toFixed(2)})
Refutation: placebo p-value ${top.refutation.placebo_pvalue.toFixed(2)}, subset stability ${top.refutation.subset_stability.toFixed(2)}
Method: ${top.method}

Write 2 lines. First: the likely cause. Second: why the refutation is (un)convincing.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 120,
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "narrator http failed");
      return null;
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    logger.warn({ err }, "narrator errored — ignoring");
    return null;
  }
};
