import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { observable } from "@trpc/server/observable";
import { changeEvents } from "@causalops/ingestor/db/schema";
import { router, authedProcedure } from "../trpc.js";

export interface LiveEventPayload {
  id: string;
  entityFqn: string;
  entityType: string;
  eventType: string;
  timestamp: string;
}

export const eventsRouter = router({
  listForEntity: authedProcedure
    .input(
      z.object({
        fqn: z.string(),
        sinceHours: z.number().int().min(1).max(24 * 30).default(24),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const since = new Date(Date.now() - input.sinceHours * 3_600_000);
      const rows = await ctx.db
        .select()
        .from(changeEvents)
        .where(
          and(
            eq(changeEvents.entityFqn, input.fqn),
            gte(changeEvents.timestamp, since),
          ),
        )
        .orderBy(desc(changeEvents.timestamp))
        .limit(input.limit);
      return { events: rows, since };
    }),

  subscribeLive: authedProcedure.subscription(({ ctx }) =>
    observable<LiveEventPayload>((emit) => {
      const handler = (payload: LiveEventPayload): void => {
        emit.next(payload);
      };
      ctx.events.on("om.event", handler);
      return () => {
        ctx.events.off("om.event", handler);
      };
    }),
  ),
});
