"""Lightweight refutation tests (placebo + subset stability)."""
from __future__ import annotations

import numpy as np


def placebo_pvalue(
    treatment: np.ndarray, outcome: np.ndarray, n_permutations: int = 200, seed: int = 7
) -> float:
    """Permutation test: p-value that observed mean-diff is a null artifact."""
    if treatment.size == 0 or outcome.size == 0:
        return 1.0
    rng = np.random.default_rng(seed)
    t = treatment.astype(float)
    y = outcome.astype(float)
    if t.sum() == 0 or t.sum() == t.size:
        return 1.0
    observed = abs(y[t == 1].mean() - y[t == 0].mean())
    count = 0
    for _ in range(n_permutations):
        shuffled = rng.permutation(t)
        if shuffled.sum() == 0 or shuffled.sum() == shuffled.size:
            continue
        perm = abs(y[shuffled == 1].mean() - y[shuffled == 0].mean())
        if perm >= observed:
            count += 1
    return float((count + 1) / (n_permutations + 1))


def subset_stability(
    treatment: np.ndarray,
    outcome: np.ndarray,
    n_subsets: int = 20,
    fraction: float = 0.7,
    seed: int = 7,
) -> float:
    """Fraction of random subsets whose effect estimate has the same sign."""
    if treatment.size < 4:
        return 0.0
    rng = np.random.default_rng(seed)
    t = treatment.astype(float)
    y = outcome.astype(float)
    base = _mean_diff(t, y)
    base_sign = np.sign(base) if base != 0 else 1
    same = 0
    for _ in range(n_subsets):
        idx = rng.choice(t.size, size=max(2, int(t.size * fraction)), replace=False)
        eff = _mean_diff(t[idx], y[idx])
        if np.sign(eff) == base_sign:
            same += 1
    return float(same / n_subsets)


def _mean_diff(t: np.ndarray, y: np.ndarray) -> float:
    if t.sum() == 0 or t.sum() == t.size:
        return 0.0
    return float(y[t == 1].mean() - y[t == 0].mean())
