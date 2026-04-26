# CausalOps back-test report

**Incidents evaluated:** 20
**True causal:** 10 · **Confounded:** 10

## Summary

| Metric | CausalOps | Baseline (recency) |
|--------|-----------|--------------------|
| Top-1 accuracy (true causes) | **80%** | 50% |
| Top-3 hit rate (true causes) | 100% | — |
| Top-5 hit rate (true causes) | 100% | — |
| Mean reciprocal rank          | 0.900 | — |
| False-positive rate (confounded wrongly picked) | 30% | — |
| Overall correctness            | 75% | 50% |

## Per-incident breakdown

| # | Incident | Ground truth | Truth rank | Top (effect) | CausalOps | Baseline |
|---|----------|--------------|------------|--------------|-----------|----------|
| 1 | synthetic incident 1 | causal | 1 | a.b.1 (0.82) | ✓ | ✓ |
| 2 | synthetic incident 2 | causal | 2 | a.b.2.__noise (0.71) | ✗ | ✓ |
| 3 | synthetic incident 3 | causal | 2 | a.b.3.__noise (0.71) | ✗ | ✓ |
| 4 | synthetic incident 4 | causal | 1 | a.b.4 (0.82) | ✓ | ✓ |
| 5 | synthetic incident 5 | causal | 1 | a.b.5 (0.82) | ✓ | ✓ |
| 6 | synthetic incident 6 | causal | 1 | a.b.6 (0.82) | ✓ | ✓ |
| 7 | synthetic incident 7 | causal | 1 | a.b.7 (0.82) | ✓ | ✓ |
| 8 | synthetic incident 8 | causal | 1 | a.b.8 (0.82) | ✓ | ✓ |
| 9 | synthetic incident 9 | causal | 1 | a.b.9 (0.82) | ✓ | ✓ |
| 10 | synthetic incident 10 | causal | 1 | a.b.10 (0.82) | ✓ | ✓ |
| 11 | synthetic incident 11 | confounded | 2 | a.b.11.__noise (0.71) | ✓ | ✗ |
| 12 | synthetic incident 12 | confounded | 2 | a.b.12.__noise (0.71) | ✓ | ✗ |
| 13 | synthetic incident 13 | confounded | 2 | a.b.13.__noise (0.71) | ✓ | ✗ |
| 14 | synthetic incident 14 | confounded | 2 | a.b.14.__noise (0.71) | ✓ | ✗ |
| 15 | synthetic incident 15 | confounded | 2 | a.b.15.__noise (0.71) | ✓ | ✗ |
| 16 | synthetic incident 16 | confounded | 1 | a.b.16 (0.82) | ✗ | ✗ |
| 17 | synthetic incident 17 | confounded | 1 | a.b.17 (0.82) | ✗ | ✗ |
| 18 | synthetic incident 18 | confounded | 1 | a.b.18 (0.82) | ✗ | ✗ |
| 19 | synthetic incident 19 | confounded | 2 | a.b.19.__noise (0.71) | ✓ | ✗ |
| 20 | synthetic incident 20 | confounded | 2 | a.b.20.__noise (0.71) | ✓ | ✗ |

_Baseline_ = "most recent upstream ChangeEvent wins". It picks the ground-truth treatment entity every time, so it always "succeeds" on causal incidents and always "fails" on confounded ones — exposing why recency alone is not a causal explanation.
