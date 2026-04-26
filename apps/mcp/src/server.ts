#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, type Server as HttpServer } from "node:http";
import type { ApiClient } from "./apiClient.js";
import { createApiClient } from "./apiClient.js";
import {
  rankCauses,
  rankCausesDescription,
  rankCausesInput,
} from "./tools/rankCauses.js";
import {
  simulateIntervention,
  simulateInterventionDescription,
  simulateInterventionInput,
} from "./tools/simulateIntervention.js";
import {
  getRiskScore,
  getRiskScoreDescription,
  getRiskScoreInput,
} from "./tools/getRiskScore.js";
import {
  listFailures,
  listFailuresDescription,
  listFailuresInput,
} from "./tools/listFailures.js";
import type { ToolResult } from "./tools/types.js";

const SERVER_NAME = "causalops";
const SERVER_VERSION = "0.1.0";

const safe =
  <T>(fn: (api: ApiClient, raw: unknown) => Promise<ToolResult>, api: ApiClient) =>
  async (input: T): Promise<ToolResult> => {
    try {
      return await fn(api, input as unknown);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  };

export const buildServer = (api: ApiClient = createApiClient()): McpServer => {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.tool(
    "rank_causes",
    rankCausesDescription,
    rankCausesInput,
    safe(rankCauses, api),
  );
  server.tool(
    "simulate_intervention",
    simulateInterventionDescription,
    simulateInterventionInput,
    safe(simulateIntervention, api),
  );
  server.tool(
    "get_risk_score",
    getRiskScoreDescription,
    getRiskScoreInput,
    safe(getRiskScore, api),
  );
  server.tool(
    "list_failures",
    listFailuresDescription,
    listFailuresInput,
    safe(listFailures, api),
  );

  return server;
};

const startHttp = async (server: McpServer, port: number): Promise<HttpServer> => {
  let transport: SSEServerTransport | null = null;
  const http = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/sse") {
      transport = new SSEServerTransport("/messages", res);
      await server.connect(transport);
      return;
    }
    if (req.method === "POST" && req.url?.startsWith("/messages") && transport) {
      await transport.handlePostMessage(req, res);
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: SERVER_NAME }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => http.listen(port, r));
  return http;
};

const main = async (): Promise<void> => {
  const server = buildServer();
  const mode = process.env.MCP_TRANSPORT ?? "stdio";

  if (mode === "http") {
    const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? "3100", 10);
    const http = await startHttp(server, port);
    process.stderr.write(`[causalops-mcp] listening on :${port} (sse)\n`);
    const shutdown = async (): Promise<void> => {
      http.close();
      await server.close();
      process.exit(0);
    };
    process.on("SIGTERM", () => void shutdown());
    process.on("SIGINT", () => void shutdown());
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[causalops-mcp] connected on stdio\n");
  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
};

// Only run main() when invoked directly (not imported by tests)
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/dist/server.js") === true ||
  process.argv[1]?.endsWith("/src/server.ts") === true;

if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`[causalops-mcp] fatal: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
