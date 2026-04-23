import { sql } from "drizzle-orm";
import {
  listEvents,
  type OmClient,
  type ChangeEvent,
} from "@causalops/om-client";
import type { Db } from "../db/client.js";
import { changeEvents, type NewChangeEvent } from "../db/schema.js";
import { getCursor, setCursor } from "../cursors.js";
import { eventsTotal, errorsTotal, lagSeconds } from "../metrics.js";
import { logger } from "../logger.js";

const BATCH = 500;

const toRow = (e: ChangeEvent): NewChangeEvent => ({
  id: e.id,
  timestamp: new Date(e.timestamp),
  entityFqn: e.entityFullyQualifiedName,
  entityType: e.entityType,
  eventType: e.eventType,
  changeFields: (e.changeDescription ?? {}) as Record<string, unknown>,
  raw: e as unknown as Record<string, unknown>,
});

const chunked = <T>(xs: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
};

export interface PollEventsResult {
  inserted: number;
  newCursor: Date;
}

/** Poll OM events since cursor, upsert into change_events, advance cursor. */
export const pollEvents = async (
  db: Db,
  client: OmClient,
): Promise<PollEventsResult> => {
  const cursor = await getCursor(db, "events");
  let newCursor = cursor;
  try {
    const events = await listEvents(client, {
      after: cursor.getTime(),
      limit: 1000,
    });
    if (events.length === 0) {
      logger.debug({ cursor }, "pollEvents: empty");
      return { inserted: 0, newCursor: cursor };
    }
    const rows = events.map(toRow);
    for (const batch of chunked(rows, BATCH)) {
      await db
        .insert(changeEvents)
        .values(batch)
        .onConflictDoUpdate({
          target: [changeEvents.id, changeEvents.timestamp],
          set: {
            changeFields: sql`EXCLUDED.change_fields`,
            raw: sql`EXCLUDED.raw`,
          },
        });
    }
    newCursor = new Date(
      events.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), cursor.getTime()),
    );
    await setCursor(db, "events", newCursor);
    eventsTotal.inc({ stream: "events" }, events.length);
    lagSeconds.set(
      { stream: "events" },
      Math.max(0, (Date.now() - newCursor.getTime()) / 1000),
    );
    logger.info(
      { count: events.length, cursor: newCursor },
      "pollEvents: ok",
    );
    return { inserted: events.length, newCursor };
  } catch (err) {
    errorsTotal.inc({ stream: "events" });
    logger.error({ err }, "pollEvents failed");
    throw err;
  }
};
