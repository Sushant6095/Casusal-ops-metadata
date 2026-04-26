"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wand2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BlastRadiusMap, type BlastNode } from "@/components/BlastRadiusMap";
import { pct, shortFqn } from "@/lib/format";

const ACTIONS = [
  "drop_column",
  "rename_column",
  "change_type",
  "remove_source",
] as const;

function WhatIfInner() {
  const search = useSearchParams();
  const [target, setTarget] = useState(
    search.get("target") ?? "demo_postgres.default.sales.orders",
  );
  const [action, setAction] = useState<(typeof ACTIONS)[number]>("drop_column");
  const [column, setColumn] = useState("discount_code");
  const [samples, setSamples] = useState(1000);
  const [depth, setDepth] = useState(4);

  const sim = trpc.intervention.simulate.useMutation();
  const blast: BlastNode[] = useMemo(
    () => (sim.data?.blastRadius ?? []) as BlastNode[],
    [sim.data],
  );

  return (
    <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-h-[calc(100vh-56px)]">
      <Card>
        <CardHeader>
          <CardTitle>Proposed change</CardTitle>
          <Wand2 size={18} className="text-accent" aria-hidden="true" />
        </CardHeader>
        <div className="space-y-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-fg-muted uppercase tracking-wide">Target entity FQN</span>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-md bg-bg border border-border px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
              aria-label="Target entity FQN"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-fg-muted uppercase tracking-wide">Action</span>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as (typeof ACTIONS)[number])}
              className="rounded-md bg-bg border border-border px-2 py-1.5 focus:outline-none focus:border-accent"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {(action === "drop_column" ||
            action === "rename_column" ||
            action === "change_type") && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fg-muted uppercase tracking-wide">Column</span>
              <input
                type="text"
                value={column}
                onChange={(e) => setColumn(e.target.value)}
                className="rounded-md bg-bg border border-border px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-fg-muted uppercase tracking-wide">Downstream depth · {depth}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="accent-[#22D3EE]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-fg-muted uppercase tracking-wide">Monte Carlo · {samples} samples</span>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={samples}
              onChange={(e) => setSamples(Number(e.target.value))}
              className="accent-[#22D3EE]"
            />
          </label>
          <Button
            className="w-full"
            disabled={sim.isPending}
            onClick={() =>
              sim.mutate({
                targetFqn: target,
                action,
                actionPayload: column ? { column } : {},
                downstreamDepth: depth,
                monteCarloSamples: samples,
              })
            }
          >
            {sim.isPending ? "Simulating…" : "Simulate"}
          </Button>
          {sim.error ? (
            <div className="text-risk-danger text-xs">{sim.error.message}</div>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-col gap-4 min-w-0">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div>
              <div className="text-xs uppercase tracking-wide text-fg-muted">Blast radius</div>
              <div className="font-mono text-xs mt-1 break-all">{shortFqn(target)}</div>
            </div>
            {sim.data ? (
              <Badge tone="accent">{sim.data.samples} samples</Badge>
            ) : null}
          </div>
          <div className="h-[420px]">
            {sim.isPending ? (
              <div className="p-4"><Skeleton className="h-full w-full" /></div>
            ) : sim.data ? (
              <BlastRadiusMap targetFqn={target} blast={blast} height={420} />
            ) : (
              <div className="text-fg-muted text-sm p-8 text-center">
                Fill the form on the left, then click <strong>Simulate</strong>.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top at-risk</CardTitle>
          </CardHeader>
          {sim.data?.topAtRisk?.length ? (
            <ul className="divide-y divide-border">
              {sim.data.topAtRisk.map((r) => (
                <li key={r.entity_fqn} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{shortFqn(r.entity_fqn)}</div>
                    <div className="text-[11px] text-fg-muted font-mono truncate">
                      {r.reason}
                    </div>
                    <div className="text-[11px] text-fg-muted font-mono truncate">
                      path: {r.path.join(" → ")}
                    </div>
                  </div>
                  <Badge tone={r.p_break >= 0.6 ? "danger" : r.p_break >= 0.3 ? "warn" : "neutral"}>
                    {pct(r.p_break)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-fg-muted">No downstream breakage predicted.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function WhatIfPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-40 w-full" /></div>}>
      <WhatIfInner />
    </Suspense>
  );
}
