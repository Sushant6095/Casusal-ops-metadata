"""Tests for the causal-worker HTTP endpoints with a fake DataLoader."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import networkx as nx
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src import db as db_module
from src import scm_fit
from src.data_loader import DataLoader
from src.main import app, get_loader


class FakeLoader:
    def __init__(
        self,
        graph: nx.DiGraph,
        treatments: pd.DataFrame,
        outcomes: pd.DataFrame,
    ) -> None:
        self._graph = graph
        self._treatments = treatments
        self._outcomes = outcomes

    async def lineage_graph(self) -> nx.DiGraph:
        return self._graph

    async def treatments(self, entity_fqns, start, end):  # type: ignore[no-untyped-def]
        df = self._treatments
        if df.empty:
            return df
        return df[df["entity_fqn"].isin(entity_fqns)]

    async def outcomes(self, outcome_entity_fqn, start, end, test_case_fqn):  # type: ignore[no-untyped-def]
        return self._outcomes


def _build_loader_with_causal_data() -> DataLoader:
    graph = nx.DiGraph()
    graph.add_edge("A", "B")
    now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    # Treatment on A happens in buckets 0, 2, 4 (within the last 5 days).
    # Outcome on B always follows by 1h.
    t_rows = []
    o_rows = []
    for i in range(0, 120, 2):
        ts = now - timedelta(hours=i)
        t_rows.append({"timestamp": ts, "entity_fqn": "A", "event_type": "schemaChanged"})
        o_rows.append({"timestamp": ts + timedelta(minutes=15), "test_case_fqn": "B.test", "status": "Failed"})
    # Add some non-failures without treatment to establish baseline.
    for i in range(1, 120, 2):
        ts = now - timedelta(hours=i)
        o_rows.append({"timestamp": ts, "test_case_fqn": "B.test", "status": "Success"})
    return FakeLoader(
        graph=graph,
        treatments=pd.DataFrame(t_rows),
        outcomes=pd.DataFrame(o_rows),
    )  # type: ignore[return-value]


@pytest.fixture(autouse=True)
def _no_db(monkeypatch):  # type: ignore[no-untyped-def]
    async def fake_healthcheck() -> bool:
        return True

    async def fake_get_pool():  # type: ignore[no-untyped-def]
        return None

    async def fake_close_pool() -> None:
        return None

    monkeypatch.setattr(db_module, "healthcheck", fake_healthcheck)
    monkeypatch.setattr(db_module, "get_pool", fake_get_pool)
    monkeypatch.setattr(db_module, "close_pool", fake_close_pool)
    scm_fit.cache_clear()


def test_rank_causes_happy_path() -> None:
    loader = _build_loader_with_causal_data()
    app.dependency_overrides[get_loader] = lambda: loader
    try:
        client = TestClient(app)
        now = datetime.now(tz=timezone.utc)
        payload = {
            "outcome_entity_fqn": "B",
            "outcome_window": {
                "start": (now - timedelta(days=5)).isoformat(),
                "end": now.isoformat(),
            },
            "candidate_treatments": [
                {
                    "entity_fqn": "A",
                    "event_type": "schemaChanged",
                    "timestamp": now.isoformat(),
                },
                {
                    "entity_fqn": "C",
                    "event_type": "ownerChange",
                    "timestamp": now.isoformat(),
                },
            ],
            "lookback_days": 5,
        }
        res = client.post("/rank_causes", json=payload)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["outcome_entity_fqn"] == "B"
        assert len(body["ranked"]) == 2
        # The real cause A should outrank C.
        assert body["ranked"][0]["treatment"]["entity_fqn"] == "A"
        assert 0.0 <= body["ranked"][0]["p_factual"] <= 1.0
        assert body["ranked"][0]["effect"] > body["ranked"][1]["effect"]
    finally:
        app.dependency_overrides.pop(get_loader, None)


def test_rank_causes_empty_candidates_returns_empty_ranking() -> None:
    loader = _build_loader_with_causal_data()
    app.dependency_overrides[get_loader] = lambda: loader
    try:
        client = TestClient(app)
        now = datetime.now(tz=timezone.utc)
        payload = {
            "outcome_entity_fqn": "B",
            "outcome_window": {
                "start": (now - timedelta(days=5)).isoformat(),
                "end": now.isoformat(),
            },
            "candidate_treatments": [],
            "lookback_days": 5,
        }
        res = client.post("/rank_causes", json=payload)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["ranked"] == []
    finally:
        app.dependency_overrides.pop(get_loader, None)


def test_intervention_disconnected_node_returns_empty_blast() -> None:
    graph = nx.DiGraph()
    graph.add_edge("X", "Y")
    loader = FakeLoader(graph=graph, treatments=pd.DataFrame(), outcomes=pd.DataFrame())
    app.dependency_overrides[get_loader] = lambda: loader  # type: ignore[assignment]
    try:
        client = TestClient(app)
        payload = {
            "target_entity_fqn": "Z_not_in_graph",
            "action": "drop_column",
            "action_payload": {"column": "foo"},
            "downstream_depth": 3,
            "monte_carlo_samples": 200,
        }
        res = client.post("/intervention", json=payload)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["blast_radius"] == []
        assert body["top_at_risk"] == []
        assert body["samples"] == 200
    finally:
        app.dependency_overrides.pop(get_loader, None)


def test_health_reports_cache_size() -> None:
    client = TestClient(app)
    scm_fit.cache_clear()
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["cache_size"] == 0
