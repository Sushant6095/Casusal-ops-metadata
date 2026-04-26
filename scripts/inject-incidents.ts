/**
 * CausalOps — incident injector.
 * Writes 20 (treatment, outcome) pairs into OM with a local ground-truth file.
 *
 * Usage:
 *   pnpm incidents:inject -- --seed 42
 *   pnpm incidents:clear  -- --seed 42
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import {
  createOmClient,
  OmApiError,
  type OmClient,
} from "@causalops/om-client";
import {
  INCIDENTS,
  INCIDENT_FALSE_COUNT,
  INCIDENT_TRUE_COUNT,
  fqnForOutcome,
  fqnForTreatment,
  type IncidentFixture,
} from "./lib/incidents.js";
import { tableFqn, pipelineFqn, type TableFixture } from "./lib/fixtures.js";
import { formatAxiosMessage } from "./lib/om.js";

const GROUND_TRUTH_PATH = resolve(
  process.cwd(),
  "scripts/.incidents-ground-truth.json",
);

interface GroundTruthEntry {
  id: number;
  label: string;
  seed: number;
  treatmentRef: string;
  treatmentFqn: string;
  treatmentTs: number;
  treatmentKind: string;
  outcomeResultTs: number;
  outcomeFqn: string;
  outcomeTestCaseFqn?: string | undefined;
  isCause: boolean;
  timeGapHours: number;
}

// ---- deterministic RNG ------------------------------------------------------
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const parseSeed = (): number => {
  const idx = process.argv.indexOf("--seed");
  if (idx === -1) return 42;
  const raw = process.argv[idx + 1];
  if (!raw) throw new Error("--seed requires a number");
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error("--seed must be integer");
  return n;
};

// ---- helpers ----------------------------------------------------------------
const loadGroundTruth = (): GroundTruthEntry[] | null => {
  if (!existsSync(GROUND_TRUTH_PATH)) return null;
  const raw = readFileSync(GROUND_TRUTH_PATH, "utf8");
  return JSON.parse(raw) as GroundTruthEntry[];
};

const saveGroundTruth = (entries: GroundTruthEntry[]): void => {
  writeFileSync(
    GROUND_TRUTH_PATH,
    JSON.stringify(entries, null, 2) + "\n",
    "utf8",
  );
};

const jsonPatch = async (
  client: OmClient,
  path: string,
  ops: unknown[],
): Promise<void> => {
  await client.http.patch(path, ops, {
    headers: { "Content-Type": "application/json-patch+json" },
  });
};

const getEntity = async <T extends { id: string }>(
  client: OmClient,
  path: string,
): Promise<T> => {
  const res = await client.http.get<T>(path);
  return res.data;
};

// ---- treatment application --------------------------------------------------
const applyTreatment = async (
  client: OmClient,
  incident: IncidentFixture,
  rand: () => number,
): Promise<{ ref: string; kind: string }> => {
  const t = incident.treatment;

  if (t.entityKind === "table" && t.table) {
    const fqn = tableFqn(t.table);
    const path = `/tables/name/${encodeURIComponent(fqn)}`;

    switch (t.kind) {
      case "schemaChange": {
        const transient = `co_transient_${Math.floor(rand() * 1e9).toString(36)}`;
        await jsonPatch(client, path, [
          {
            op: "add",
            path: "/columns/-",
            value: { name: transient, dataType: "VARCHAR", dataLength: 16 },
          },
        ]);
        const entity = await getEntity<{
          id: string;
          columns: Array<{ name: string }>;
        }>(client, path);
        const idx = entity.columns.findIndex((c) => c.name === transient);
        if (idx >= 0) {
          await jsonPatch(client, path, [
            { op: "remove", path: `/columns/${idx}` },
          ]);
        }
        return { ref: `${fqn}#schemaChange`, kind: "schemaChange" };
      }
      case "ownerChange": {
        await jsonPatch(client, path, [
          {
            op: "add",
            path: "/description",
            value: `[causalops] owner rotation ${Date.now()}`,
          },
        ]);
        return { ref: `${fqn}#ownerChange`, kind: "ownerChange" };
      }
      case "descriptionChange": {
        const target = t.column
          ? { op: "replace", path: "/description", value: `col:${t.column} — ${t.description}` }
          : { op: "replace", path: "/description", value: t.description ?? "updated" };
        await jsonPatch(client, path, [target]);
        return { ref: `${fqn}#descriptionChange`, kind: "descriptionChange" };
      }
      case "tagAdded": {
        await jsonPatch(client, path, [
          {
            op: "add",
            path: "/tags/0",
            value: { tagFQN: "PII.Sensitive", source: "Classification" },
          },
        ]);
        return { ref: `${fqn}#tagAdded`, kind: "tagAdded" };
      }
      default:
        throw new Error(`unsupported table treatment ${t.kind}`);
    }
  }

  if (t.entityKind === "pipeline" && t.pipeline) {
    const fqn = pipelineFqn(t.pipeline);
    const path = `/pipelines/name/${encodeURIComponent(fqn)}`;
    if (t.kind === "pipelineStatusFail") {
      await jsonPatch(client, path, [
        {
          op: "replace",
          path: "/description",
          value: `[causalops] run FAILED: ${t.details ?? ""}`,
        },
      ]);
      return { ref: `${fqn}#pipelineStatusFail`, kind: "pipelineStatusFail" };
    }
    if (t.kind === "ownerChange") {
      await jsonPatch(client, path, [
        {
          op: "replace",
          path: "/description",
          value: `[causalops] owner rotation ${Date.now()}`,
        },
      ]);
      return { ref: `${fqn}#ownerChange`, kind: "ownerChange" };
    }
  }

  throw new Error(`unhandled treatment ${t.kind}/${t.entityKind}`);
};

// ---- outcome emission -------------------------------------------------------
const buildTestCaseFqn = (
  incident: IncidentFixture,
): { fqn: string; table: TableFixture | undefined } => {
  const name = incident.outcome.testCaseName ?? "revenue_view_row_count";
  const table = incident.outcome.table;
  if (!table) return { fqn: `unknown.${name}`, table: undefined };
  return { fqn: `${tableFqn(table)}.${name}`, table };
};

const emitOutcome = async (
  client: OmClient,
  incident: IncidentFixture,
  outcomeTs: number,
): Promise<{ testCaseFqn: string | undefined }> => {
  const { fqn: tcFqn, table } = buildTestCaseFqn(incident);
  if (!table) return { testCaseFqn: undefined };

  const body = {
    timestamp: outcomeTs,
    testCaseStatus: "Failed",
    result: `[causalops] ${incident.outcome.resultSummary}`,
    testResultValue: [{ name: "synthetic", value: "1" }],
  };

  try {
    await client.http.put(
      `/dataQuality/testCases/testCaseResults/${encodeURIComponent(tcFqn)}`,
      body,
    );
  } catch (err) {
    // fallback: some OM versions use POST under /dataQuality/testCases/{fqn}/testCaseResult
    if (err instanceof OmApiError && (err.status === 404 || err.status === 405)) {
      await client.http.post(
        `/dataQuality/testCases/${encodeURIComponent(tcFqn)}/testCaseResult`,
        body,
      );
    } else {
      throw err;
    }
  }
  return { testCaseFqn: tcFqn };
};

const deleteOutcome = async (
  client: OmClient,
  testCaseFqn: string,
  ts: number,
): Promise<void> => {
  try {
    await client.http.delete(
      `/dataQuality/testCases/testCaseResults/${encodeURIComponent(testCaseFqn)}/${ts}`,
    );
  } catch (err) {
    if (err instanceof OmApiError && err.status === 404) return;
    throw err;
  }
};

// ---- main flows -------------------------------------------------------------
const inject = async (client: OmClient, seed: number): Promise<void> => {
  if (INCIDENT_TRUE_COUNT !== 10 || INCIDENT_FALSE_COUNT !== 10) {
    throw new Error(
      `fixture invariant broken: ${INCIDENT_TRUE_COUNT} true / ${INCIDENT_FALSE_COUNT} false`,
    );
  }

  const existing = loadGroundTruth();
  if (existing && existing.length > 0 && existing[0]?.seed === seed) {
    for (const e of existing) {
      console.log(chalk.yellow(`  ↻ already injected [${e.id}/20] ${e.label}`));
    }
    console.log(
      chalk.yellow(
        `\n↻ 20 incidents already present for seed ${seed} — pass --clear first to re-inject`,
      ),
    );
    return;
  }

  const rand = mulberry32(seed);
  const now = Date.now();
  const THIRTY_DAYS = 30 * 86_400_000;

  const entries: GroundTruthEntry[] = [];
  let ok = 0;

  for (const incident of INCIDENTS) {
    const offsetMs = Math.floor(rand() * THIRTY_DAYS);
    const treatmentTs = now - offsetMs;
    const outcomeTs = treatmentTs + Math.floor(incident.timeGapHours * 3_600_000);
    const tsIso = new Date(treatmentTs).toISOString();

    try {
      const treatment = await applyTreatment(client, incident, rand);
      const { testCaseFqn } = await emitOutcome(client, incident, outcomeTs);

      const entry: GroundTruthEntry = {
        id: incident.id,
        label: incident.label,
        seed,
        treatmentRef: treatment.ref,
        treatmentFqn: fqnForTreatment(incident),
        treatmentTs,
        treatmentKind: treatment.kind,
        outcomeResultTs: outcomeTs,
        outcomeFqn: fqnForOutcome(incident),
        outcomeTestCaseFqn: testCaseFqn,
        isCause: incident.isCause,
        timeGapHours: incident.timeGapHours,
      };
      entries.push(entry);
      ok += 1;
      console.log(
        chalk.green(
          `  [${incident.id}/20] ✓ injected ${treatment.kind} on ${fqnForTreatment(incident)} at ${tsIso}`,
        ),
      );
    } catch (err) {
      console.log(
        chalk.red(
          `  [${incident.id}/20] ✗ ${incident.label} — ${formatAxiosMessage(err)}`,
        ),
      );
    }
  }

  if (entries.length > 0) saveGroundTruth(entries);

  const trueN = entries.filter((e) => e.isCause).length;
  const falseN = entries.length - trueN;
  console.log(
    chalk.bold.green(
      `\n✓ ${ok} incidents injected (${trueN} causal, ${falseN} non-causal)`,
    ),
  );
  if (ok < INCIDENTS.length) {
    console.log(chalk.red(`✗ ${INCIDENTS.length - ok} failures`));
    process.exit(1);
  }
};

const clear = async (client: OmClient): Promise<void> => {
  const entries = loadGroundTruth();
  if (!entries) {
    console.log(chalk.yellow("no ground-truth file — nothing to clear"));
    return;
  }
  for (const e of entries) {
    if (!e.outcomeTestCaseFqn) continue;
    try {
      await deleteOutcome(client, e.outcomeTestCaseFqn, e.outcomeResultTs);
      console.log(
        chalk.green(
          `  ✓ deleted [${e.id}/20] ${e.outcomeTestCaseFqn} @ ${e.outcomeResultTs}`,
        ),
      );
    } catch (err) {
      console.log(
        chalk.red(
          `  ✗ delete [${e.id}/20] ${e.outcomeTestCaseFqn} — ${formatAxiosMessage(err)}`,
        ),
      );
    }
  }
  unlinkSync(GROUND_TRUTH_PATH);
  console.log(chalk.bold.green("\n✓ cleared ground-truth file"));
};

const main = async (): Promise<void> => {
  const host = process.env.OM_HOST ?? "http://localhost:8585";
  const token = process.env.OM_JWT_TOKEN;
  if (!token) {
    console.error(chalk.red("OM_JWT_TOKEN missing."));
    process.exit(1);
  }
  const client = createOmClient({ host, token });
  const seed = parseSeed();
  const mode = process.argv.includes("--clear") ? "clear" : "inject";

  console.log(chalk.cyan(`→ ${mode} @ ${host} (seed ${seed})`));
  if (mode === "clear") await clear(client);
  else await inject(client, seed);
};

main().catch((err: unknown) => {
  console.error(chalk.red("\nFatal:"), formatAxiosMessage(err));
  process.exit(1);
});
