# Causal inference for data platforms

A 2-page primer written for data engineers, not statisticians. No equations
you can't read off a napkin.

## Correlation vs causation

Two failing DQ tests at roughly the same time look alike in a dashboard. One
of two things is true:

1. Test A failed **because** test B failed (their underlying tables are
   connected by a pipeline).
2. A and B both failed **because** a third thing failed (warehouse cluster
   restart, upstream CRM sync bug, etc).

A correlational system — "which upstream change happened recently?" — cannot
tell these cases apart. In scenario 2 the "recent upstream change" is
innocent. Every alert will point at it, the oncall will chase the wrong
wire, and trust in the catalog erodes. Causal inference is the toolkit that
separates the two cases with explicit assumptions, not folklore.

**Concrete example from the demo seed.** `orders.price` schema change is
followed 3 hours later by a `revenue_view` row-count DQ failure. Naive
attribution says: price changed → row count changed. Reality: both were
caused by an upstream backfill that rewrote the `orders` partition — the
schema change was a knock-on, not a cause. Without adjustment, you rollback
the wrong thing.

## Pearl's `do(·)` in one page

Observing `X=x` and setting `X=x` are different operations. When you set X,
you cut the arrows coming into X in the causal graph; you're saying "no
matter what normally causes X, make it this value". That's the `do()`
operator.

Causal effect = P(Y | do(X=x)) − P(Y | do(X=x'))

Observational data gives you P(Y | X), which bundles in everything that
*also* drives both X and Y. The `do(·)` version is what you want for
decisions like "if I deploy this change, what happens?" — that's literally a
do-intervention.

Pearl's contribution was to show when observational data alone is enough to
compute the interventional quantity. That depends on the graph. CausalOps
gets the graph from OpenMetadata's lineage — which is why lineage quality
upstream matters more than any tuning downstream.

## Backdoor criterion + propensity score matching

The backdoor criterion says: find a set **Z** of variables that

- blocks every "non-causal" path between X and Y (paths with an arrow into X), and
- contains no descendants of X.

Adjust for Z and the correlation equals the causation. Intuitively: Z
contains the common causes that confound things. Control for those, and
what's left is the real effect.

We pick Z = parents of X that aren't descendants of X (Pearl 1995). For
table-level lineage this is usually small — 0 to 5 variables — which keeps
estimation tractable.

**Why propensity score matching.** With Z chosen, we reduce to the
classical observational-study problem: compare "treated" buckets (the
schema change happened) to "untreated" buckets (it didn't). PSM matches
each treated bucket to an untreated bucket with similar Z, then averages
the difference in outcomes. It's robust to non-linear confounders and
doesn't require us to model Y as a function of Z correctly — a weaker
assumption than regression.

When Z grows (>20 covariates) we switch to Double Machine Learning (EconML
LinearDML) which handles high-dimensional confounders by orthogonalizing.

## Refutation — the trust knob

No amount of math can prove causation from data alone. We always state
assumptions. But we can **stress-test** an estimate cheaply:

- **Placebo.** Shuffle the treatment randomly. A real causal effect should
  vanish. If a permuted treatment still "explains" the outcome, we're
  picking up noise, not signal. We report the permutation p-value.
- **Subset stability.** Re-estimate on 20 random 70% subsets of the rows.
  If the sign of the effect flips on half of them, the estimate is not
  robust; the confidence badge drops from High → Low in the UI.
- **Random common cause.** Add a synthetic confounder; the effect shouldn't
  change much. (DoWhy builds this in when the heavy estimator is used.)

Users see these numbers on every evidence panel. They're the difference
between "the tool told me" and "the tool showed me why".

## Limitations — read before you believe

- **History.** Backdoor adjustment needs variation in the treatment. A
  column that was dropped once, three years ago, has T=1 in one bucket —
  nothing to compare to. CausalOps marks these `insufficient_data: true`
  rather than inventing a number.
- **Faithfulness.** We assume d-separation in the DAG implies statistical
  independence. This fails in the presence of exact cancellations, which
  are rare but not impossible in heavily curated pipelines.
- **Lineage completeness.** Missing edges in OM's lineage graph become
  missing covariates in Z. That silently biases estimates upward. The
  ingestor's `pollLineage` is the mitigation — run it, keep it fresh.
- **No cycles.** DAG assumption. Feedback loops (e.g., write-back pipelines
  that modify their own source) need unrolling in time before the tool is
  honest on them.
- **Intervention = extrapolation.** Simulating a change that has never
  occurred extrapolates from the structural equation. The blast radius is a
  best-guess under the current SCM; confidence shrinks with depth.

If you're reading this going "that's a lot of assumptions," good. Every
decision-support system makes assumptions. CausalOps just prints them on
the receipt.
