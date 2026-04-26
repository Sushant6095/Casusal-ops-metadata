import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { testCaseResults } from "@causalops/ingestor/db/schema";
import { router, authedProcedure } from "../trpc.js";
import { ancestorsOf } from "../services/graphBuilder.js";

export const failuresRouter = router({
  listRecent: authedProcedure
    .input(
      z.object({
        windowHours: z.number().int().min(1).max(24 * 30).default(24),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const since = new Date(Date.now() - input.windowHours * 3_600_000);
      const rows = await ctx.db
        .select()
        .from(testCaseResults)
        .where(
          and(
            eq(testCaseResults.status, "Failed"),
            gte(testCaseResults.timestamp, since),
          ),
        )
        .orderBy(desc(testCaseResults.timestamp))
        .limit(input.limit);
      return { failures: rows, since };
    }),

  getFailure: authedProcedure
    .input(
      z.object({
        resultId: z.string(),
        ancestorDepth: z.number().int().min(1).max(6).default(3),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [failure] = await ctx.db
        .select()
        .from(testCaseResults)
        .where(eq(testCaseResults.id, input.resultId))
        .limit(1);
      if (!failure) return { failure: null, candidates: [] };

      const candidates = await ancestorsOf(
        ctx.db,
        failure.entityFqn,
        input.ancestorDepth,
      );
      return { failure, candidates };
    }),
});
