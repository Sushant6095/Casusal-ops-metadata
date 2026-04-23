-- CausalOps ingestor init — Postgres/Timescale schema.
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS entities (
  fqn           TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  name          TEXT NOT NULL,
  service       TEXT,
  owner_fqn     TEXT,
  tags          JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw           JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS entities_type_idx ON entities (entity_type);

CREATE TABLE IF NOT EXISTS lineage_edges (
  id              BIGSERIAL PRIMARY KEY,
  from_fqn        TEXT NOT NULL,
  to_fqn          TEXT NOT NULL,
  from_column     TEXT,
  to_column       TEXT,
  transformation  TEXT,
  discovered_at   TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS lineage_edge_uniq
  ON lineage_edges (from_fqn, to_fqn, COALESCE(from_column, ''), COALESCE(to_column, ''));
CREATE INDEX IF NOT EXISTS lineage_from_idx ON lineage_edges (from_fqn);
CREATE INDEX IF NOT EXISTS lineage_to_idx   ON lineage_edges (to_fqn);

CREATE TABLE IF NOT EXISTS change_events (
  id             TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL,
  entity_fqn     TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  change_fields  JSONB NOT NULL,
  raw            JSONB NOT NULL,
  PRIMARY KEY (id, timestamp)
);
CREATE INDEX IF NOT EXISTS change_events_entity_idx
  ON change_events (entity_fqn, timestamp DESC);
SELECT create_hypertable('change_events', 'timestamp',
                         chunk_time_interval => INTERVAL '1 day',
                         if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS test_case_results (
  id             TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL,
  test_case_fqn  TEXT NOT NULL,
  entity_fqn     TEXT NOT NULL,
  status         TEXT NOT NULL,
  result_value   JSONB,
  raw            JSONB NOT NULL,
  PRIMARY KEY (id, timestamp)
);
CREATE INDEX IF NOT EXISTS test_results_entity_idx
  ON test_case_results (entity_fqn, timestamp DESC);
CREATE INDEX IF NOT EXISTS test_results_status_idx
  ON test_case_results (status, timestamp DESC);
SELECT create_hypertable('test_case_results', 'timestamp',
                         chunk_time_interval => INTERVAL '1 day',
                         if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS ingestion_cursors (
  stream      TEXT PRIMARY KEY,
  last_ts     TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
