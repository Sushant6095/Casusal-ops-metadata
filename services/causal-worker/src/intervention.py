"""Monte Carlo intervention propagation for /intervention."""
from __future__ import annotations

import logging

import networkx as nx
import numpy as np

from .data_loader import DataLoader
from .models import BlastRadiusNode, InterventionRequest, InterventionResponse

logger = logging.getLogger(__name__)

# Base per-hop attenuation: probability of break given parent broke.
# Tempered by edge semantics: column-level edges propagate more strongly.
BASE_HOP_SURVIVAL = 0.65
COLUMN_HOP_SURVIVAL = 0.45


async def propagate_intervention(
    req: InterventionRequest, loader: DataLoader
) -> InterventionResponse:
    graph = await loader.lineage_graph()
    if req.target_entity_fqn not in graph:
        return InterventionResponse(blast_radius=[], top_at_risk=[], samples=req.monte_carlo_samples)

    sub = _downstream_subgraph(graph, req.target_entity_fqn, req.downstream_depth)
    rng = np.random.default_rng(42)

    break_counts: dict[str, int] = {}
    path_of: dict[str, list[str]] = {}
    reason_of: dict[str, str] = {}

    column_payload = str(req.action_payload.get("column", "")) if req.action_payload else ""

    for _ in range(req.monte_carlo_samples):
        broken = {req.target_entity_fqn}
        for u, v, data in sub.edges(data=True):
            if u not in broken:
                continue
            is_column_edge = (
                column_payload != ""
                and (data.get("from_column") == column_payload or data.get("to_column") == column_payload)
            )
            survival = COLUMN_HOP_SURVIVAL if is_column_edge else BASE_HOP_SURVIVAL
            if rng.random() > survival:
                broken.add(v)
                if v not in path_of:
                    try:
                        path_of[v] = nx.shortest_path(sub, req.target_entity_fqn, v)
                    except nx.NetworkXNoPath:
                        path_of[v] = [req.target_entity_fqn, v]
                    reason_of[v] = (
                        f"column `{column_payload}` referenced in join"
                        if is_column_edge
                        else "downstream of intervened entity"
                    )
        for node in broken:
            if node == req.target_entity_fqn:
                continue
            break_counts[node] = break_counts.get(node, 0) + 1

    samples = req.monte_carlo_samples
    nodes = [
        BlastRadiusNode(
            entity_fqn=n,
            p_break=round(float(count / samples), 4),
            path=path_of.get(n, [req.target_entity_fqn, n]),
            reason=reason_of.get(n, "downstream of intervened entity"),
        )
        for n, count in break_counts.items()
    ]
    nodes.sort(key=lambda x: x.p_break, reverse=True)
    return InterventionResponse(
        blast_radius=nodes,
        top_at_risk=nodes[:5],
        samples=samples,
    )


def _downstream_subgraph(
    graph: nx.DiGraph, source: str, depth: int
) -> nx.DiGraph:
    reachable: set[str] = {source}
    frontier: set[str] = {source}
    for _ in range(depth):
        nxt: set[str] = set()
        for u in frontier:
            nxt.update(graph.successors(u))
        nxt -= reachable
        reachable.update(nxt)
        frontier = nxt
        if not frontier:
            break
    return graph.subgraph(reachable).copy()
