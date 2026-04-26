import { createOmClient } from "@causalops/om-client";
import { createDb } from "./db/client.js";
import { startQueue } from "./queue.js";
import { startMetricsServer } from "./metrics.js";
import { logger } from "./logger.js";

const main = async (): Promise<void> => {
  const host = process.env.OM_HOST ?? "http://localhost:8585";
  const token = process.env.OM_JWT_TOKEN;
  if (!token) {
    logger.error("OM_JWT_TOKEN missing");
    process.exit(1);
  }
  const metricsPort = Number.parseInt(process.env.METRICS_PORT ?? "9090", 10);

  const client = createOmClient({ host, token });
  const { db, sql } = createDb();
  const metricsServer = startMetricsServer(metricsPort);
  const handle = await startQueue({ db, client, sql });

  logger.info({ host, metricsPort }, "ingestor up");

  const heartbeat = setInterval(() => {
    logger.info("heartbeat");
  }, 30_000);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    clearInterval(heartbeat);
    metricsServer.close();
    await handle.close();
    await sql.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

main().catch((err: unknown) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
