import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import type { ToolResult } from "./types.js";

export const getRiskScoreInput = {
  fqn: z.string(),
} as const;

const InputSchema = z.object(getRiskScoreInput);

export const getRiskScoreDescription =
  "Get the current CausalOps-computed risk score for an entity. Reads the OM entity's causalOps extension fields written by the API after each RCA.";

type EntityExtension = {
  causalOpsRiskScore?: number;
  causalOpsTopCause?: string;
  causalOpsLastAnalysis?: string;
};

export const getRiskScore = async (
  api: ApiClient,
  raw: unknown,
): Promise<ToolResult> => {
  const input = InputSchema.parse(raw);
  const res = await api.graph.getEntity.query({ fqn: input.fqn });
  const entity = res.entity as
    | { raw?: { extension?: EntityExtension } | null }
    | null;
  const ext = entity?.raw?.extension ?? {};
  const score = ext.causalOpsRiskScore ?? null;
  const cause = ext.causalOpsTopCause ?? null;
  const at = ext.causalOpsLastAnalysis ?? null;

  const text =
    entity == null
      ? `Entity not found: ${input.fqn}`
      : score == null
        ? `No CausalOps risk score recorded yet for ${input.fqn}. Run rank_causes first.`
        : `Risk score for ${input.fqn}: ${(score * 100).toFixed(0)}%\nTop cause: ${cause ?? "unknown"}\nLast analysis: ${at ?? "unknown"}`;

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      fqn: input.fqn,
      found: entity != null,
      riskScore: score,
      topCause: cause,
      lastAnalysis: at,
    },
  };
};
