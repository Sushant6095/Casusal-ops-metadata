"""Structural causal-model fitting utilities.

The heavy estimators (DoWhy, EconML) are imported lazily so unit tests can run
without those dependencies installed.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

MIN_SAMPLES = 6
MIN_VARIATION = 2  # at least 2 treated + 2 untreated buckets for identification


@dataclass(frozen=True)
class FitCacheKey:
    outcome_fqn: str
    lookback_days: int


@dataclass
class BackdoorEstimate:
    effect: float
    p_factual: float
    p_counterfactual: float
    ci_low: float
    ci_high: float
    method: str
    insufficient_data: bool


def backdoor_adjustment_set(
    graph: nx.DiGraph, treatment: str, outcome: str
) -> list[str]:
    """Minimal adjustment set via parents-of-treatment heuristic (Pearl 1995)."""
    if treatment not in graph or outcome not in graph:
        return []
    parents = list(graph.predecessors(treatment))
    # Remove any descendants of treatment — they are colliders relative to Y.
    descendants = nx.descendants(graph, treatment)
    return [p for p in parents if p not in descendants and p != outcome]


def fit_backdoor(
    df: pd.DataFrame,
    treatment_col: str,
    outcome_col: str,
    covariate_cols: list[str],
) -> BackdoorEstimate:
    """Estimate E[Y | do(T=1)] − E[Y | do(T=0)] via backdoor adjustment.

    Prefers DoWhy + propensity-score matching. Falls back to EconML DML for
    high-covariate regimes, and to a naive mean-difference when the heavy
    libraries aren't available.
    """
    if len(df) < MIN_SAMPLES:
        return _insufficient()

    treat = df[treatment_col].to_numpy(dtype=float)
    out = df[outcome_col].to_numpy(dtype=float)
    if treat.sum() < MIN_VARIATION or (treat.size - treat.sum()) < MIN_VARIATION:
        return _insufficient()

    try:
        return _fit_via_dowhy(df, treatment_col, outcome_col, covariate_cols)
    except Exception as err:  # pragma: no cover - optional path
        logger.info("dowhy unavailable, falling back: %s", err)

    return _fit_naive(treat, out)


def _fit_via_dowhy(
    df: pd.DataFrame,
    treatment_col: str,
    outcome_col: str,
    covariate_cols: list[str],
) -> BackdoorEstimate:  # pragma: no cover - requires optional dep
    from dowhy import CausalModel

    method = (
        "backdoor.propensity_score_matching"
        if len(covariate_cols) <= 20
        else "backdoor.econml.dml.LinearDML"
    )
    model = CausalModel(
        data=df,
        treatment=treatment_col,
        outcome=outcome_col,
        common_causes=covariate_cols if covariate_cols else None,
        graph=None,
    )
    identified = model.identify_effect(proceed_when_unidentifiable=True)
    estimate = model.estimate_effect(identified, method_name=method)
    effect = float(estimate.value)
    ci_low, ci_high = _bootstrap_ci(
        df[treatment_col].to_numpy(float), df[outcome_col].to_numpy(float)
    )
    treated = df[df[treatment_col] == 1][outcome_col].to_numpy(float)
    untreated = df[df[treatment_col] == 0][outcome_col].to_numpy(float)
    p_factual = float(treated.mean()) if treated.size else 0.0
    p_counterfactual = float(untreated.mean()) if untreated.size else 0.0
    return BackdoorEstimate(
        effect=_clip(effect),
        p_factual=_clip(p_factual),
        p_counterfactual=_clip(p_counterfactual),
        ci_low=_clip(ci_low),
        ci_high=_clip(ci_high),
        method=method,
        insufficient_data=False,
    )


def _fit_naive(treat: np.ndarray, out: np.ndarray) -> BackdoorEstimate:
    treated = out[treat == 1]
    untreated = out[treat == 0]
    p_factual = float(treated.mean()) if treated.size else 0.0
    p_counterfactual = float(untreated.mean()) if untreated.size else 0.0
    effect = p_factual - p_counterfactual
    ci_low, ci_high = _bootstrap_ci(treat, out)
    return BackdoorEstimate(
        effect=_clip(effect),
        p_factual=_clip(p_factual),
        p_counterfactual=_clip(p_counterfactual),
        ci_low=_clip(ci_low),
        ci_high=_clip(ci_high),
        method="mean_difference_fallback",
        insufficient_data=False,
    )


def _bootstrap_ci(
    treat: np.ndarray, out: np.ndarray, n: int = 200, seed: int = 7
) -> tuple[float, float]:
    if treat.size < 4:
        return (0.0, 0.0)
    rng = np.random.default_rng(seed)
    effects = np.empty(n, dtype=float)
    for i in range(n):
        idx = rng.integers(0, treat.size, size=treat.size)
        t = treat[idx]
        y = out[idx]
        if t.sum() == 0 or t.sum() == t.size:
            effects[i] = 0.0
            continue
        effects[i] = y[t == 1].mean() - y[t == 0].mean()
    lo = float(np.quantile(effects, 0.025))
    hi = float(np.quantile(effects, 0.975))
    return (lo, hi)


def _insufficient() -> BackdoorEstimate:
    return BackdoorEstimate(
        effect=0.0,
        p_factual=0.0,
        p_counterfactual=0.0,
        ci_low=0.0,
        ci_high=0.0,
        method="insufficient_data",
        insufficient_data=True,
    )


def _clip(x: float) -> float:
    if not np.isfinite(x):
        return 0.0
    return float(max(-1.0, min(1.0, x)))


# ---- cache -------------------------------------------------------------------
_CACHE: dict[tuple[str, int], Any] = {}


def cache_get(key: FitCacheKey) -> Any | None:
    return _CACHE.get((key.outcome_fqn, key.lookback_days))


def cache_set(key: FitCacheKey, value: Any) -> None:
    _CACHE[(key.outcome_fqn, key.lookback_days)] = value


def cache_size() -> int:
    return len(_CACHE)


def cache_clear() -> None:
    _CACHE.clear()
    # also drop lru caches for good measure
    for obj in list(globals().values()):
        if hasattr(obj, "cache_clear") and callable(obj.cache_clear):
            try:
                obj.cache_clear()
            except TypeError:
                pass


@lru_cache(maxsize=128)
def _adjustment_set_cached(
    graph_key: tuple[tuple[str, str], ...], treatment: str, outcome: str
) -> tuple[str, ...]:  # pragma: no cover - glue
    g: nx.DiGraph = nx.DiGraph()
    g.add_edges_from(graph_key)
    return tuple(backdoor_adjustment_set(g, treatment, outcome))
