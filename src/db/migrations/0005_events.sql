-- 0005_events: task activity / audit events
CREATE TABLE IF NOT EXISTS task_events (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id   TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,
  from_state TEXT,
  to_state   TEXT,
  payload    TEXT,            -- JSON-encoded metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON task_events(type);
