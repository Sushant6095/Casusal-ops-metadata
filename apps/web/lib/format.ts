export const pct = (n: number | null | undefined, digits = 0): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
};

export const num = (n: number | null | undefined, digits = 2): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
};

export const timeAgo = (date: Date | string | number): string => {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const abs = Math.abs(diffMs);
  const m = Math.round(abs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
};

export const shortFqn = (fqn: string): string => {
  const parts = fqn.split(".");
  if (parts.length <= 2) return fqn;
  return `…${parts.slice(-2).join(".")}`;
};

export const riskColor = (score: number | null | undefined): string => {
  if (score == null) return "#6B7280";
  if (score >= 0.7) return "#EF4444";
  if (score >= 0.4) return "#F59E0B";
  return "#10B981";
};
