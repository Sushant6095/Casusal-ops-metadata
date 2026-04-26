import { Badge } from "@/components/ui/Badge";
import { pct } from "@/lib/format";

export const ConfidenceBadge: React.FC<{
  placeboPvalue: number;
  subsetStability: number;
}> = ({ placeboPvalue, subsetStability }) => {
  const score = (1 - placeboPvalue) * 0.6 + subsetStability * 0.4;
  const tone = score >= 0.7 ? "accent" : score >= 0.4 ? "warn" : "neutral";
  const label =
    score >= 0.7 ? "High confidence" : score >= 0.4 ? "Moderate" : "Low";
  return <Badge tone={tone} title={`placebo ${pct(1 - placeboPvalue)} · stability ${pct(subsetStability)}`}>{label}</Badge>;
};
