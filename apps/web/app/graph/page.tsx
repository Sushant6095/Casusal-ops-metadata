"use client";
import { useMemo, useState } from "react";
import { CausalGraph, type GraphNode } from "@/components/CausalGraph";
import { TimelineScrubber } from "@/components/TimelineScrubber";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { useGraphData } from "@/hooks/useGraphData";
import { pct, shortFqn } from "@/lib/format";
import Link from "next/link";

const ALL_TYPES = ["table", "dashboard", "pipeline"] as const;

export default function GraphPage() {
  const [rootFqn, setRootFqn] = useState(
    "demo_postgres.default.sales.revenue_view",
  );
  const [depth, setDepth] = useState(3);
  const [types, setTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const q = useGraphData(rootFqn, depth);

  const filtered = useMemo(() => {
    if (!q.data) return { nodes: [], edges: [] };
    const nodes = q.data.nodes.filter((n) =>
      types.size === 0 ? true : types.has(n.entityType),
    );
    const allow = new Set(nodes.map((n) => n.fqn));
    const edges = q.data.edges.filter(
      (e) => allow.has(e.from) && allow.has(e.to),
    );
    return { nodes, edges };
  }, [q.data, types]);

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <aside className="w-60 shrink-0 border-r border-border bg-surface/40 p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="text-xs uppercase tracking-wide font-semibold text-fg-muted">
          Root
        </div>
        <input
          type="text"
          value={rootFqn}
          onChange={(e) => setRootFqn(e.target.value)}
          className="rounded-md bg-bg border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent"
          aria-label="Root entity FQN"
        />
        <div>
          <div className="text-xs uppercase tracking-wide font-semibold text-fg-muted mb-1">
            Depth · {depth}
          </div>
          <input
            type="range"
            min={1}
            max={6}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full accent-[#22D3EE]"
            aria-label="Graph depth"
          />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide font-semibold text-fg-muted mb-1">
            Entity types
          </div>
          <div className="flex flex-col gap-1 text-sm">
            {ALL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={types.has(t)}
                  onChange={(e) => {
                    const next = new Set(types);
                    if (e.target.checked) next.add(t);
                    else next.delete(t);
                    setTypes(next);
                  }}
                  className="accent-[#22D3EE]"
                />
                <span className="text-fg-muted">{t}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="pt-2">
          <div className="text-xs uppercase tracking-wide font-semibold text-fg-muted mb-1">
            Risk legend
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-4 rounded bg-risk-safe inline-block" /> safe
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-4 rounded bg-risk-warn inline-block" /> warn
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-4 rounded bg-risk-danger inline-block" /> danger
          </div>
        </div>
        <TimelineScrubber days={30} />
      </aside>

      <div className="flex-1 min-w-0 p-4 relative">
        {q.isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : q.error ? (
          <div className="text-risk-danger text-sm">{q.error.message}</div>
        ) : filtered.nodes.length === 0 ? (
          <div className="text-fg-muted text-sm">
            No graph data. Seed OM and let the ingestor populate lineage.
          </div>
        ) : (
          <CausalGraph
            nodes={filtered.nodes}
            edges={filtered.edges}
            highlightedNodeId={selected?.fqn ?? rootFqn}
            onNodeClick={(n) => setSelected(n)}
            height={800}
          />
        )}

        {selected ? (
          <Card className="absolute bottom-6 right-6 w-[340px] shadow-xl">
            <CardHeader>
              <CardTitle>{selected.entityType}</CardTitle>
              <Badge tone="accent">{pct(selected.riskScore ?? null)}</Badge>
            </CardHeader>
            <div className="font-mono text-xs break-all">{selected.fqn}</div>
            <div className="text-sm text-fg-muted mt-1">
              owner: {selected.owner ?? "—"}
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/why/${encodeURIComponent(selected.fqn)}`}
                className="flex-1"
              >
                <Button variant="secondary" className="w-full">See causes</Button>
              </Link>
              <Link href={`/what-if?target=${encodeURIComponent(selected.fqn)}`} className="flex-1">
                <Button className="w-full">Simulate</Button>
              </Link>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-3 text-fg-muted hover:text-fg text-xs"
              aria-label="Close"
            >
              ×
            </button>
            {shortFqn(selected.fqn)}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
