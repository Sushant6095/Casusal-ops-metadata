import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { pct, num } from "@/lib/format";

export interface Evidence {
  effect: number;
  p_factual: number;
  p_counterfactual: number;
  confidence_interval: [number, number];
  refutation: { placebo_pvalue: number; subset_stability: number };
  method: string;
  insufficient_data: boolean;
}

export const EvidencePanel: React.FC<{ evidence: Evidence; narration?: string | null }> = ({
  evidence,
  narration,
}) => (
  <Card className="space-y-4">
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Stat label="Effect" value={num(evidence.effect)} />
      <Stat label="Method" value={<code className="font-mono text-xs">{evidence.method}</code>} />
      <Stat label="P(factual)" value={pct(evidence.p_factual)} />
      <Stat label="P(counterfactual)" value={pct(evidence.p_counterfactual)} />
      <Stat
        label="95% CI"
        value={`[${num(evidence.confidence_interval[0])}, ${num(evidence.confidence_interval[1])}]`}
      />
      <Stat label="Placebo p-value" value={num(evidence.refutation.placebo_pvalue)} />
      <Stat label="Subset stability" value={pct(evidence.refutation.subset_stability)} />
      <Stat
        label="Data"
        value={
          evidence.insufficient_data ? (
            <Badge tone="warn">insufficient</Badge>
          ) : (
            <Badge tone="safe">sufficient</Badge>
          )
        }
      />
    </div>
    {narration ? (
      <div className="rounded-lg bg-bg/60 border border-border p-3 text-sm leading-relaxed text-fg-muted">
        {narration}
      </div>
    ) : null}
  </Card>
);

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-fg-muted">{label}</div>
    <div className="text-fg mt-0.5">{value}</div>
  </div>
);
