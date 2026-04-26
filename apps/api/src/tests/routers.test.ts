import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { appRouter } from "../routers/index.js";
import type { TrpcContext } from "../context.js";
import type {
  CausalClient,
  RankCausesOutput,
  InterventionOutput,
} from "../services/causalClient.js";

// ---- drizzle Db stub --------------------------------------------------------
interface Row {
  [k: string]: unknown;
}

const makeSelectChain = (rows: Row[]) => {
  const chain: Record<string, unknown> = {};
  chain["from"] = () => chain;
  chain["where"] = () => chain;
  chain["orderBy"] = () => chain;
  chain["limit"] = () => Promise.resolve(rows);
  chain["then"] = (resolve: (v: Row[]) => unknown) => resolve(rows);
  return chain;
};

const makeDbStub = (responses: Row[][]) => {
  let callIdx = 0;
  return {
    select: () => {
      const rows = responses[callIdx] ?? [];
      callIdx += 1;
      return makeSelectChain(rows);
    },
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.resolve(),
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
  };
};

const makeCtx = (overrides: Partial<TrpcContext> = {}): TrpcContext => {
  const emitter = new EventEmitter();
  const causal: CausalClient = {
    rankCauses: vi.fn(),
    intervention: vi.fn(),
    clearCache: vi.fn(),
  };
  const base: TrpcContext = {
    db: makeDbStub([]) as unknown as TrpcContext["db"],
    sql: {} as TrpcContext["sql"],
    om: {
      host: "http://om.local",
      http: {} as unknown as TrpcContext["om"]["http"],
    } as TrpcContext["om"],
    causal,
    events: emitter,
    requestId: "test",
    logger: console as unknown as TrpcContext["logger"],
    user: { token: "dev" },
  };
  return { ...base, ...overrides };
};

describe("api routers", () => {
  it("graph.getEntity returns null entity for missing fqn", async () => {
    const ctx = makeCtx({
      db: makeDbStub([[], [], []]) as unknown as TrpcContext["db"],
    });
    const caller = appRouter.createCaller(ctx);
    const res = await caller.graph.getEntity({ fqn: "missing" });
    expect(res.entity).toBeNull();
    expect(res.latestResults).toEqual([]);
    expect(res.recentEventsSummary).toEqual([]);
  });

  it("failures.listRecent returns since + rows", async () => {
    const row: Row = {
      id: "r1",
      timestamp: new Date(),
      testCaseFqn: "tc",
      entityFqn: "e",
      status: "Failed",
      resultValue: null,
      raw: {},
    };
    const ctx = makeCtx({
      db: makeDbStub([[row]]) as unknown as TrpcContext["db"],
    });
    const caller = appRouter.createCaller(ctx);
    const res = await caller.failures.listRecent({ windowHours: 24, limit: 10 });
    expect(res.failures).toHaveLength(1);
    expect(res.since).toBeInstanceOf(Date);
  });

  it("failures.getFailure returns null when resultId not found", async () => {
    const ctx = makeCtx({
      db: makeDbStub([[]]) as unknown as TrpcContext["db"],
    });
    const caller = appRouter.createCaller(ctx);
    const res = await caller.failures.getFailure({
      resultId: "nope",
      ancestorDepth: 2,
    });
    expect(res.failure).toBeNull();
    expect(res.candidates).toEqual([]);
  });

  it("counterfactual.rankCauses forwards to causal worker", async () => {
    const mockOutput: RankCausesOutput = {
      outcome_entity_fqn: "b",
      lookback_days: 30,
      ranked: [
        {
          treatment: {
            entity_fqn: "a",
            event_type: "schemaChanged",
            timestamp: new Date().toISOString(),
          },
          effect: 0.3,
          p_factual: 0.5,
          p_counterfactual: 0.2,
          confidence_interval: [0.1, 0.5],
          refutation: { placebo_pvalue: 0.4, subset_stability: 0.8 },
          method: "mean_difference_fallback",
          insufficient_data: false,
        },
      ],
    };
    const causal: CausalClient = {
      rankCauses: vi.fn().mockResolvedValue(mockOutput),
      intervention: vi.fn(),
      clearCache: vi.fn(),
    };
    const ctx = makeCtx({
      causal,
      db: makeDbStub([[], [{ entityFqn: "a", eventType: "schemaChanged", timestamp: new Date() }]]) as unknown as TrpcContext["db"],
    });
    const caller = appRouter.createCaller(ctx);
    const now = new Date();
    const res = await caller.counterfactual.rankCauses({
      outcomeFqn: "b",
      outcomeWindow: {
        start: new Date(now.getTime() - 86_400_000).toISOString(),
        end: now.toISOString(),
      },
      lookbackDays: 30,
      ancestorDepth: 2,
    });
    expect(causal.rankCauses).toHaveBeenCalledOnce();
    expect(res.ranked).toHaveLength(1);
    expect(res.ranked[0]?.treatment.entity_fqn).toBe("a");
    expect(res.narration).toBeNull();
  });

  it("intervention.simulate returns worker blast radius verbatim", async () => {
    const mockOutput: InterventionOutput = {
      blast_radius: [
        {
          entity_fqn: "d1",
          p_break: 0.2,
          path: ["t", "d1"],
          reason: "downstream",
        },
      ],
      top_at_risk: [
        {
          entity_fqn: "d1",
          p_break: 0.2,
          path: ["t", "d1"],
          reason: "downstream",
        },
      ],
      samples: 500,
    };
    const causal: CausalClient = {
      rankCauses: vi.fn(),
      intervention: vi.fn().mockResolvedValue(mockOutput),
      clearCache: vi.fn(),
    };
    const ctx = makeCtx({ causal });
    const caller = appRouter.createCaller(ctx);
    const res = await caller.intervention.simulate({
      targetFqn: "t",
      action: "drop_column",
      actionPayload: { column: "x" },
      downstreamDepth: 3,
      monteCarloSamples: 500,
    });
    expect(causal.intervention).toHaveBeenCalledOnce();
    expect(res.blastRadius).toHaveLength(1);
    expect(res.samples).toBe(500);
  });

  it("events.subscribeLive emits on om.event", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const sub = await caller.events.subscribeLive();

    let got: unknown = null;
    const unsub = sub.subscribe({
      next: (v: unknown) => {
        got = v;
      },
    });

    ctx.events.emit("om.event", {
      id: "e1",
      entityFqn: "x.y",
      entityType: "table",
      eventType: "entityUpdated",
      timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));
    unsub.unsubscribe();
    expect(got).toMatchObject({ id: "e1", entityFqn: "x.y" });
  });
});
