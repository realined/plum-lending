CREATE TABLE IF NOT EXISTS worker_heartbeats (mode text PRIMARY KEY CHECK(mode IN ('demo','live')), last_seen timestamptz NOT NULL);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
