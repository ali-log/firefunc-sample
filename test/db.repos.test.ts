import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db/index.js";
import { runMigrations } from "../src/db/migrate.js";
import { createUsersRepo } from "../src/db/users-repo.js";
import { createProjectsRepo } from "../src/db/projects-repo.js";
import { createTasksRepo } from "../src/db/tasks-repo.js";
import type { DB } from "../src/db/index.js";
import type { Project, User } from "../src/shared/types.js";

describe("db repositories", () => {
  let db: DB;
  let users: ReturnType<typeof createUsersRepo>;
  let projects: ReturnType<typeof createProjectsRepo>;
  let tasks: ReturnType<typeof createTasksRepo>;
  let owner: User;
  let project: Project;

  beforeEach(() => {
    db = openDb(":memory:");
    runMigrations(db);
    users = createUsersRepo(db);
    projects = createProjectsRepo(db);
    tasks = createTasksRepo(db);
    owner = users.create({
      email: "owner@example.com",
      name: "Owner",
      role: "owner",
    });
    project = projects.create({
      key: "DEMO",
      name: "Demo",
      ownerId: owner.id,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe("users-repo", () => {
    it("creates, reads, and looks up by email", () => {
      const u = users.create({ email: "a@b.com", name: "Alice" });
      expect(u.id).toBeTruthy();
      expect(u.role).toBe("member"); // default
      expect(u.avatarUrl).toBeNull();
      expect(users.getById(u.id)?.email).toBe("a@b.com");
      expect(users.getByEmail("a@b.com")?.id).toBe(u.id);
      expect(users.getByEmail("missing@b.com")).toBeNull();
    });

    it("updates only the provided fields", () => {
      const u = users.create({ email: "c@d.com", name: "Carol" });
      const updated = users.update(u.id, { name: "Caroline", role: "admin" });
      expect(updated?.name).toBe("Caroline");
      expect(updated?.role).toBe("admin");
      expect(updated?.email).toBe("c@d.com");
      expect(users.update("nope", { name: "x" })).toBeNull();
    });

    it("deletes and lists", () => {
      const u = users.create({ email: "e@f.com", name: "Eve" });
      expect(users.list().length).toBeGreaterThanOrEqual(2);
      expect(users.delete(u.id)).toBe(true);
      expect(users.delete(u.id)).toBe(false);
      expect(users.getById(u.id)).toBeNull();
    });
  });

  describe("projects-repo", () => {
    it("creates and looks up by key", () => {
      expect(project.status).toBe("active");
      expect(projects.getByKey("DEMO")?.id).toBe(project.id);
      expect(projects.getById(project.id)?.key).toBe("DEMO");
    });

    it("updates status and description", () => {
      const updated = projects.update(project.id, {
        status: "archived",
        description: "done",
      });
      expect(updated?.status).toBe("archived");
      expect(updated?.description).toBe("done");
    });

    it("allocates strictly increasing task numbers", () => {
      const a = projects.nextTaskNumber(project.id);
      const b = projects.nextTaskNumber(project.id);
      const c = projects.nextTaskNumber(project.id);
      expect([a, b, c]).toEqual([1, 2, 3]);
    });
  });

  describe("tasks-repo", () => {
    it("creates with defaults and round-trips labels + recurrence", () => {
      const t = tasks.create({
        projectId: project.id,
        title: "First task",
        reporterId: owner.id,
        labels: ["backend", "urgent-thing"],
        recurrence: { freq: "weekly", interval: 2, count: 5, until: null },
      });
      expect(t.state).toBe("todo");
      expect(t.priority).toBe("medium");
      expect(t.labels).toEqual(["backend", "urgent-thing"]);
      expect(t.recurrence).toEqual({
        freq: "weekly",
        interval: 2,
        count: 5,
        until: null,
      });
      const fetched = tasks.getById(t.id);
      expect(fetched?.labels).toEqual(["backend", "urgent-thing"]);
      expect(fetched?.recurrence?.freq).toBe("weekly");
    });

    it("assigns appended positions per project", () => {
      const a = tasks.create({
        projectId: project.id,
        title: "A",
        reporterId: owner.id,
      });
      const b = tasks.create({
        projectId: project.id,
        title: "B",
        reporterId: owner.id,
      });
      expect(b.position).toBe(a.position + 1);
    });

    it("sets completed_at when transitioning to done and clears it when leaving", () => {
      const t = tasks.create({
        projectId: project.id,
        title: "Done me",
        reporterId: owner.id,
      });
      expect(t.completedAt).toBeNull();
      const done = tasks.update(t.id, { state: "done" });
      expect(done?.state).toBe("done");
      expect(done?.completedAt).not.toBeNull();
      const reopened = tasks.update(t.id, { state: "in_progress" });
      expect(reopened?.completedAt).toBeNull();
    });

    it("updates labels by full replacement", () => {
      const t = tasks.create({
        projectId: project.id,
        title: "Labelled",
        reporterId: owner.id,
        labels: ["one", "two"],
      });
      const updated = tasks.update(t.id, { labels: ["three"] });
      expect(updated?.labels).toEqual(["three"]);
    });

    it("deletes a task and cascades its labels", () => {
      const t = tasks.create({
        projectId: project.id,
        title: "Bye",
        reporterId: owner.id,
        labels: ["temp"],
      });
      expect(tasks.delete(t.id)).toBe(true);
      expect(tasks.getById(t.id)).toBeNull();
      const links = db
        .prepare("SELECT COUNT(*) AS n FROM task_labels WHERE task_id = ?")
        .get(t.id) as { n: number };
      expect(links.n).toBe(0);
    });

    it("counts tasks by state", () => {
      tasks.create({ projectId: project.id, title: "t1", reporterId: owner.id });
      const t2 = tasks.create({
        projectId: project.id,
        title: "t2",
        reporterId: owner.id,
      });
      tasks.update(t2.id, { state: "in_progress" });
      const counts = tasks.countByState(project.id);
      expect(counts.todo).toBe(1);
      expect(counts.in_progress).toBe(1);
      expect(counts.blocked).toBe(0);
      expect(counts.done).toBe(0);
    });

    describe("list() filtering, sorting, pagination", () => {
      beforeEach(() => {
        const seed: Array<[string, "low" | "high" | "urgent", string[]]> = [
          ["Alpha", "low", ["x"]],
          ["Bravo", "high", ["x", "y"]],
          ["Charlie", "urgent", ["y"]],
          ["Delta", "high", []],
        ];
        for (const [title, priority, labels] of seed) {
          tasks.create({
            projectId: project.id,
            title,
            priority,
            reporterId: owner.id,
            labels,
          });
        }
      });

      it("filters by project and returns a Paginated shape", () => {
        const page = tasks.list({ projectId: project.id });
        expect(page.total).toBe(4);
        expect(page.items).toHaveLength(4);
        expect(page.limit).toBe(50);
        expect(page.offset).toBe(0);
      });

      it("filters by a single priority and by a priority array", () => {
        expect(tasks.list({ priority: "high" }).total).toBe(2);
        expect(tasks.list({ priority: ["high", "urgent"] }).total).toBe(3);
      });

      it("filters by search across title", () => {
        const r = tasks.list({ search: "ravo" });
        expect(r.total).toBe(1);
        expect(r.items[0]!.title).toBe("Bravo");
      });

      it("filters by label (AND semantics)", () => {
        expect(tasks.list({ labels: ["x"] }).total).toBe(2);
        expect(tasks.list({ labels: ["x", "y"] }).total).toBe(1);
      });

      it("sorts by priority weight descending", () => {
        const r = tasks.list({ sort: "priority", order: "desc" });
        expect(r.items[0]!.priority).toBe("urgent");
        const last = r.items[r.items.length - 1]!;
        expect(last.priority).toBe("low");
      });

      it("paginates with limit and offset while reporting full total", () => {
        const page1 = tasks.list({ sort: "title", order: "asc", limit: 2, offset: 0 });
        const page2 = tasks.list({ sort: "title", order: "asc", limit: 2, offset: 2 });
        expect(page1.total).toBe(4);
        expect(page1.items).toHaveLength(2);
        expect(page2.items).toHaveLength(2);
        expect(page1.items[0]!.title).toBe("Alpha");
        expect(page2.items[0]!.title).toBe("Charlie");
      });
    });
  });
});
