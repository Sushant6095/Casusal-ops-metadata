"use client";
import { Sparkles } from "lucide-react";
import { riskColor, shortFqn, pct } from "@/lib/format";

export interface RiskRow {
  fqn: string;
  score: number;
  topCause: string | null;
}

export const RiskBarChart: React.FC<{
  rows: RiskRow[] | undefined;
  loading?: boolean;
}> = ({ rows, loading = false }) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-1/2 rounded shimmer" />
            <div className="h-2 rounded shimmer" />
          </div>
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 text-fg-muted">
        <Sparkles className="text-accent mb-2" size={24} aria-hidden="true" />
        <div className="text-sm font-medium text-fg/80">No risk scores yet</div>
        <div className="text-xs mt-1">Run an RCA to populate this list.</div>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.score));
  return (
    <ol className="flex flex-col gap-3" aria-label="Top entities by risk score">
      {rows.slice(0, 10).map((r, i) => {
        const width = `${Math.min(100, (r.score / max) * 100).toFixed(1)}%`;
        const color = riskColor(r.score);
        return (
          <li key={r.fqn} className="group">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-fg-muted/70 w-4 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-fg font-medium">
                  {shortFqn(r.fqn)}
                </span>
              </div>
              <span
                className="tabular-nums font-semibold text-[11px] px-1.5 py-0.5 rounded-md"
                style={{ color, backgroundColor: `${color}1A` }}
              >
                {pct(r.score, 0)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-border/40 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width,
                  background: `linear-gradient(90deg, ${color}66 0%, ${color} 100%)`,
                  boxShadow: `0 0 12px -2px ${color}99`,
                }}
              />
            </div>
            {r.topCause ? (
              <div className="mt-1 text-[10px] text-fg-muted/80 font-mono truncate">
                ↳ {r.topCause}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
};
