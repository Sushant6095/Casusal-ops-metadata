import { z } from "zod";
import type { ApiClient } from "../apiClient.js";
import type { ToolResult } from "./types.js";

export const listFailuresInput = {
  windowHours: z.number().int().min(1).max(24 * 30).default(24),
  limit: z.number().int().min(1).max(100).default(20),
} as const;

const InputSchema = z.object(listFailuresInput);

export const listFailuresDescription =
  "List recent data quality failures captured from OpenMetadata within the given window.";

export const listFailures = async (
  api: ApiClient,
  raw: unknown,
): Promise<ToolResult> => {
  const input = InputSchema.parse(raw);
  const res = await api.failures.listRecent.query({
    windowHours: input.windowHours,
    limit: input.limit,
  });

  const sinceIso = new Date(res.since as unknown as string | number | Date).toISOString();
  const header = res.failures.length
    ? `${res.failures.length} failure(s) in the last ${input.windowHours}h (since ${sinceIso}).`
    : `No failures in the last ${input.windowHours}h.`;

  const lines = res.failures.map(
    (f, i) =>
      `${i + 1}. ${f.entityFqn}\n   test: ${f.testCaseFqn}\n   at:   ${new Date(f.timestamp).toISOString()}`,
  );

  return {
    content: [
      { type: "text", text: [header, "", ...lines].join("\n") },
    ],
    structuredContent: {
      failures: res.failures,
      since: res.since,
      count: res.failures.length,
    },
  };
};
