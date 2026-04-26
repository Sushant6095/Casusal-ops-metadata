import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import type { ToolResult } from "./types.js";

export const simulateInterventionInput = {
  targetFqn: z.string(),
  action: z.enum([
    "drop_column",
    "rename_column",
    "change_type",
    "remove_source",
  ]),
  actionPayload: z.record(z.unknown()).optional(),
  downstreamDepth: z.number().int().min(1).max(8).default(4),
  monteCarloSamples: z.number().int().min(100).max(5000).default(1000),
} as const;

const InputSchema = z.object(simulateInterventionInput);

export const simulateInterventionDescription =
  "Simulate the downstream blast radius of a proposed change to a data entity in OpenMetadata. Returns probability of failure per downstream asset.";

export const simulateIntervention = async (
  api: ApiClient,
  raw: unknown,
): Promise<ToolResult> => {
  const input = InputSchema.parse(raw);
  const res = await api.intervention.simulate.mutate({
    targetFqn: input.targetFqn,
    action: input.action,
    actionPayload: input.actionPayload ?? {},
    downstreamDepth: input.downstreamDepth,
    monteCarloSamples: input.monteCarloSamples,
  });

  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const header =
    res.blastRadius.length === 0
      ? `No downstream breakage predicted for ${input.action} on "${input.targetFqn}".`
      : `Blast radius for ${input.action} on "${input.targetFqn}" (${res.samples} MC samples): ${res.blastRadius.length} downstream assets at risk.`;

  const lines = res.topAtRisk.map((n, i) =>
    `${i + 1}. ${n.entity_fqn}  p_break=${pct(n.p_break)}  path=${n.path.join(" → ")}\n   reason: ${n.reason}`,
  );

  return {
    content: [
      { type: "text", text: [header, "", ...lines].join("\n") },
    ],
    structuredContent: {
      blastRadius: res.blastRadius,
      topAtRisk: res.topAtRisk,
      samples: res.samples,
    },
  };
};
