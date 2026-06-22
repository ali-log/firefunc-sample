-- 0002_tasks: core tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id),
  parent_id      TEXT REFERENCES tasks(id),
  title          TEXT NOT NULL,
  description    TEXT,
  state          TEXT NOT NULL DEFAULT 'todo',
  priority       TEXT NOT NULL DEFAULT 'medium',
  assignee_id    TEXT REFERENCES users(id),
  reporter_id    TEXT NOT NULL REFERENCES users(id),
  estimate_hours REAL,
  due_at         TEXT,
  sla_minutes    INTEGER,
  recurrence     TEXT,            -- JSON-encoded RecurrenceRule
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
