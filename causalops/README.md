# CausalOps

Causal-inference layer on top of [OpenMetadata](https://github.com/open-metadata/OpenMetadata). Answers:

1. **Counterfactual RCA** — which upstream event caused this data-quality failure?
2. **Intervention simulation** — if I deploy this change, what breaks downstream?

## Prerequisites

- Docker + Docker Compose
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.14.4 --activate`)
- Node.js 20 LTS
- Python 3.12 (only required for local `services/causal-worker` dev outside Docker)

## Quickstart

```bash
pnpm install
cp .env.example .env
docker compose up -d
```

## Service URLs

| Service          | URL                                        |
| ---------------- | ------------------------------------------ |
| OpenMetadata UI  | http://localhost:8585                      |
| OM API           | http://localhost:8585/api                  |
| OM healthcheck   | http://localhost:8586/healthcheck          |
| Postgres (app)   | postgres://causalops:causalops@localhost:5432/causalops |
| TimescaleDB      | postgres://causalops:causalops@localhost:5433/events    |
| Causal worker    | http://localhost:8000                      |

Default OM login: `admin@open-metadata.org` / `admin`.

## Scripts

```bash
pnpm dev        # turbo run dev (all apps)
pnpm build      # turbo run build
pnpm typecheck
pnpm lint
pnpm test
```

## Troubleshooting

- **OM cold start is slow.** First `docker compose up` takes ~3 minutes while MySQL seeds and OpenSearch settles. Healthcheck on `openmetadata-server` has a 180s start-period — expect the container to show `starting` for a while before flipping to `healthy`.
- **Port conflicts.** Postgres on 5432, Timescale on 5433, OM on 8585/8586, causal-worker on 8000. Stop conflicting local services or edit `docker-compose.yml`.
- **Image tags** follow OpenMetadata 1.5.13 official release. OpenSearch pinned to 2.11.1 per OM compatibility matrix.
- **Fresh slate.** `docker compose down -v` wipes Postgres, Timescale, OM MySQL, and OpenSearch volumes.
