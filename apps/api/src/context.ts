import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@causalops/ingestor/db/schema";
import { createOmClient, type OmClient } from "@causalops/om-client";
import { EventEmitter } from "node:events";
import type { FastifyRequest } from "fastify";
import { logger } from "./logger.js";
import {
  createCausalClient,
  type CausalClient,
} from "./services/causalClient.js";

export type Db = PostgresJsDatabase<typeof schema>;

export interface AppDeps {
  db: Db;
  sql: postgres.Sql;
  om: OmClient;
  causal: CausalClient;
  events: EventEmitter;
}

let _deps: AppDeps | null = null;

export const createDeps = (): AppDeps => {
  if (_deps) return _deps;
  const timescaleUrl =
    process.env.TIMESCALE_URL ??
    "postgres://causalops:causalops@localhost:5433/events";
  const omHost = process.env.OM_HOST ?? "http://localhost:8585";
  const omToken = process.env.OM_JWT_TOKEN ?? "";

  const pgClient = postgres(timescaleUrl, { max: 10 });
  const db = drizzle(pgClient, { schema });
  const om = createOmClient({ host: omHost, token: omToken });
  const causal = createCausalClient();
  const events = new EventEmitter();
  events.setMaxListeners(1024);

  _deps = { db, sql: pgClient, om, causal, events };
  return _deps;
};

export const closeDeps = async (): Promise<void> => {
  if (_deps) {
    await _deps.sql.end({ timeout: 5 });
    _deps = null;
  }
};

export interface TrpcContext extends AppDeps {
  requestId: string;
  logger: typeof logger;
  user: { token: string } | null;
}

const unauthorized = (): null => null;

export const createTrpcContext = async (
  deps: AppDeps,
  req: FastifyRequest,
): Promise<TrpcContext> => {
  const required = process.env.API_TOKEN;
  const auth = req.headers["authorization"];
  let user: { token: string } | null = null;
  if (required) {
    if (typeof auth === "string" && auth === `Bearer ${required}`) {
      user = { token: required };
    } else {
      user = unauthorized();
    }
  } else {
    user = { token: "dev" };
  }
  return {
    ...deps,
    requestId: req.id.toString(),
    logger: logger.child({ reqId: req.id }),
    user,
  };
};
