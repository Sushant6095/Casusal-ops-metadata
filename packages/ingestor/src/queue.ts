import { Queue, Worker, QueueEvents, type Job } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import type { OmClient } from "@causalops/om-client";
import type { Db } from "./db/client.js";
import { pollEvents } from "./jobs/pollEvents.js";
import { pollTestResults } from "./jobs/pollTestResults.js";
import { pollLineage } from "./jobs/pollLineage.js";
import { reconcile } from "./jobs/reconcile.js";
import { logger } from "./logger.js";
import { errorsTotal } from "./metrics.js";

export const QUEUE_NAME = "causalops-ingestor";

export type JobName =
  | "poll.events"
  | "poll.testResults"
  | "poll.lineage"
  | "reconcile";

export interface QueueHandle {
  queue: Queue;
  worker: Worker;
  events: QueueEvents;
  redis: Redis;
  close: () => Promise<void>;
}

export interface QueueDeps {
  db: Db;
  client: OmClient;
  sql: import("postgres").Sql;
  redisUrl?: string;
}

/** Boot BullMQ queue + worker + repeat schedules for all poll jobs. */
export const startQueue = async ({
  db,
  client,
  sql,
  redisUrl,
}: QueueDeps): Promise<QueueHandle> => {
  const connection = new IORedis(redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAME, { connection });
  const events = new QueueEvents(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const name = job.name as JobName;
      switch (name) {
        case "poll.events":
          return pollEvents(db, client);
        case "poll.testResults":
          return pollTestResults(db, client);
        case "poll.lineage":
          return pollLineage(db, client);
        case "reconcile":
          return reconcile(db, client, sql);
        default:
          throw new Error(`unknown job ${name}`);
      }
    },
    { connection, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    errorsTotal.inc({ stream: job?.name ?? "unknown" });
    logger.error({ job: job?.name, err: err.message }, "job failed");
  });
  worker.on("completed", (job) => {
    logger.debug({ job: job.name }, "job done");
  });

  // schedules — bullmq removes existing repeat with same key on re-register
  await queue.add("poll.events", {}, {
    repeat: { every: 60_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
  await queue.add("poll.testResults", {}, {
    repeat: { every: 300_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
  await queue.add("poll.lineage", {}, {
    repeat: { every: 600_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
  await queue.add("reconcile", {}, {
    repeat: { pattern: "0 2 * * *" },
    removeOnComplete: 10,
    removeOnFail: 10,
  });

  const close = async (): Promise<void> => {
    await worker.close();
    await events.close();
    await queue.close();
    await connection.quit();
  };

  return { queue, worker, events, redis: connection, close };
};
