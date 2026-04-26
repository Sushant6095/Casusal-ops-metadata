"use client";
import { Command, Github } from "lucide-react";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { cn } from "@/lib/cn";

export const TopBar: React.FC = () => {
  const { connected, lastEventAt } = useLiveEvents();
  return (
    <header className="h-14 border-b border-border/70 bg-bg/40 backdrop-blur-xl flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">
          Causal layer
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="text-sm text-fg/90">OpenMetadata + structural causal models</span>
      </div>

      <div className="flex items-center gap-3">
        <kbd className="hidden md:inline-flex items-center gap-1 rounded-md border border-border/60 bg-surface/60 px-2 py-1 text-[11px] text-fg-muted font-mono">
          <Command size={11} aria-hidden="true" /> K
        </kbd>

        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]",
            connected
              ? "border-risk-safe/40 bg-risk-safe/10 text-risk-safe"
              : "border-border/60 bg-surface/60 text-fg-muted",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "bg-risk-safe pulse-dot" : "bg-fg-muted",
            )}
            aria-hidden="true"
          />
          <span className="font-medium">{connected ? "Live" : "Polling"}</span>
          {lastEventAt ? (
            <span className="text-fg-muted/70 font-mono">
              {new Date(lastEventAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : null}
        </div>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer noopener"
          className="text-fg-muted hover:text-fg transition-colors"
          aria-label="GitHub"
        >
          <Github size={16} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
};
