import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

/** Build a drizzle client bound to TIMESCALE_URL. */
export const createDb = (
  url: string = process.env.TIMESCALE_URL ??
    "postgres://causalops:causalops@localhost:5433/events",
): { db: Db; sql: postgres.Sql } => {
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
};
