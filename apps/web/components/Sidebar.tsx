"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, GitBranch, Search, Wand2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Home", icon: Activity, hint: "failures + risk" },
  { href: "/graph", label: "Graph", icon: GitBranch, hint: "lineage" },
  { href: "/why", label: "Why", icon: Search, hint: "RCA" },
  { href: "/what-if", label: "What-if", icon: Wand2, hint: "simulator" },
] as const;

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border/80 bg-surface/40 backdrop-blur-xl">
      <div className="px-5 py-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent/30 to-violet-500/20 ring-1 ring-accent/40">
            <Sparkles size={16} className="text-accent" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold leading-none gradient-text">
              CausalOps
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-fg-muted mt-1">
              v0.1 · alpha
            </span>
          </span>
        </Link>
      </div>

      <div className="px-3 mb-1 mt-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-fg-muted/70 px-3 mb-2">
          Workspace
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, hint }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-accent/15 to-transparent text-fg ring-1 ring-accent/30"
                    : "text-fg-muted hover:text-fg hover:bg-border/30",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent" />
                )}
                <Icon
                  size={16}
                  aria-hidden="true"
                  className={cn(
                    "transition-colors",
                    active ? "text-accent" : "text-fg-muted group-hover:text-fg",
                  )}
                />
                <span className="flex-1">{label}</span>
                <span className="text-[10px] text-fg-muted/60 font-mono">{hint}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-4 mt-8 text-[10px] text-fg-muted/70 leading-relaxed">
        <div className="rounded-lg border border-border/60 bg-bg/40 p-3">
          <div className="font-semibold text-fg/80 mb-1">Causal layer</div>
          <p>Counterfactual RCA + intervention simulation on top of OpenMetadata.</p>
        </div>
      </div>
    </aside>
  );
};
