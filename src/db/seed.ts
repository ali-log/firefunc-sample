import { getDb } from "./index.js";
import { runMigrations } from "./migrate.js";
import { createUsersRepo } from "./users-repo.js";
import { createProjectsRepo } from "./projects-repo.js";
import { createTasksRepo } from "./tasks-repo.js";
import { logger } from "../shared/logger.js";
import type {
  CreateUserInput,
  Priority,
  Project,
  RecurrenceRule,
  TaskState,
  User,
} from "../shared/types.js";

export interface SeedResult {
  users: number;
  projects: number;
  tasks: number;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

interface SeedTask {
  title: string;
  description?: string;
  priority: Priority;
  state?: TaskState;
  labels?: string[];
  assignee?: "owner" | "dev" | "qa" | null;
  dueInDays?: number;
  slaMinutes?: number;
  recurrence?: RecurrenceRule;
}

/** Populate the database with realistic demo data. Idempotent: safe to re-run. */
export function seed(): SeedResult {
  const db = getDb();
  runMigrations(db);

  const users = createUsersRepo(db);
  const projects = createProjectsRepo(db);
  const tasks = createTasksRepo(db);

  const ensureUser = (input: CreateUserInput): User =>
    users.getByEmail(input.email) ?? users.create(input);

  const owner = ensureUser({
    email: "owner@firefunc.dev",
    name: "Olivia Owner",
    role: "owner",
    avatarUrl: "https://i.pravatar.cc/100?u=owner",
  });
  ensureUser({
    email: "admin@firefunc.dev",
    name: "Avery Admin",
    role: "admin",
    avatarUrl: "https://i.pravatar.cc/100?u=admin",
  });
  const dev = ensureUser({
    email: "dev@firefunc.dev",
    name: "Dana Dev",
    role: "member",
    avatarUrl: "https://i.pravatar.cc/100?u=dev",
  });
  const qa = ensureUser({
    email: "qa@firefunc.dev",
    name: "Quinn QA",
    role: "member",
    avatarUrl: "https://i.pravatar.cc/100?u=qa",
  });
  ensureUser({
    email: "guest@firefunc.dev",
    name: "Vic Viewer",
    role: "viewer",
    avatarUrl: null,
  });

  const assignees = { owner: owner.id, dev: dev.id, qa: qa.id } as const;

  const ensureProject = (
    key: string,
    name: string,
    description: string,
  ): Project =>
    projects.getByKey(key) ??
    projects.create({ key, name, description, ownerId: owner.id });

  const core = ensureProject(
    "FIRE",
    "FireFunc Core",
    "The flagship task tracker product.",
  );
  const infra = ensureProject(
    "OPS",
    "Platform & Infra",
    "Build pipelines, observability, and deploy automation.",
  );

  const plan: Array<[Project, SeedTask[]]> = [
    [
      core,
      [
        {
          title: "Design the REST API surface",
          description: "Lock down the task/project/user endpoints and schemas.",
          priority: "urgent",
          state: "in_progress",
          labels: ["backend", "api"],
          assignee: "dev",
          dueInDays: 2,
          slaMinutes: 480,
        },
        {
          title: "Implement the SQLite data layer",
          description: "Migrations, repos, seed.",
          priority: "high",
          state: "in_progress",
          labels: ["backend", "db"],
          assignee: "dev",
          dueInDays: 3,
        },
        {
          title: "Build the Kanban board UI",
          priority: "high",
          labels: ["frontend"],
          assignee: "qa",
          dueInDays: 6,
        },
        {
          title: "Polish the filter bar",
          priority: "low",
          state: "blocked",
          labels: ["frontend", "ux"],
          assignee: "qa",
        },
        {
          title: "Write integration tests",
          priority: "medium",
          labels: ["backend", "test"],
          assignee: "dev",
          dueInDays: -1, // overdue
        },
        {
          title: "Ship v1.0",
          priority: "urgent",
          state: "done",
          labels: ["release"],
          assignee: "owner",
        },
      ],
    ],
    [
      infra,
      [
        {
          title: "Set up CI pipeline",
          priority: "high",
          state: "done",
          labels: ["infra", "ci"],
          assignee: "owner",
        },
        {
          title: "Add structured logging",
          priority: "medium",
          labels: ["infra", "observability"],
          assignee: "dev",
          dueInDays: 9,
        },
        {
          title: "Weekly dependency audit",
          description: "Recurring security + freshness sweep.",
          priority: "medium",
          labels: ["security"],
          assignee: "owner",
          recurrence: { freq: "weekly", interval: 1, count: null, until: null },
          dueInDays: 7,
        },
        {
          title: "Provision staging environment",
          priority: "low",
          state: "todo",
          labels: ["infra"],
          assignee: null,
        },
      ],
    ],
  ];

  for (const [project, seedTasks] of plan) {
    const already = tasks.list({ projectId: project.id, limit: 1 }).total;
    if (already > 0) continue;
    for (const s of seedTasks) {
      const assigneeId =
        s.assignee && s.assignee in assignees
          ? assignees[s.assignee as keyof typeof assignees]
          : null;
      const created = tasks.create({
        projectId: project.id,
        title: s.title,
        description: s.description ?? null,
        priority: s.priority,
        reporterId: owner.id,
        assigneeId,
        labels: s.labels ?? [],
        dueAt: s.dueInDays !== undefined ? daysFromNow(s.dueInDays) : null,
        slaMinutes: s.slaMinutes ?? null,
        recurrence: s.recurrence ?? null,
      });
      if (s.state && s.state !== "todo") {
        tasks.update(created.id, { state: s.state });
      }
    }
  }

  const result: SeedResult = {
    users: users.list().length,
    projects: projects.list().length,
    tasks:
      tasks.list({ projectId: core.id }).total +
      tasks.list({ projectId: infra.id }).total,
  };
  return result;
}

// CLI entry: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seed();
  logger.info("seed complete", { ...result });
}
