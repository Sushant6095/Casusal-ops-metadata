import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.TIMESCALE_URL ??
      "postgres://causalops:causalops@localhost:5433/events",
  },
  strict: true,
  verbose: true,
});
