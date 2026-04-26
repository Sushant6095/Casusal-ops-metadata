"""Load lineage, treatments, and outcomes from TimescaleDB."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol

import asyncpg
import networkx as nx
import pandas as pd


@dataclass(frozen=True)
class LineageEdge:
    from_fqn: str
    to_fqn: str
    from_column: str | None
    to_column: str | None


class DataLoader(Protocol):
    """Abstraction so tests can swap in a fake."""

    async def lineage_graph(self) -> nx.DiGraph: ...

    async def treatments(
        self, entity_fqns: list[str], start: datetime, end: datetime
    ) -> pd.DataFrame: ...

    async def outcomes(
        self,
        outcome_entity_fqn: str,
        start: datetime,
        end: datetime,
        test_case_fqn: str | None,
    ) -> pd.DataFrame: ...


class TimescaleLoader:
    """Default loader backed by asyncpg pool."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def lineage_graph(self) -> nx.DiGraph:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT from_fqn, to_fqn, from_column, to_column FROM lineage_edges"
            )
        g: nx.DiGraph = nx.DiGraph()
        for r in rows:
            g.add_edge(
                r["from_fqn"],
                r["to_fqn"],
                from_column=r["from_column"],
                to_column=r["to_column"],
            )
        return g

    async def treatments(
        self, entity_fqns: list[str], start: datetime, end: datetime
    ) -> pd.DataFrame:
        if not entity_fqns:
            return pd.DataFrame(
                columns=["timestamp", "entity_fqn", "event_type"],
            )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT timestamp, entity_fqn, event_type
                  FROM change_events
                 WHERE entity_fqn = ANY($1::text[])
                   AND timestamp >= $2
                   AND timestamp <  $3
                 ORDER BY timestamp
                """,
                entity_fqns,
                start,
                end,
            )
        return pd.DataFrame(
            [
                {
                    "timestamp": r["timestamp"],
                    "entity_fqn": r["entity_fqn"],
                    "event_type": r["event_type"],
                }
                for r in rows
            ]
        )

    async def outcomes(
        self,
        outcome_entity_fqn: str,
        start: datetime,
        end: datetime,
        test_case_fqn: str | None,
    ) -> pd.DataFrame:
        query = """
            SELECT timestamp, test_case_fqn, status
              FROM test_case_results
             WHERE entity_fqn = $1
               AND timestamp >= $2
               AND timestamp <  $3
        """
        args: list[object] = [outcome_entity_fqn, start, end]
        if test_case_fqn is not None:
            query += " AND test_case_fqn = $4"
            args.append(test_case_fqn)
        query += " ORDER BY timestamp"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        return pd.DataFrame(
            [
                {
                    "timestamp": r["timestamp"],
                    "test_case_fqn": r["test_case_fqn"],
                    "status": r["status"],
                }
                for r in rows
            ]
        )


def bin_events(
    df: pd.DataFrame, start: datetime, end: datetime, bucket_hours: int = 1
) -> pd.DataFrame:
    """Bin a timestamp-indexed frame into fixed-width buckets with a 0/1 flag."""
    freq = f"{bucket_hours}h"
    start_u = pd.Timestamp(start)
    end_u = pd.Timestamp(end)
    if start_u.tz is None:
        start_u = start_u.tz_localize("UTC")
    else:
        start_u = start_u.tz_convert("UTC")
    if end_u.tz is None:
        end_u = end_u.tz_localize("UTC")
    else:
        end_u = end_u.tz_convert("UTC")
    start_u = start_u.floor(freq)
    end_u = end_u.floor(freq)
    idx = pd.date_range(start=start_u, end=end_u, freq=freq)
    if df.empty:
        return pd.DataFrame({"bucket": idx, "flag": 0})
    s = pd.to_datetime(df["timestamp"], utc=True)
    counts = s.groupby(s.dt.floor(freq)).size()
    out = pd.DataFrame({"bucket": idx})
    out["flag"] = out["bucket"].map(counts).fillna(0).astype(int).clip(0, 1)
    return out


def default_window(lookback_days: int, end: datetime | None = None) -> tuple[datetime, datetime]:
    end_t = end if end is not None else datetime.now(tz=timezone.utc)
    return end_t - timedelta(days=lookback_days), end_t
