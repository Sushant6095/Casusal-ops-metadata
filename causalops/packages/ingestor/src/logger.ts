import { pino, type Logger } from "pino";

/** Shared pino logger. Level from LOG_LEVEL env (default info). */
export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "causalops-ingestor" },
});
