import type { OmClient } from "@causalops/om-client";
import type { Db } from "../db/client.js";
import { pollLineage } from "./pollLineage.js";
import { logger } from "../logger.js";

/** Nightly: full lineage refresh + VACUUM ANALYZE. */
export const reconcile = async (
  db: Db,
  client: OmClient,
  sqlClient: import("postgres").Sql,
): Promise<void> => {
  logger.info("reconcile: start");
  await pollLineage(db, client);
  try {
    await sqlClient.unsafe("VACUUM ANALYZE entities");
    await sqlClient.unsafe("VACUUM ANALYZE lineage_edges");
  } catch (err) {
    logger.warn({ err }, "reconcile: vacuum skipped");
  }
  logger.info("reconcile: done");
};
