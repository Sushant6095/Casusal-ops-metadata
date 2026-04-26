"use client";
import { useState } from "react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { EvidencePanel, type Evidence } from "./EvidencePanel";
import { pct, shortFqn } from "@/lib/format";

export interface RankedCause extends Evidence {
  treatment: { entity_fqn: string; event_type: string; timestamp: string };
}

export const CandidateRanking: React.FC<{
  ranked: RankedCause[];
  narration?: string | null;
}> = ({ ranked, narration }) => {
  const [openIdx, setOpenIdx] = useState<number>(0);

  if (ranked.length === 0) {
    return (
      <div className="text-sm text-fg-muted py-8 text-center">
        No ranked causes yet. Trigger an RCA from the outcome entity.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {ranked.map((r, i) => {
          const open = openIdx === i;
          const width = `${Math.max(4, Math.min(100, r.effect * 100)).toFixed(0)}%`;
          return (
            <li key={`${r.treatment.entity_fqn}-${i}`}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? -1 : i)}
                className="w-full text-left rounded-lg border border-border bg-surface p-3 hover:border-accent/60 transition-colors"
                aria-expanded={open}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {shortFqn(r.treatment.entity_fqn)}
                    </div>
                    <div className="text-[11px] text-fg-muted font-mono truncate">
                      {r.treatment.event_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceBadge
                      placeboPvalue={r.refutation.placebo_pvalue}
                      subsetStability={r.refutation.subset_stability}
                    />
                    <span className="tabular-nums text-sm text-fg">{pct(r.effect)}</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded bg-border/50 overflow-hidden">
                  <div
                    className="h-full rounded bg-accent transition-[width] duration-500 ease-out"
                    style={{ width }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      {openIdx >= 0 && ranked[openIdx] ? (
        <EvidencePanel evidence={ranked[openIdx]!} narration={narration ?? null} />
      ) : null}
    </div>
  );
};
