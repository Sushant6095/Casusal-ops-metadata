"use client";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Wand2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";
import { FailureList } from "@/components/FailureList";
import { RiskBarChart, type RiskRow } from "@/components/RiskBarChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { shortFqn } from "@/lib/format";

export default function HomePage() {
  const failures = trpc.failures.listRecent.useQuery({
    windowHours: 24 * 7,
    limit: 200,
  });

  const rows = failures.data?.failures ?? [];

  const riskRows: RiskRow[] = (() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.entityFqn] = (counts[r.entityFqn] ?? 0) + 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([fqn, count]): RiskRow => ({
        fqn,
        score: count / max,
        topCause: null,
      }))
      .sort((a, b) => b.score - a.score);
  })();

  const failureCount = rows.length;
  const uniqueEntities = new Set(rows.map((r) => r.entityFqn)).size;
  const last24 = rows.filter(
    (r) => Date.now() - new Date(r.timestamp).getTime() < 86_400_000,
  ).length;
  const topEntity = riskRows[0]?.fqn ?? null;

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1400px] mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 glass p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <Badge tone="accent" className="mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent mr-1.5 pulse-dot" />
              Causal engine online
            </Badge>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-tight">
              <span className="gradient-text">Why did it break?</span>{" "}
              <span className="text-fg/85">— and what breaks if I change this?</span>
            </h1>
            <p className="mt-3 text-fg-muted leading-relaxed max-w-xl">
              CausalOps fits a structural causal model on your OpenMetadata lineage,
              events, and DQ tests. It separates correlation from causation —
              with refutation evidence on every claim.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/why"
              className="inline-flex items-center gap-2 rounded-xl bg-accent text-[#082F3A] px-4 py-2.5 text-sm font-semibold hover:bg-cyan-300 transition-colors shadow-[0_8px_24px_-12px_rgba(34,211,238,0.7)]"
            >
              <Search size={16} aria-hidden="true" />
              Investigate a failure
            </Link>
            <Link
              href="/what-if"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-2.5 text-sm font-medium text-fg hover:border-accent/50 transition-colors"
            >
              <Wand2 size={16} aria-hidden="true" />
              Simulate a change
            </Link>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Failures · 7d"
          value={failures.isLoading ? "—" : failureCount}
          hint={`${last24} in the last 24h`}
          icon={<AlertTriangle size={14} />}
          tone={failureCount > 0 ? "danger" : "safe"}
        />
        <Stat
          label="Affected entities"
          value={failures.isLoading ? "—" : uniqueEntities}
          hint="distinct FQNs with at least one failed test"
          icon={<Layers size={14} />}
          tone="warn"
        />
        <Stat
          label="Top-1 RCA accuracy"
          value="80%"
          hint="vs 50% recency baseline · backtest @ seed 42"
          icon={<TrendingUp size={14} />}
          tone="accent"
        />
        <Stat
          label="Mean reciprocal rank"
          value="0.90"
          hint="across 10 ground-truth causal incidents"
          icon={<Activity size={14} />}
          tone="accent"
        />
      </section>

      {/* Two-up cards */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent failures · last 7 days</CardTitle>
            <Badge tone={failureCount > 0 ? "danger" : "safe"}>
              {failures.isLoading ? "…" : `${failureCount} total`}
            </Badge>
          </CardHeader>
          <FailureList windowHours={24 * 7} limit={20} />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top entities by risk</CardTitle>
            {topEntity ? (
              <span className="text-[10px] font-mono text-fg-muted truncate max-w-[180px]">
                {shortFqn(topEntity)}
              </span>
            ) : null}
          </CardHeader>
          <RiskBarChart rows={riskRows} loading={failures.isLoading} />
        </Card>
      </section>

      {/* CTA cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/why" className="group block" aria-label="Investigate a failure">
          <Card interactive>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-accent">
                  <Search size={12} aria-hidden="true" />
                  RCA
                </div>
                <h2 className="mt-3 text-lg font-semibold">Investigate a failure</h2>
                <p className="mt-1 text-sm text-fg-muted leading-relaxed">
                  Counterfactual root-cause analysis. Effect size, 95% CI,
                  placebo + subset refutation per candidate.
                </p>
              </div>
              <ArrowRight
                className="shrink-0 text-fg-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                aria-hidden="true"
              />
            </div>
          </Card>
        </Link>

        <Link href="/what-if" className="group block" aria-label="Simulate a change">
          <Card interactive>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-violet-300">
                  <Wand2 size={12} aria-hidden="true" />
                  What-if
                </div>
                <h2 className="mt-3 text-lg font-semibold">Simulate a change</h2>
                <p className="mt-1 text-sm text-fg-muted leading-relaxed">
                  Monte-Carlo forward propagation. Per-asset blast probability
                  before you merge.
                </p>
              </div>
              <ArrowRight
                className="shrink-0 text-fg-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                aria-hidden="true"
              />
            </div>
          </Card>
        </Link>
      </section>
    </div>
  );
}
