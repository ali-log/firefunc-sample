import Database from "better-sqlite3";
import { config } from "../shared/config.js";

export type DB = Database.Database;

let singleton: DB | null = null;

/** Open (or reuse) the SQLite database connection. */
export function getDb(path: string = config.databasePath): DB {
  if (singleton) return singleton;
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  singleton = db;
  return db;
}

/** Open a fresh, independent connection (useful for tests). */
export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  return db;
}

/** Close and clear the singleton connection. */
export function closeDb(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}
