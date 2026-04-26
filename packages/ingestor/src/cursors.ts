import { eq, sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { ingestionCursors } from "./db/schema.js";

export type CursorStream = "events" | "test_results" | "lineage";

const DAY_MS = 86_400_000;

/** Read last-seen timestamp for a stream; defaults to 24h ago. */
export const getCursor = async (
  db: Db,
  stream: CursorStream,
): Promise<Date> => {
  const rows = await db
    .select()
    .from(ingestionCursors)
    .where(eq(ingestionCursors.stream, stream))
    .limit(1);
  if (rows.length === 0) return new Date(Date.now() - DAY_MS);
  return rows[0]!.lastTs;
};

/** Upsert the cursor for a stream. */
export const setCursor = async (
  db: Db,
  stream: CursorStream,
  ts: Date,
): Promise<void> => {
  const now = new Date();
  await db
    .insert(ingestionCursors)
    .values({ stream, lastTs: ts, updatedAt: now })
    .onConflictDoUpdate({
      target: ingestionCursors.stream,
      set: { lastTs: sql`EXCLUDED.last_ts`, updatedAt: now },
    });
};
