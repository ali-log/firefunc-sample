import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./index.js";
import { getDb } from "./index.js";
import { logger } from "../shared/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

/** Discover numbered .sql migrations sorted ascending. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((file) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(file);
    const id = match ? Number.parseInt(match[1]!, 10) : 0;
    const name = match ? match[2]! : file;
    return { id, name, sql: readFileSync(join(dir, file), "utf8") };
  });
}

function ensureMigrationsTable(db: DB): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`,
  );
}

function appliedIds(db: DB): Set<number> {
  const rows = db
    .prepare("SELECT id FROM schema_migrations")
    .all() as Array<{ id: number }>;
  return new Set(rows.map((r) => r.id));
}

/** Apply all pending migrations. Returns count applied. */
export function runMigrations(
  db: DB = getDb(),
  dir: string = MIGRATIONS_DIR,
): number {
  ensureMigrationsTable(db);
  const done = appliedIds(db);
  const pending = loadMigrations(dir).filter((m) => !done.has(m.id));
  let applied = 0;
  for (const m of pending) {
    const tx = db.transaction(() => {
      db.exec(m.sql);
      db.prepare(
        "INSERT INTO schema_migrations (id, name) VALUES (?, ?)",
      ).run(m.id, m.name);
    });
    tx();
    applied += 1;
    logger.info("migration applied", { id: m.id, name: m.name });
  }
  return applied;
}

// CLI entry: `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = runMigrations();
  logger.info("migrations complete", { applied: count });
}
