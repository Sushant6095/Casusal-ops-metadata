import { z } from "zod";
import { router, authedProcedure } from "../trpc.js";
import { writeRiskScore } from "../services/omWriteBack.js";

const HIGH_BLAST_PROB = 0.6;

export const interventionRouter = router({
  simulate: authedProcedure
    .input(
      z.object({
        targetFqn: z.string(),
        action: z.string().default("drop_column"),
        actionPayload: z.record(z.unknown()).default({}),
        downstreamDepth: z.number().int().min(1).max(10).default(4),
        monteCarloSamples: z.number().int().min(100).max(50000).default(1000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const resp = await ctx.causal.intervention({
        target_entity_fqn: input.targetFqn,
        action: input.action,
        action_payload: input.actionPayload,
        downstream_depth: input.downstreamDepth,
        monte_carlo_samples: input.monteCarloSamples,
      });

      for (const node of resp.top_at_risk) {
        if (node.p_break >= HIGH_BLAST_PROB) {
          await writeRiskScore(ctx.om, {
            fqn: node.entity_fqn,
            score: node.p_break,
            topCause: `intervention.${input.action} on ${input.targetFqn}`,
          });
        }
      }

      return {
        blastRadius: resp.blast_radius,
        topAtRisk: resp.top_at_risk,
        samples: resp.samples,
        targetFqn: input.targetFqn,
      };
    }),
});
