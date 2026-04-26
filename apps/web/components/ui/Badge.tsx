import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "safe" | "warn" | "danger" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-border/50 text-fg-muted",
  safe: "bg-risk-safe/10 text-risk-safe border border-risk-safe/30",
  warn: "bg-risk-warn/10 text-risk-warn border border-risk-warn/30",
  danger: "bg-risk-danger/10 text-risk-danger border border-risk-danger/30",
  accent: "bg-accent/10 text-accent border border-accent/30",
};

export const Badge: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }
> = ({ tone = "neutral", className, ...props }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
      TONES[tone],
      className,
    )}
    {...props}
  />
);
