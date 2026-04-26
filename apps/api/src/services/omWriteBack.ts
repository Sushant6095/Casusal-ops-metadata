import { patchTableExtension, type OmClient } from "@causalops/om-client";
import { logger } from "../logger.js";

export interface RiskWriteback {
  fqn: string;
  score: number;
  topCause: string;
}

/** PATCH the OM table extension with causalOps analysis metadata. */
export const writeRiskScore = async (
  client: OmClient,
  input: RiskWriteback,
): Promise<void> => {
  const clipped = Math.max(0, Math.min(1, input.score));
  try {
    await patchTableExtension(client, input.fqn, {
      causalOpsLastAnalysis: new Date().toISOString(),
      causalOpsRiskScore: clipped,
      causalOpsTopCause: input.topCause,
    });
    logger.info({ fqn: input.fqn, score: clipped }, "wrote risk to OM");
  } catch (err) {
    logger.warn({ err, fqn: input.fqn }, "risk writeback failed — ignoring");
  }
};
