"use client";
import { CausalGraph, type GraphNode, type GraphEdge } from "./CausalGraph";

export interface BlastNode {
  entity_fqn: string;
  p_break: number;
  path: string[];
}

export const BlastRadiusMap: React.FC<{
  targetFqn: string;
  blast: BlastNode[];
  height?: number;
}> = ({ targetFqn, blast, height = 480 }) => {
  const nodes: GraphNode[] = [
    { fqn: targetFqn, entityType: "target", name: targetFqn.split(".").pop() ?? targetFqn, blastProb: 1 },
    ...blast.map((b) => ({
      fqn: b.entity_fqn,
      entityType: "downstream",
      name: b.entity_fqn.split(".").pop() ?? b.entity_fqn,
      blastProb: b.p_break,
    })),
  ];

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const b of blast) {
    for (let i = 0; i < b.path.length - 1; i += 1) {
      const from = b.path[i]!;
      const to = b.path[i + 1]!;
      const key = `${from}|${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to });
    }
  }

  return (
    <CausalGraph nodes={nodes} edges={edges} riskMode="blast" height={height} />
  );
};
