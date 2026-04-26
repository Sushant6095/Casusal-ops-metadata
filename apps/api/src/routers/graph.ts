import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import {
  changeEvents,
  entities,
  testCaseResults,
} from "@causalops/ingestor/db/schema";
import { router, authedProcedure } from "../trpc.js";
import { getLineageSubgraph } from "../services/graphBuilder.js";

export const graphRouter = router({
  getLineageGraph: authedProcedure
    .input(
      z.object({
        rootFqn: z.string().min(1),
        depth: z.number().int().min(1).max(8).default(3),
        direction: z.enum(["both", "upstream", "downstream"]).default("both"),
      }),
    )
    .query(({ input, ctx }) =>
      getLineageSubgraph(ctx.db, input.rootFqn, input.depth, input.direction),
    ),

  getEntity: authedProcedure
    .input(z.object({ fqn: z.string() }))
    .query(async ({ input, ctx }) => {
      const [entity] = await ctx.db
        .select()
        .from(entities)
        .where(eq(entities.fqn, input.fqn))
        .limit(1);

      const latestResults = await ctx.db
        .select()
        .from(testCaseResults)
        .where(eq(testCaseResults.entityFqn, input.fqn))
        .orderBy(desc(testCaseResults.timestamp))
        .limit(10);

      const recentEventsRaw = await ctx.db
        .select({
          eventType: changeEvents.eventType,
          timestamp: changeEvents.timestamp,
        })
        .from(changeEvents)
        .where(eq(changeEvents.entityFqn, input.fqn))
        .orderBy(desc(changeEvents.timestamp))
        .limit(25);

      const bucketed: Record<string, number> = {};
      for (const e of recentEventsRaw) {
        bucketed[e.eventType] = (bucketed[e.eventType] ?? 0) + 1;
      }

      return {
        entity: entity ?? null,
        latestResults,
        recentEventsSummary: Object.entries(bucketed).map(([eventType, count]) => ({
          eventType,
          count,
        })),
        totalRecentEvents: recentEventsRaw.length,
        lastEventAt: recentEventsRaw[0]?.timestamp ?? null,
      };
    }),
});
