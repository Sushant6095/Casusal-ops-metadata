# causal-worker

Python FastAPI service. Fits structural causal models on OM history in
TimescaleDB and answers two questions the catalog cannot.

## Causal inference in 5 bullets (non-expert edition)

- **Correlation ≠ causation.** Two failing tests at the same time may share a
  hidden common cause. Backdoor adjustment controls for those so the remaining
  effect is the *cause* — not the coincidence.
- **Treatment = the thing you changed** (column rename, pipeline status, tag
  add). **Outcome = the thing that broke** (DQ fail, dashboard stale).
- **Counterfactual.** "What would have happened to the outcome if the treatment
  had not occurred?" The gap between factual and counterfactual is the causal
  effect.
- **Intervention.** `do(X=x)` is stronger than observing `X=x`: it cuts the
  arrows coming into X and propagates forward. That's how `/intervention`
  forecasts blast radius of a proposed change.
- **Refutation.** Placebo (shuffle the treatment — the effect should vanish)
  and subset stability (drop rows — sign of the effect should hold) give us a
  cheap sanity check on every estimate.

## Endpoints

- `POST /rank_causes` — rank candidate upstream events by estimated causal
  effect on a failed outcome.
- `POST /intervention` — Monte-Carlo blast-radius for a proposed change.
- `POST /cache/clear` — drop the SCM-fit cache.
- `GET /health` — pool ping + cache size.

## Run

```bash
pip install -e '.[dev]'
uvicorn src.main:app --reload --port 8000
pytest
```

Docker build is the production path — see [Dockerfile](./Dockerfile).
Reads `TIMESCALE_URL` and `LOG_LEVEL` from env.
