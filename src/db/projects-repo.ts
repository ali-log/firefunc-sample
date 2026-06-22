import { randomUUID } from "node:crypto";
import type { DB } from "./index.js";
import { getDb } from "./index.js";
import type {
  CreateProjectInput,
  ISODateString,
  Project,
  ProjectStatus,
  UpdateProjectInput,
} from "../shared/types.js";

interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

function nowIso(): ISODateString {
  return new Date().toISOString();
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    status: row.status as ProjectStatus,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProjectsRepo {
  create(input: CreateProjectInput): Project;
  getById(id: string): Project | null;
  getByKey(key: string): Project | null;
  update(id: string, patch: UpdateProjectInput): Project | null;
  delete(id: string): boolean;
  list(opts?: { includeArchived?: boolean }): Project[];
  nextTaskNumber(projectId: string): number;
}

/** Construct a projects repository bound to a DB connection. */
export function createProjectsRepo(db: DB = getDb()): ProjectsRepo {
  const repo: ProjectsRepo = {
    create(input: CreateProjectInput): Project {
      const id = randomUUID();
      const ts = nowIso();
      const row: ProjectRow = {
        id,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        status: "active",
        owner_id: input.ownerId,
        created_at: ts,
        updated_at: ts,
      };
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO projects (id, key, name, description, status, owner_id, created_at, updated_at)
           VALUES (@id, @key, @name, @description, @status, @owner_id, @created_at, @updated_at)`,
        ).run(row);
        db.prepare(
          "INSERT INTO project_counters (project_id, last_number) VALUES (?, 0)",
        ).run(id);
      });
      tx();
      return mapProject(row);
    },

    getById(id: string): Project | null {
      const row = db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(id) as ProjectRow | undefined;
      return row ? mapProject(row) : null;
    },

    getByKey(key: string): Project | null {
      const row = db
        .prepare("SELECT * FROM projects WHERE key = ?")
        .get(key) as ProjectRow | undefined;
      return row ? mapProject(row) : null;
    },

    update(id: string, patch: UpdateProjectInput): Project | null {
      const existing = repo.getById(id);
      if (!existing) return null;
      const next: Project = {
        ...existing,
        name: patch.name ?? existing.name,
        description:
          patch.description !== undefined
            ? patch.description
            : existing.description,
        status: patch.status ?? existing.status,
        updatedAt: nowIso(),
      };
      db.prepare(
        `UPDATE projects
         SET name = @name, description = @description, status = @status, updated_at = @updated_at
         WHERE id = @id`,
      ).run({
        id,
        name: next.name,
        description: next.description,
        status: next.status,
        updated_at: next.updatedAt,
      });
      return next;
    },

    delete(id: string): boolean {
      const info = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
      return info.changes > 0;
    },

    list(opts: { includeArchived?: boolean } = {}): Project[] {
      // Archived projects are excluded by default; callers opt in explicitly.
      const sql = opts.includeArchived
        ? "SELECT * FROM projects ORDER BY created_at ASC, id ASC"
        : "SELECT * FROM projects WHERE status != 'archived' ORDER BY created_at ASC, id ASC";
      const rows = db.prepare(sql).all() as ProjectRow[];
      return rows.map(mapProject);
    },

    /** Atomically allocate and return the next sequential task number. */
    nextTaskNumber(projectId: string): number {
      const tx = db.transaction((pid: string): number => {
        db.prepare(
          `INSERT INTO project_counters (project_id, last_number)
           VALUES (?, 0)
           ON CONFLICT(project_id) DO NOTHING`,
        ).run(pid);
        db.prepare(
          "UPDATE project_counters SET last_number = last_number + 1 WHERE project_id = ?",
        ).run(pid);
        const row = db
          .prepare(
            "SELECT last_number FROM project_counters WHERE project_id = ?",
          )
          .get(pid) as { last_number: number } | undefined;
        return row ? row.last_number : 0;
      });
      return tx(projectId);
    },
  };
  return repo;
}
