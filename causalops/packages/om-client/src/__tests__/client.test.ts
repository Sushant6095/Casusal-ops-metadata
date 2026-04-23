import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  createOmClient,
  getTableLineage,
  getTable,
  listEvents,
  listFailingTests,
  OmApiError,
} from "../index.js";

const HOST = "http://om.test";
const BASE = `${HOST}/api/v1`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const makeClient = () =>
  createOmClient({ host: HOST, token: "t", retryBaseMs: 1 });

describe("om-client", () => {
  it("injects bearer auth header", async () => {
    let seen: string | null = null;
    server.use(
      http.get(`${BASE}/tables/name/:fqn`, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({
          id: "1",
          name: "t",
          fullyQualifiedName: "s.db.sc.t",
          columns: [],
        });
      }),
    );
    const client = makeClient();
    await getTable(client, "s.db.sc.t");
    expect(seen).toBe("Bearer t");
  });

  it("returns parsed lineage graph on success", async () => {
    server.use(
      http.get(`${BASE}/lineage/table/name/:fqn`, () =>
        HttpResponse.json({
          entity: { id: "e1", fullyQualifiedName: "s.db.sc.t", type: "table" },
          nodes: [
            { id: "e2", fullyQualifiedName: "s.db.sc.u", type: "table" },
          ],
          upstreamEdges: [{ fromEntity: "e2", toEntity: "e1" }],
          downstreamEdges: [],
        }),
      ),
    );
    const graph = await getTableLineage(makeClient(), "s.db.sc.t");
    expect(graph.entity.fullyQualifiedName).toBe("s.db.sc.t");
    expect(graph.upstreamEdges).toHaveLength(1);
    expect(graph.downstreamEdges).toHaveLength(0);
  });

  it("throws OmApiError with status + message on 401", async () => {
    server.use(
      http.get(`${BASE}/tables/name/:fqn`, () =>
        HttpResponse.json(
          { code: 401, message: "Unauthorized bot" },
          { status: 401 },
        ),
      ),
    );
    await expect(getTable(makeClient(), "s.db.sc.t")).rejects.toMatchObject({
      name: "OmApiError",
      status: 401,
      message: "Unauthorized bot",
    });
  });

  it("retries on 500 and eventually succeeds", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/tables/name/:fqn`, () => {
        calls += 1;
        if (calls < 3) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({
          id: "1",
          name: "t",
          fullyQualifiedName: "s.db.sc.t",
          columns: [],
        });
      }),
    );
    const table = await getTable(makeClient(), "s.db.sc.t");
    expect(calls).toBe(3);
    expect(table.fullyQualifiedName).toBe("s.db.sc.t");
  });

  it("gives up after max retries on persistent 500", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/tables/name/:fqn`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    await expect(getTable(makeClient(), "s.db.sc.t")).rejects.toBeInstanceOf(
      OmApiError,
    );
    expect(calls).toBe(4); // 1 initial + 3 retries
  });

  it("listEvents accepts array or { data } envelope", async () => {
    server.use(
      http.get(`${BASE}/events`, () =>
        HttpResponse.json([
          {
            id: "e1",
            eventType: "entityUpdated",
            entityType: "table",
            entityFullyQualifiedName: "s.db.sc.t",
            timestamp: 123,
          },
        ]),
      ),
    );
    const events = await listEvents(makeClient(), { after: 0 });
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("entityUpdated");
  });

  it("listFailingTests filters to Failed status", async () => {
    server.use(
      http.get(`${BASE}/dataQuality/testCases/testCaseResults`, () =>
        HttpResponse.json({
          data: [
            { timestamp: 1, testCaseStatus: "Success" },
            { timestamp: 2, testCaseStatus: "Failed" },
            { timestamp: 3, testCaseStatus: "Failed" },
          ],
        }),
      ),
    );
    const failing = await listFailingTests(makeClient(), 7);
    expect(failing).toHaveLength(2);
    expect(failing.every((r) => r.testCaseStatus === "Failed")).toBe(true);
  });
});
