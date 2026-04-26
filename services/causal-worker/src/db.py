"""asyncpg pool to TimescaleDB (read-only)."""
from __future__ import annotations

import logging
import os

import asyncpg

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


def _dsn() -> str:
    return os.environ.get(
        "TIMESCALE_URL",
        "postgres://causalops:causalops@localhost:5433/events",
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=_dsn(),
            min_size=1,
            max_size=int(os.environ.get("DB_POOL_MAX", "5")),
            command_timeout=30,
        )
        logger.info("timescale pool opened")
    assert _pool is not None
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("timescale pool closed")


async def healthcheck() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as err:  # pragma: no cover - health path
        logger.warning("healthcheck failed: %s", err)
        return False
