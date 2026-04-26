import { router } from "../trpc.js";
import { graphRouter } from "./graph.js";
import { failuresRouter } from "./failures.js";
import { counterfactualRouter } from "./counterfactual.js";
import { interventionRouter } from "./intervention.js";
import { eventsRouter } from "./events.js";

export const appRouter = router({
  graph: graphRouter,
  failures: failuresRouter,
  counterfactual: counterfactualRouter,
  intervention: interventionRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
