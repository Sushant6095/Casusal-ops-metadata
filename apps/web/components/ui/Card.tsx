import * as React from "react";
import { cn } from "@/lib/cn";

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
> = ({ className, interactive = false, ...props }) => (
  <div
    className={cn(
      "glass rounded-2xl border border-border p-6",
      "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]",
      interactive && "glass-hover cursor-pointer",
      className,
    )}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn("mb-4 flex items-start justify-between gap-3", className)}
    {...props}
  />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3
    className={cn(
      "text-[11px] font-semibold tracking-[0.14em] text-fg-muted uppercase",
      className,
    )}
    {...props}
  />
);
