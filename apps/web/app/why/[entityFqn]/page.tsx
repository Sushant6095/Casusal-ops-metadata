"use client";
import { use, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useGraphData } from "@/hooks/useGraphData";
import { CausalGraph } from "@/components/CausalGraph";
import {
  CandidateRanking,
  type RankedCause,
} from "@/components/CandidateRanking";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { shortFqn, timeAgo } from "@/lib/format";

interface PageProps {
  params: Promise<{ entityFqn: string }>;
}

export default function WhyPage({ params }: PageProps) {
  const { entityFqn } = use(params);
  const fqn = decodeURIComponent(entityFqn);
  const [window] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86_400_000);
    return { start: start.toISOString(), end: end.toISOString() };
  });

  const graph = useGraphData(fqn, 4, "upstream");
  const events = trpc.events.listForEntity.useQuery({
    fqn,
    sinceHours: 24 * 14,
    limit: 100,
  });
  const rca = trpc.counterfactual.rankCauses.useMutation();

  const ranked: RankedCause[] = useMemo(
    () => (rca.data?.ranked ?? []) as RankedCause[],
    [rca.data],
  );

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Col 1: events timeline */}
      <aside className="w-64 shrink-0 border-r border-border bg-surface/40 overflow-y-auto">
        <div className="p-4 border-b border-border sticky top-0 bg-surface/90 backdrop-blur">
          <div className="text-xs uppercase tracking-wide font-semibold text-fg-muted">
            Outcome
          </div>
          <div className="font-mono text-xs mt-1 break-all">{shortFqn(fqn)}</div>
          <Button
            className="mt-3 w-full"
            disabled={rca.isPending}
            onClick={() =>
              rca.mutate({
                outcomeFqn: fqn,
                outcomeWindow: window,
                lookbackDays: 30,
                ancestorDepth: 4,
              })
            }
          >
            {rca.isPending ? "Running RCA…" : "Run RCA"}
          </Button>
        </div>
        <div className="p-4 space-y-2">
          <div className="text-xs uppercase tracking-wide font-semibold text-fg-muted mb-1">
            Upstream events · last 14d
          </div>
          {events.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)
          ) : events.data?.events.length === 0 ? (
            <div className="text-xs text-fg-muted">No recent events.</div>
          ) : (
            events.data?.events.slice(0, 30).map((e) => (
              <div key={e.id} className="rounded border border-border bg-bg p-2 text-xs">
                <div className="font-mono">{shortFqn(e.entityFqn)}</div>
                <div className="flex items-center justify-between mt-1">
                  <Badge tone="neutral">{e.eventType}</Badge>
                  <span className="text-fg-muted">{timeAgo(e.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Col 2: upstream graph */}
      <div className="flex-1 min-w-0 p-4 relative">
        <div className="absolute top-5 left-5 z-10 flex items-center gap-2 text-sm">
          <Star className="text-accent" size={16} fill="#22D3EE" aria-hidden="true" />
          <span className="font-mono text-xs">{shortFqn(fqn)}</span>
        </div>
        {graph.isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : graph.error ? (
          <div className="text-risk-danger text-sm">{graph.error.message}</div>
        ) : (
          <CausalGraph
            nodes={graph.data?.nodes ?? []}
            edges={graph.data?.edges ?? []}
            highlightedNodeId={fqn}
            riskMode="risk"
            height={760}
          />
        )}
      </div>

      {/* Col 3: ranking */}
      <aside className="w-[380px] shrink-0 border-l border-border bg-surface/40 overflow-y-auto">
        <div className="p-4 sticky top-0 bg-surface/90 backdrop-blur border-b border-border">
          <Card className="p-0 border-0 bg-transparent shadow-none">
            <CardHeader>
              <CardTitle>Ranked causes</CardTitle>
              {rca.data ? (
                <Badge tone="accent">{rca.data.candidateCount} candidates</Badge>
              ) : null}
            </CardHeader>
          </Card>
        </div>
        <div className="p-4">
          {rca.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : rca.error ? (
            <div className="text-risk-danger text-sm">{rca.error.message}</div>
          ) : rca.data ? (
            <CandidateRanking ranked={ranked} narration={rca.data.narration} />
          ) : (
            <div className="text-sm text-fg-muted">
              Click <strong>Run RCA</strong> to rank upstream causes for this outcome.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
