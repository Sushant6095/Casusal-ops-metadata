"use client";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/Badge";
import { shortFqn, timeAgo } from "@/lib/format";

export const FailureList: React.FC<{ windowHours?: number; limit?: number }> = ({
  windowHours = 24 * 7,
  limit = 20,
}) => {
  const q = trpc.failures.listRecent.useQuery({ windowHours, limit });

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg shimmer" />
        ))}
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="rounded-lg border border-risk-danger/40 bg-risk-danger/5 p-3 text-sm text-risk-danger">
        <div className="font-medium">Could not load failures</div>
        <div className="text-xs mt-1 font-mono opacity-80">{q.error.message}</div>
      </div>
    );
  }
  const failures = q.data?.failures ?? [];
  if (failures.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 text-fg-muted">
        <ShieldCheck className="text-risk-safe mb-2" size={28} aria-hidden="true" />
        <div className="text-sm font-medium text-fg/80">All clear</div>
        <div className="text-xs mt-1">
          No failures in the last {Math.round(windowHours / 24)} days.
        </div>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {failures.map((f) => (
        <li key={f.id}>
          <Link
            href={`/why/${encodeURIComponent(f.entityFqn)}`}
            className="group flex items-center justify-between gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-border/40 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="mt-1.5 h-2 w-2 rounded-full bg-risk-danger shrink-0 shadow-[0_0_8px_#EF4444aa]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-fg">
                  {shortFqn(f.entityFqn)}
                </div>
                <div className="text-[11px] text-fg-muted font-mono truncate mt-0.5">
                  {shortFqn(f.testCaseFqn)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge tone="danger">Failed</Badge>
              <span className="text-[11px] text-fg-muted tabular-nums w-14 text-right">
                {timeAgo(f.timestamp)}
              </span>
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="text-fg-muted/60 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
};
