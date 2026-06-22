import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db/index.js";
import { loadMigrations, runMigrations } from "../src/db/migrate.js";
import type { DB } from "../src/db/index.js";

describe("db/migrate", () => {
  let db: DB;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("discovers the 0001..0006 numbered migrations in order", () => {
    const migrations = loadMigrations();
    const ids = migrations.map((m) => m.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
    expect(migrations[0]!.name).toBe("init");
    expect(migrations[1]!.name).toBe("tasks");
  });

  it("applies all pending migrations and records them", () => {
    const applied = runMigrations(db);
    expect(applied).toBe(6);

    const rows = db
      .prepare("SELECT id FROM schema_migrations ORDER BY id")
      .all() as Array<{ id: number }>;
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("creates the expected core tables", () => {
    runMigrations(db);
    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all() as Array<{ name: string }>
    ).map((r) => r.name);
    for (const t of [
      "users",
      "projects",
      "tasks",
      "labels",
      "task_labels",
      "task_comments",
      "task_events",
      "project_counters",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("is idempotent — a second run applies nothing", () => {
    expect(runMigrations(db)).toBe(6);
    expect(runMigrations(db)).toBe(0);
  });
});
