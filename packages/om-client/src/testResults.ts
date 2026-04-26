import type { OmClient } from "./client.js";
import { TestCaseResultSchema, type TestCaseResult } from "./types.js";
import { z } from "zod";

export interface ListTestResultsOptions {
  testCaseFqn?: string;
  startTs: number;
  endTs: number;
  limit?: number;
}

const ResultListSchema = z.object({
  data: z.array(TestCaseResultSchema).default([]),
});

/** List test case results in the given time window. */
export async function listTestCaseResults(
  client: OmClient,
  opts: ListTestResultsOptions,
): Promise<TestCaseResult[]> {
  const res = await client.http.get(
    "/dataQuality/testCases/testCaseResults",
    {
      params: {
        testCaseFQN: opts.testCaseFqn,
        startTs: opts.startTs,
        endTs: opts.endTs,
        limit: opts.limit ?? 100,
      },
    },
  );
  const parsed = ResultListSchema.parse(
    Array.isArray(res.data) ? { data: res.data } : res.data,
  );
  return parsed.data;
}

/** Convenience: test results with status Failed in the last N days. */
export async function listFailingTests(
  client: OmClient,
  windowDays: number,
): Promise<TestCaseResult[]> {
  const endTs = Date.now();
  const startTs = endTs - windowDays * 86_400_000;
  const all = await listTestCaseResults(client, { startTs, endTs, limit: 1000 });
  return all.filter((r) => r.testCaseStatus === "Failed");
}
