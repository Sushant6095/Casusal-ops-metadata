# Architecture

CausalOps layers causal inference on top of OpenMetadata without forking the
catalog. Every write is absorbed by the upstream platform (entity extensions,
change events, test results); every read happens against a read-optimized
projection in TimescaleDB. The Python worker is purely stateless math.

## 1 · System context

```mermaid
graph LR
  user[Data engineer / oncall]
  user -->|web UI| web[Next.js web · 3000]
  user -->|chat| om_ui[OM UI · 8585]
  om_ui -->|MCP| mcp[CausalOps MCP · stdio/3100]
  mcp -->|tRPC| api[CausalOps API · 3001]
  web -->|tRPC| api
  om_ui -->|webhook| api
  api -->|HTTP| worker[causal-worker · 8000]
  api --> om[(OpenMetadata · 8585)]
  worker --> ts[(TimescaleDB · 5433)]
  ingestor[Ingestor] --> ts
  ingestor --> om
```

## 2 · Data flow

```mermaid
flowchart LR
  OM[(OpenMetadata<br/>MySQL + OpenSearch)]
  ING[Ingestor<br/>pollLineage/pollEvents/pollTestResults]
  TS[(TimescaleDB<br/>hypertables)]
  WKR[causal-worker<br/>FastAPI + DoWhy]
  API[API<br/>Fastify + tRPC]
  WEB[Web]
  MCP[MCP]

  OM -- REST --> ING
  OM -- webhook --> API
  ING -- drizzle upsert --> TS
  API -- asyncpg read --> TS
  API -- REST --> WKR
  WKR -- asyncpg read --> TS
  API -- PATCH extension --> OM
  WEB -- tRPC --> API
  MCP -- tRPC --> API
```

Hypertables: `change_events` and `test_case_results` are 1-day-chunked so
30-day lookbacks fan out across ~30 chunks and stay fast.

## 3 · Sequence: one `rank_causes` call

```mermaid
sequenceDiagram
  actor U as User
  participant W as Web
  participant A as API
  participant D as TimescaleDB
  participant P as causal-worker
  participant O as OpenMetadata

  U->>W: Click "Run RCA" on /why/<fqn>
  W->>A: trpc counterfactual.rankCauses
  A->>D: SELECT ancestors (lineage_edges BFS)
  A->>D: SELECT change_events WHERE entity IN ancestors
  A->>P: POST /rank_causes {candidates, window}
  P->>D: SELECT test_case_results (outcome window)
  P->>P: Backdoor adjustment + refutation
  P-->>A: ranked[] with effects + CI
  A->>O: PATCH /tables/name/<fqn> extension=risk
  A-->>W: ranked + narration
  W-->>U: Render CandidateRanking + EvidencePanel
```

## 4 · Deployment (docker-compose)

```mermaid
graph TB
  subgraph host[localhost]
    subgraph net[causalops-net]
      om_server[openmetadata-server :8585]
      om_mysql[openmetadata-mysql]
      om_es[openmetadata-es]
      om_ing[openmetadata-ingestion]
      pg[postgres :5432]
      ts[timescaledb :5433]
      redis[redis :6379]
      wkr[causal-worker :8000]
    end
    api[apps/api :3001]
    web[apps/web :3000]
    mcp[apps/mcp · stdio]
    ingestor[ingestor · local node]
  end
  om_server --- om_mysql
  om_server --- om_es
  om_server --- om_ing
```

All images pinned to OpenMetadata 1.5.13 + OpenSearch 2.11.1 + Postgres 16 +
TimescaleDB latest-pg16 + Redis 7-alpine. Volumes persist MySQL, OpenSearch,
Postgres, and TimescaleDB.
