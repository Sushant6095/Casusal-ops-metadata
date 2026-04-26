import { z } from "zod";
import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { changeEvents } from "@causalops/ingestor/db/schema";
import { router, authedProcedure } from "../trpc.js";
import { ancestorsOf } from "../services/graphBuilder.js";
import { narrateRanking } from "../services/narrator.js";
import { writeRiskScore } from "../services/omWriteBack.js";

const Window = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const HIGH_CONFIDENCE_EFFECT = 0.5;

export const counterfactualRouter = router({
  rankCauses: authedProcedure
    .input(
      z.object({
        outcomeFqn: z.string(),
        outcomeWindow: Window,
        lookbackDays: z.number().int().min(1).max(365).default(30),
        ancestorDepth: z.number().int().min(1).max(6).default(3),
        outcomeTestCaseFqn: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ancestors = await ancestorsOf(
        ctx.db,
        input.outcomeFqn,
        input.ancestorDepth,
      );
      const lookbackStart = new Date(
        Date.now() - input.lookbackDays * 86_400_000,
      );

      const candidateEvents =
        ancestors.length === 0
          ? []
          : await ctx.db
              .select({
                entityFqn: changeEvents.entityFqn,
                eventType: changeEvents.eventType,
                timestamp: changeEvents.timestamp,
              })
              .from(changeEvents)
              .where(
                and(
                  inArray(changeEvents.entityFqn, ancestors),
                  gte(changeEvents.timestamp, lookbackStart),
                  lte(
                    changeEvents.timestamp,
                    new Date(input.outcomeWindow.end),
                  ),
                ),
              )
              .orderBy(desc(changeEvents.timestamp))
              .limit(200);

      const candidate_treatments = candidateEvents.map((e) => ({
        entity_fqn: e.entityFqn,
        event_type: e.eventType,
        timestamp: e.timestamp.toISOString(),
      }));

      const workerResp = await ctx.causal.rankCauses({
        outcome_entity_fqn: input.outcomeFqn,
        outcome_window: input.outcomeWindow,
        candidate_treatments,
        lookback_days: input.lookbackDays,
        outcome_test_case_fqn: input.outcomeTestCaseFqn,
      });

      const narration = await narrateRanking(
        input.outcomeFqn,
        workerResp.ranked,
      );

      const top = workerResp.ranked[0];
      if (top && top.effect >= HIGH_CONFIDENCE_EFFECT && !top.insufficient_data) {
        await writeRiskScore(ctx.om, {
          fqn: input.outcomeFqn,
          score: top.effect,
          topCause: `${top.treatment.entity_fqn} (${top.treatment.event_type})`,
        });
      }

      return {
        ranked: workerResp.ranked,
        narration,
        outcomeFqn: input.outcomeFqn,
        candidateCount: candidate_treatments.length,
      };
    }),
});
