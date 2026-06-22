import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Point the app at a fresh, isolated SQLite database. Must be called BEFORE any
 * import that reads `config` (which is evaluated at module load). Returns a
 * cleanup function. Test files invoke this at top level prior to importing the
 * server/auth modules.
 */
export function useTempDatabase(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "firefunc-api-"));
  const path = join(dir, "test.db");
  process.env.DATABASE_PATH = path;
  process.env.NODE_ENV = "test";
  return {
    path,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    },
  };
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}.${randomUUID().slice(0, 8)}@example.test`;
}
