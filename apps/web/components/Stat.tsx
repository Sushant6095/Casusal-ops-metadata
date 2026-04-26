import * as React from "react";
import { cn } from "@/lib/cn";

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "accent" | "warn" | "danger" | "safe";
  className?: string;
}> = ({ label, value, hint, icon, tone = "neutral", className }) => {
  const ringTone =
    tone === "accent"
      ? "ring-accent/40"
      : tone === "warn"
        ? "ring-risk-warn/40"
        : tone === "danger"
          ? "ring-risk-danger/40"
          : tone === "safe"
            ? "ring-risk-safe/40"
            : "ring-border/60";
  const valueTone =
    tone === "accent"
      ? "text-accent"
      : tone === "warn"
        ? "text-risk-warn"
        : tone === "danger"
          ? "text-risk-danger"
          : tone === "safe"
            ? "text-risk-safe"
            : "text-fg";
  return (
    <div
      className={cn(
        "glass rounded-2xl border border-border p-5 ring-1",
        ringTone,
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-fg-muted">
          {label}
        </div>
        {icon ? <div className="text-fg-muted">{icon}</div> : null}
      </div>
      <div
        className={cn(
          "mt-3 text-3xl font-semibold tabular-nums leading-none",
          valueTone,
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-[11px] text-fg-muted">{hint}</div>
      ) : null}
    </div>
  );
};
