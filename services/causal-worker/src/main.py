"""FastAPI entrypoint for the CausalOps causal worker."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException

from . import db as db_module
from . import scm_fit
from .counterfactual import rank_causes
from .data_loader import DataLoader, TimescaleLoader
from .intervention import propagate_intervention
from .models import (
    HealthResponse,
    InterventionRequest,
    InterventionResponse,
    RankCausesRequest,
    RankCausesResponse,
)

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("causalops.worker")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("starting causal-worker")
    try:
        await db_module.get_pool()
    except Exception as err:  # pragma: no cover - startup
        logger.warning("db pool unavailable at startup: %s", err)
    yield
    await db_module.close_pool()


app = FastAPI(title="CausalOps Causal Worker", version="0.1.0", lifespan=lifespan)


async def get_loader() -> DataLoader:
    pool = await db_module.get_pool()
    return TimescaleLoader(pool)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    db_ok = await db_module.healthcheck()
    return HealthResponse(
        status="ok",
        db="ok" if db_ok else "degraded",
        cache_size=scm_fit.cache_size(),
    )


@app.post("/rank_causes", response_model=RankCausesResponse)
async def rank_causes_endpoint(
    req: RankCausesRequest, loader: DataLoader = Depends(get_loader)
) -> RankCausesResponse:
    try:
        return await rank_causes(req, loader)
    except Exception as err:
        logger.exception("rank_causes failed")
        raise HTTPException(status_code=500, detail=str(err)) from err


@app.post("/intervention", response_model=InterventionResponse)
async def intervention_endpoint(
    req: InterventionRequest, loader: DataLoader = Depends(get_loader)
) -> InterventionResponse:
    try:
        return await propagate_intervention(req, loader)
    except Exception as err:
        logger.exception("intervention failed")
        raise HTTPException(status_code=500, detail=str(err)) from err


@app.post("/cache/clear")
async def clear_cache() -> dict[str, int]:
    before = scm_fit.cache_size()
    scm_fit.cache_clear()
    return {"cleared": before, "remaining": scm_fit.cache_size()}
