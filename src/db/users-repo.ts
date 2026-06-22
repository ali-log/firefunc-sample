import { randomUUID } from "node:crypto";
import type { DB } from "./index.js";
import { getDb } from "./index.js";
import type {
  CreateUserInput,
  ISODateString,
  UpdateUserInput,
  User,
  UserRole,
} from "../shared/types.js";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

function nowIso(): ISODateString {
  return new Date().toISOString();
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UsersRepo {
  create(input: CreateUserInput): User;
  getById(id: string): User | null;
  getByEmail(email: string): User | null;
  update(id: string, patch: UpdateUserInput): User | null;
  delete(id: string): boolean;
  list(): User[];
}

/** Construct a users repository bound to a DB connection. */
export function createUsersRepo(db: DB = getDb()): UsersRepo {
  const repo: UsersRepo = {
    create(input: CreateUserInput): User {
      const id = randomUUID();
      const ts = nowIso();
      const row: UserRow = {
        id,
        email: input.email,
        name: input.name,
        role: input.role ?? "member",
        avatar_url: input.avatarUrl ?? null,
        created_at: ts,
        updated_at: ts,
      };
      db.prepare(
        `INSERT INTO users (id, email, name, role, avatar_url, created_at, updated_at)
         VALUES (@id, @email, @name, @role, @avatar_url, @created_at, @updated_at)`,
      ).run(row);
      return mapUser(row);
    },

    getById(id: string): User | null {
      const row = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(id) as UserRow | undefined;
      return row ? mapUser(row) : null;
    },

    getByEmail(email: string): User | null {
      const row = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email) as UserRow | undefined;
      return row ? mapUser(row) : null;
    },

    update(id: string, patch: UpdateUserInput): User | null {
      const existing = repo.getById(id);
      if (!existing) return null;
      const next: User = {
        ...existing,
        name: patch.name ?? existing.name,
        role: patch.role ?? existing.role,
        avatarUrl:
          patch.avatarUrl !== undefined ? patch.avatarUrl : existing.avatarUrl,
        updatedAt: nowIso(),
      };
      db.prepare(
        `UPDATE users
         SET name = @name, role = @role, avatar_url = @avatar_url, updated_at = @updated_at
         WHERE id = @id`,
      ).run({
        id,
        name: next.name,
        role: next.role,
        avatar_url: next.avatarUrl,
        updated_at: next.updatedAt,
      });
      return next;
    },

    delete(id: string): boolean {
      const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
      return info.changes > 0;
    },

    list(): User[] {
      const rows = db
        .prepare("SELECT * FROM users ORDER BY created_at ASC, id ASC")
        .all() as UserRow[];
      return rows.map(mapUser);
    },
  };
  return repo;
}
