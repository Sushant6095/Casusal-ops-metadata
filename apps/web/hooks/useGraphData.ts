"use client";
import { trpc } from "@/lib/trpc";

export const useGraphData = (
  rootFqn: string,
  depth: number,
  direction: "both" | "upstream" | "downstream" = "both",
) =>
  trpc.graph.getLineageGraph.useQuery(
    { rootFqn, depth, direction },
    { enabled: rootFqn.length > 0, staleTime: 30_000 },
  );
