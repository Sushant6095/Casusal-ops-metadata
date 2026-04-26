import { describe, it, expect, vi } from "vitest";
import type { ApiClient } from "../apiClient.js";
import { rankCauses } from "../tools/rankCauses.js";
import { simulateIntervention } from "../tools/simulateIntervention.js";
import { getRiskScore } from "../tools/getRiskScore.js";
import { listFailures } from "../tools/listFailures.js";

const makeApi = (overrides: Record<string, unknown>): ApiClient =>
  ({
    counterfactual: { rankCauses: { mutate: vi.fn() } },
    intervention: { simulate: { mutate: vi.fn() } },
    graph: { getEntity: { query: vi.fn() } },
    failures: { listRecent: { query: vi.fn() } },
    ...overrides,
  }) as unknown as ApiClient;

describe("mcp tools", () => {
  it("rank_causes formats text + structured content", async () => {
    const mutate = vi.fn().mockResolvedValue({
      outcomeFqn: "b",
      candidateCount: 5,
      narration: null,
      ranked: [
        {
          treatment: {
            entity_fqn: "a",
            event_type: "schemaChanged",
            timestamp: new Date().toISOString(),
          },
          effect: 0.82,
          p_factual: 0.91,
          p_counterfactual: 0.07,
          confidence_interval: [0.7, 0.9],
          refutation: { placebo_pvalue: 0.3, subset_stability: 0.85 },
          method: "backdoor.propensity_score_matching",
          insufficient_data: false,
        },
      ],
    });
    const api = makeApi({
      counterfactual: { rankCauses: { mutate } },
    });
    const res = await rankCauses(api, {
      outcomeFqn: "b",
      outcomeWindowStart: new Date().toISOString(),
      outcomeWindowEnd: new Date().toISOString(),
      lookbackDays: 30,
      topK: 5,
    });
    expect(mutate).toHaveBeenCalledOnce();
    expect(res.content[0]?.type).toBe("text");
    expect(res.content[0]?.text).toContain("Ranked 1 causes");
    expect(res.content[0]?.text).toContain("effect=0.82");
    expect(res.structuredContent?.ranked).toHaveLength(1);
  });

  it("simulate_intervention reports empty blast cleanly", async () => {
    const mutate = vi.fn().mockResolvedValue({
      blastRadius: [],
      topAtRisk: [],
      samples: 500,
      targetFqn: "t",
    });
    const api = makeApi({ intervention: { simulate: { mutate } } });
    const res = await simulateIntervention(api, {
      targetFqn: "t",
      action: "drop_column",
      actionPayload: { column: "x" },
      downstreamDepth: 3,
      monteCarloSamples: 500,
    });
    expect(res.content[0]?.text).toContain("No downstream breakage");
    expect(res.structuredContent?.samples).toBe(500);
  });

  it("get_risk_score returns 'not found' when entity missing", async () => {
    const query = vi.fn().mockResolvedValue({
      entity: null,
      latestResults: [],
      recentEventsSummary: [],
      totalRecentEvents: 0,
      lastEventAt: null,
    });
    const api = makeApi({ graph: { getEntity: { query } } });
    const res = await getRiskScore(api, { fqn: "x.y.z" });
    expect(res.content[0]?.text).toContain("Entity not found");
    expect(res.structuredContent?.found).toBe(false);
  });

  it("get_risk_score reads extension when present", async () => {
    const query = vi.fn().mockResolvedValue({
      entity: {
        raw: {
          extension: {
            causalOpsRiskScore: 0.71,
            causalOpsTopCause: "a.b (schemaChanged)",
            causalOpsLastAnalysis: "2026-04-24T12:00:00Z",
          },
        },
      },
      latestResults: [],
      recentEventsSummary: [],
      totalRecentEvents: 0,
      lastEventAt: null,
    });
    const api = makeApi({ graph: { getEntity: { query } } });
    const res = await getRiskScore(api, { fqn: "x" });
    expect(res.content[0]?.text).toContain("71%");
    expect(res.structuredContent?.riskScore).toBe(0.71);
  });

  it("list_failures formats empty + populated", async () => {
    const query = vi.fn().mockResolvedValue({
      failures: [
        {
          id: "r1",
          timestamp: new Date("2026-04-24T10:00:00Z"),
          testCaseFqn: "s.t.c.tc",
          entityFqn: "s.t.c",
          status: "Failed",
          resultValue: null,
          raw: {},
        },
      ],
      since: new Date("2026-04-24T00:00:00Z"),
    });
    const api = makeApi({ failures: { listRecent: { query } } });
    const res = await listFailures(api, { windowHours: 24, limit: 10 });
    expect(res.content[0]?.text).toContain("1 failure(s)");
    expect(res.structuredContent?.count).toBe(1);
  });
});
