import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/** Apply every .sql file in ./migrations in filename order, idempotently. */
const main = async (): Promise<void> => {
  const url =
    process.env.TIMESCALE_URL ??
    "postgres://causalops:causalops@localhost:5433/events";
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const sql = postgres(url, { max: 1 });
  try {
    for (const f of files) {
      const body = readFileSync(join(dir, f), "utf8");
      process.stdout.write(`→ ${f}\n`);
      await sql.unsafe(body);
    }
    process.stdout.write(`✓ applied ${files.length} migration(s)\n`);
  } finally {
    await sql.end();
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`migration failed: ${(err as Error).message}\n`);
  process.exit(1);
});
