import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OmClient, ChangeEvent } from "@causalops/om-client";

// Mock OM listEvents
vi.mock("@causalops/om-client", async () => {
  const actual =
    await vi.importActual<typeof import("@causalops/om-client")>(
      "@causalops/om-client",
    );
  return { ...actual, listEvents: vi.fn() };
});

import { listEvents } from "@causalops/om-client";
import { pollEvents } from "../jobs/pollEvents.js";

interface InsertCapture {
  values: unknown[];
}

/**
 * Lightweight Db stub. Supports:
 *   select().from().where().limit()  — returns cursor rows
 *   insert().values().onConflictDoUpdate() — captures rows
 *   insert().values().onConflictDoUpdate() — for cursor upsert (ingestionCursors)
 */
const makeDbStub = (initialCursor: Date | null) => {
  const inserted: unknown[] = [];
  let cursor: Date | null = initialCursor;

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            cursor ? Promise.resolve([{ lastTs: cursor }]) : Promise.resolve([]),
        }),
      }),
    }),
    insert: (_table: unknown) => ({
      values: (rows: unknown) => ({
        onConflictDoUpdate: () => {
          if (Array.isArray(rows)) inserted.push(...rows);
          else {
            const r = rows as { stream?: string; lastTs?: Date };
            if (r.stream && r.lastTs) cursor = r.lastTs;
            else inserted.push(rows);
          }
          return Promise.resolve();
        },
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
  };
  return {
    db: db as unknown as Parameters<typeof pollEvents>[0],
    inserted,
    get cursor(): Date | null {
      return cursor;
    },
  };
};

const client = {} as OmClient;

const mockEvents = (events: ChangeEvent[]): void => {
  (listEvents as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    events,
  );
};

describe("pollEvents", () => {
  beforeEach(() => {
    vi.mocked(listEvents).mockReset();
  });

  it("handles empty response and leaves cursor unchanged", async () => {
    const startCursor = new Date("2026-04-20T10:00:00Z");
    const stub = makeDbStub(startCursor);
    mockEvents([]);

    const res = await pollEvents(stub.db, client);

    expect(res.inserted).toBe(0);
    expect(res.newCursor.getTime()).toBe(startCursor.getTime());
    expect(stub.inserted).toHaveLength(0);
  });

  it("inserts rows and advances cursor to max timestamp", async () => {
    const startCursor = new Date("2026-04-20T10:00:00Z");
    const stub = makeDbStub(startCursor);
    const ts1 = Date.UTC(2026, 3, 20, 11, 0, 0);
    const ts2 = Date.UTC(2026, 3, 20, 12, 0, 0);
    mockEvents([
      {
        id: "e1",
        eventType: "entityUpdated",
        entityType: "table",
        entityFullyQualifiedName: "a.b.c",
        timestamp: ts1,
      },
      {
        id: "e2",
        eventType: "entityCreated",
        entityType: "table",
        entityFullyQualifiedName: "a.b.d",
        timestamp: ts2,
      },
    ]);

    const res = await pollEvents(stub.db, client);

    expect(res.inserted).toBe(2);
    expect(res.newCursor.getTime()).toBe(ts2);
    expect(stub.inserted).toHaveLength(2);
    expect(stub.cursor?.getTime()).toBe(ts2);
  });

  it("is idempotent on duplicate ids (rows still passed to upsert)", async () => {
    const stub = makeDbStub(new Date(0));
    const ts = Date.UTC(2026, 3, 20, 11, 0, 0);
    const dup: ChangeEvent = {
      id: "e1",
      eventType: "entityUpdated",
      entityType: "table",
      entityFullyQualifiedName: "a.b.c",
      timestamp: ts,
    };
    mockEvents([dup, dup]);
    const res = await pollEvents(stub.db, client);
    expect(res.inserted).toBe(2);
    expect(stub.inserted).toHaveLength(2);
  });

  it("advances cursor even when all events share the same timestamp", async () => {
    const stub = makeDbStub(new Date(0));
    const ts = Date.UTC(2026, 3, 20, 11, 0, 0);
    mockEvents([
      {
        id: "e1",
        eventType: "entityUpdated",
        entityType: "table",
        entityFullyQualifiedName: "a.b.c",
        timestamp: ts,
      },
    ]);
    const res = await pollEvents(stub.db, client);
    expect(res.newCursor.getTime()).toBe(ts);
  });

  it("defaults cursor to ~24h ago when none persisted", async () => {
    const stub = makeDbStub(null);
    mockEvents([]);
    const before = Date.now();
    await pollEvents(stub.db, client);
    const after = Date.now();
    // listEvents should have been called with `after` roughly 24h before now
    const call = vi.mocked(listEvents).mock.calls[0];
    expect(call).toBeTruthy();
    const opts = call![1] as { after: number };
    expect(opts.after).toBeGreaterThanOrEqual(before - 86_400_000 - 1000);
    expect(opts.after).toBeLessThanOrEqual(after - 86_400_000 + 1000);
  });

  it("propagates listEvents errors", async () => {
    const stub = makeDbStub(new Date(0));
    (listEvents as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom"),
    );
    await expect(pollEvents(stub.db, client)).rejects.toThrow("boom");
  });
});
