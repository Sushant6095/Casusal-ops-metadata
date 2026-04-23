import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";
import { createServer, type Server } from "node:http";
import { logger } from "./logger.js";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const eventsTotal = new Counter({
  name: "causalops_ingestor_events_total",
  help: "Total events/rows ingested by stream",
  labelNames: ["stream"] as const,
  registers: [registry],
});

export const errorsTotal = new Counter({
  name: "causalops_ingestor_errors_total",
  help: "Total ingestion errors by stream",
  labelNames: ["stream"] as const,
  registers: [registry],
});

export const lagSeconds = new Gauge({
  name: "causalops_ingestor_lag_seconds",
  help: "Seconds between now and last-seen event timestamp per stream",
  labelNames: ["stream"] as const,
  registers: [registry],
});

/** Start a Prometheus metrics HTTP server on the given port. */
export const startMetricsServer = (port: number): Server => {
  const server = createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
      return;
    }
    if (req.url === "/health") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port, () => {
    logger.info({ port }, "metrics server listening");
  });
  return server;
};
