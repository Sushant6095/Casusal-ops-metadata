import type { OmClient } from "./client.js";
import { ChangeEventSchema, type ChangeEvent } from "./types.js";
import { z } from "zod";

export interface ListEventsOptions {
  after: number;
  eventType?: string[];
  entityType?: string[];
  limit?: number;
}

export interface StreamEventsOptions extends ListEventsOptions {
  intervalMs?: number;
}

const EventListSchema = z.object({
  data: z.array(ChangeEventSchema).default([]),
});

/** List OM change events since the given epoch-millis cursor. */
export async function listEvents(
  client: OmClient,
  opts: ListEventsOptions,
): Promise<ChangeEvent[]> {
  const res = await client.http.get("/events", {
    params: {
      timestamp: opts.after,
      eventType: opts.eventType?.join(","),
      entityType: opts.entityType?.join(","),
      limit: opts.limit ?? 100,
    },
  });
  const parsed = EventListSchema.parse(
    Array.isArray(res.data) ? { data: res.data } : res.data,
  );
  return parsed.data;
}

/** Poll OM events and invoke callback per event. Returns unsubscribe fn. */
export function streamEvents(
  client: OmClient,
  opts: StreamEventsOptions,
  onEvent: (event: ChangeEvent) => void | Promise<void>,
): () => void {
  const intervalMs = opts.intervalMs ?? 10_000;
  let cursor = opts.after;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const events = await listEvents(client, { ...opts, after: cursor });
      for (const ev of events) {
        await onEvent(ev);
        if (ev.timestamp > cursor) cursor = ev.timestamp;
      }
    } catch {
      // swallow — next tick retries
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  timer = setTimeout(tick, 0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
