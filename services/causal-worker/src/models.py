"""Pydantic request/response models for the causal-worker API."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TimeWindow(BaseModel):
    start: datetime
    end: datetime


class CandidateTreatment(BaseModel):
    entity_fqn: str
    event_type: str
    timestamp: datetime


class RankCausesRequest(BaseModel):
    outcome_entity_fqn: str
    outcome_window: TimeWindow
    candidate_treatments: list[CandidateTreatment]
    lookback_days: int = Field(default=30, ge=1, le=365)
    outcome_test_case_fqn: str | None = None


class Refutation(BaseModel):
    placebo_pvalue: float
    subset_stability: float


class RankedCause(BaseModel):
    treatment: CandidateTreatment
    effect: float
    p_factual: float
    p_counterfactual: float
    confidence_interval: tuple[float, float]
    refutation: Refutation
    method: str
    insufficient_data: bool = False


class RankCausesResponse(BaseModel):
    ranked: list[RankedCause]
    lookback_days: int
    outcome_entity_fqn: str


class InterventionRequest(BaseModel):
    target_entity_fqn: str
    action: str
    action_payload: dict[str, Any] = Field(default_factory=dict)
    downstream_depth: int = Field(default=4, ge=1, le=10)
    monte_carlo_samples: int = Field(default=1000, ge=100, le=50000)


class BlastRadiusNode(BaseModel):
    entity_fqn: str
    p_break: float
    path: list[str]
    reason: str


class InterventionResponse(BaseModel):
    blast_radius: list[BlastRadiusNode]
    top_at_risk: list[BlastRadiusNode]
    samples: int


class HealthResponse(BaseModel):
    status: str
    db: str
    cache_size: int
