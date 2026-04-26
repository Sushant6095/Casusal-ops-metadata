"""Orchestrator for /rank_causes — fits backdoor estimates per candidate."""
from __future__ import annotations

import logging

import networkx as nx
import pandas as pd

from .data_loader import DataLoader, bin_events, default_window
from .models import (
    CandidateTreatment,
    RankCausesRequest,
    RankCausesResponse,
    RankedCause,
    Refutation,
)
from .refutation import placebo_pvalue, subset_stability
from .scm_fit import (
    FitCacheKey,
    backdoor_adjustment_set,
    cache_get,
    cache_set,
    fit_backdoor,
)

logger = logging.getLogger(__name__)


async def rank_causes(
    req: RankCausesRequest, loader: DataLoader
) -> RankCausesResponse:
    cache_key = FitCacheKey(
        outcome_fqn=req.outcome_entity_fqn, lookback_days=req.lookback_days
    )
    cached = cache_get(cache_key)
    if cached is not None and not req.candidate_treatments:
        return cached

    start, end = default_window(req.lookback_days)
    graph = await loader.lineage_graph()
    outcomes = await loader.outcomes(
        req.outcome_entity_fqn, start, end, req.outcome_test_case_fqn
    )
    outcomes_binary = outcomes.copy() if not outcomes.empty else outcomes
    if not outcomes_binary.empty:
        outcomes_binary["flag_raw"] = (
            outcomes_binary["status"].astype(str).str.lower() == "failed"
        ).astype(int)
        outcomes_binary = outcomes_binary.rename(
            columns={"flag_raw": "flag"}
        )[["timestamp", "flag"]]
        out_buckets = bin_events(
            outcomes_binary[outcomes_binary["flag"] == 1], start, end
        )
    else:
        out_buckets = bin_events(outcomes, start, end)

    entity_fqns = sorted({c.entity_fqn for c in req.candidate_treatments})
    treatments_df = await loader.treatments(entity_fqns, start, end)

    ranked: list[RankedCause] = []
    for cand in req.candidate_treatments:
        ranked.append(
            _score_candidate(graph, cand, treatments_df, out_buckets, req.outcome_entity_fqn)
        )

    ranked.sort(key=lambda r: r.effect, reverse=True)
    resp = RankCausesResponse(
        ranked=ranked,
        lookback_days=req.lookback_days,
        outcome_entity_fqn=req.outcome_entity_fqn,
    )
    cache_set(cache_key, resp)
    return resp


def _score_candidate(
    graph: nx.DiGraph,
    cand: CandidateTreatment,
    treatments_df: pd.DataFrame,
    out_buckets: pd.DataFrame,
    outcome_fqn: str,
) -> RankedCause:
    if treatments_df.empty:
        return _empty_result(cand)

    sub = treatments_df[
        (treatments_df["entity_fqn"] == cand.entity_fqn)
        & (treatments_df["event_type"] == cand.event_type)
    ]
    t_buckets = bin_events(sub[["timestamp"]], out_buckets["bucket"].min(), out_buckets["bucket"].max())

    merged = pd.merge(
        t_buckets.rename(columns={"flag": "T"}),
        out_buckets.rename(columns={"flag": "Y"}),
        on="bucket",
        how="inner",
    )
    if merged.empty:
        return _empty_result(cand)

    covariates = backdoor_adjustment_set(graph, cand.entity_fqn, outcome_fqn)
    estimate = fit_backdoor(merged, "T", "Y", covariates)

    placebo = placebo_pvalue(merged["T"].to_numpy(), merged["Y"].to_numpy())
    stab = subset_stability(merged["T"].to_numpy(), merged["Y"].to_numpy())

    return RankedCause(
        treatment=cand,
        effect=estimate.effect,
        p_factual=estimate.p_factual,
        p_counterfactual=estimate.p_counterfactual,
        confidence_interval=(estimate.ci_low, estimate.ci_high),
        refutation=Refutation(placebo_pvalue=placebo, subset_stability=stab),
        method=estimate.method,
        insufficient_data=estimate.insufficient_data,
    )


def _empty_result(cand: CandidateTreatment) -> RankedCause:
    return RankedCause(
        treatment=cand,
        effect=0.0,
        p_factual=0.0,
        p_counterfactual=0.0,
        confidence_interval=(0.0, 0.0),
        refutation=Refutation(placebo_pvalue=1.0, subset_stability=0.0),
        method="insufficient_data",
        insufficient_data=True,
    )
