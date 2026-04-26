import { Pool } from "undici";
import { logger } from "../logger.js";

export interface RankCausesInput {
  outcome_entity_fqn: string;
  outcome_window: { start: string; end: string };
  candidate_treatments: Array<{
    entity_fqn: string;
    event_type: string;
    timestamp: string;
  }>;
  lookback_days: number;
  outcome_test_case_fqn?: string | undefined;
}

export interface RankedCause {
  treatment: {
    entity_fqn: string;
    event_type: string;
    timestamp: string;
  };
  effect: number;
  p_factual: number;
  p_counterfactual: number;
  confidence_interval: [number, number];
  refutation: { placebo_pvalue: number; subset_stability: number };
  method: string;
  insufficient_data: boolean;
}

export interface RankCausesOutput {
  ranked: RankedCause[];
  lookback_days: number;
  outcome_entity_fqn: string;
}

export interface InterventionInput {
  target_entity_fqn: string;
  action: string;
  action_payload: Record<string, unknown>;
  downstream_depth: number;
  monte_carlo_samples: number;
}

export interface BlastRadiusNode {
  entity_fqn: string;
  p_break: number;
  path: string[];
  reason: string;
}

export interface InterventionOutput {
  blast_radius: BlastRadiusNode[];
  top_at_risk: BlastRadiusNode[];
  samples: number;
}

export interface CausalClient {
  rankCauses(input: RankCausesInput): Promise<RankCausesOutput>;
  intervention(input: InterventionInput): Promise<InterventionOutput>;
  clearCache(): Promise<void>;
}

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export const createCausalClient = (
  baseUrl: string = process.env.CAUSAL_WORKER_URL ?? "http://localhost:8000",
): CausalClient => {
  const pool = new Pool(baseUrl, { connections: 8, bodyTimeout: TIMEOUT_MS });

  const post = async <T>(path: string, body: unknown): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const res = await pool.request({
          path,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          bodyTimeout: TIMEOUT_MS,
          headersTimeout: TIMEOUT_MS,
        });
        const text = await res.body.text();
        if (res.statusCode >= 400) {
          throw new Error(`causal-worker ${res.statusCode}: ${text}`);
        }
        return JSON.parse(text) as T;
      } catch (err) {
        lastErr = err;
        logger.warn({ err, attempt, path }, "causalClient retrying");
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("causalClient failed");
  };

  return {
    rankCauses: (input) => post<RankCausesOutput>("/rank_causes", input),
    intervention: (input) => post<InterventionOutput>("/intervention", input),
    clearCache: async () => {
      await post<unknown>("/cache/clear", {});
    },
  };
};
