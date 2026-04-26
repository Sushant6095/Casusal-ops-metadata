import { sql } from "drizzle-orm";
import {
  listTestCaseResults,
  type OmClient,
  type TestCaseResult,
} from "@causalops/om-client";
import type { Db } from "../db/client.js";
import { testCaseResults, type NewTestCaseResult } from "../db/schema.js";
import { getCursor, setCursor } from "../cursors.js";
import { eventsTotal, errorsTotal, lagSeconds } from "../metrics.js";
import { logger } from "../logger.js";

const BATCH = 500;

const entityFqnFromTestCase = (fqn: string): string => {
  const parts = fqn.split(".");
  return parts.slice(0, -1).join(".");
};

const synthId = (r: TestCaseResult): string =>
  `${r.testCaseFQN ?? "unknown"}@${r.timestamp}`;

const toRow = (r: TestCaseResult): NewTestCaseResult => ({
  id: synthId(r),
  timestamp: new Date(r.timestamp),
  testCaseFqn: r.testCaseFQN ?? "unknown",
  entityFqn: entityFqnFromTestCase(r.testCaseFQN ?? "unknown"),
  status: r.testCaseStatus,
  resultValue: (r.testResultValue ?? null) as Record<string, unknown> | null,
  raw: r as unknown as Record<string, unknown>,
});

export interface PollTestResultsOutcome {
  inserted: number;
  newCursor: Date;
}

/** Poll OM testCaseResults since cursor, upsert, advance cursor. */
export const pollTestResults = async (
  db: Db,
  client: OmClient,
): Promise<PollTestResultsOutcome> => {
  const cursor = await getCursor(db, "test_results");
  try {
    const results = await listTestCaseResults(client, {
      startTs: cursor.getTime(),
      endTs: Date.now(),
      limit: 1000,
    });
    if (results.length === 0) {
      return { inserted: 0, newCursor: cursor };
    }
    const rows = results.map(toRow);
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await db
        .insert(testCaseResults)
        .values(batch)
        .onConflictDoUpdate({
          target: [testCaseResults.id, testCaseResults.timestamp],
          set: {
            status: sql`EXCLUDED.status`,
            resultValue: sql`EXCLUDED.result_value`,
            raw: sql`EXCLUDED.raw`,
          },
        });
    }
    const maxTs = results.reduce(
      (max, r) => (r.timestamp > max ? r.timestamp : max),
      cursor.getTime(),
    );
    const newCursor = new Date(maxTs);
    await setCursor(db, "test_results", newCursor);
    eventsTotal.inc({ stream: "test_results" }, results.length);
    lagSeconds.set(
      { stream: "test_results" },
      Math.max(0, (Date.now() - maxTs) / 1000),
    );
    logger.info(
      { count: results.length, cursor: newCursor },
      "pollTestResults: ok",
    );
    return { inserted: results.length, newCursor };
  } catch (err) {
    errorsTotal.inc({ stream: "test_results" });
    logger.error({ err }, "pollTestResults failed");
    throw err;
  }
};
