-- 0006_indexes: performance + reporting indexes
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project_state ON tasks(project_id, state);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at);

-- A simple counter table for per-project sequential task numbers.
CREATE TABLE IF NOT EXISTS project_counters (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);
