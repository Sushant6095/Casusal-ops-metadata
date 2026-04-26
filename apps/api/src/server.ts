import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import {
  collectDefaultMetrics,
  Counter,
  Registry,
} from "prom-client";
import { appRouter } from "./routers/index.js";
import { createDeps, closeDeps, createTrpcContext } from "./context.js";
import { registerWebhooks } from "./webhooks/omEvents.js";
import { logger } from "./logger.js";

const registry = new Registry();
collectDefaultMetrics({ register: registry });
const reqCounter = new Counter({
  name: "causalops_api_requests_total",
  help: "total fastify requests by status",
  labelNames: ["status"] as const,
  registers: [registry],
});

const main = async (): Promise<void> => {
  const deps = createDeps();

  const app = Fastify({
    logger: false,
    maxParamLength: 5000,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: (opts: { req: Parameters<typeof createTrpcContext>[1] }) =>
        createTrpcContext(deps, opts.req),
    },
  });

  await registerWebhooks(app, deps);

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/metrics", async (_req, reply) => {
    reply.header("content-type", registry.contentType);
    return registry.metrics();
  });

  app.addHook("onResponse", async (_req, reply) => {
    reqCounter.inc({ status: String(reply.statusCode) });
  });

  const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
  await app.listen({ port, host: "0.0.0.0" });
  logger.info({ port }, "api listening");

  const shutdown = async (sig: string): Promise<void> => {
    logger.info({ sig }, "shutting down api");
    await app.close();
    await closeDeps();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

main().catch((err: unknown) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
