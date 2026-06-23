import { describe, expect, it } from "vitest";
import { isOverdue } from "../src/core/overdue.js";
import type { Task, TaskState } from "../src/shared/types.js";

function makeTask(over: Partial<Task> = {}): Task {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return {
    id: "t1",
    projectId: "p1",
    parentId: null,
    title: "Task",
    description: null,
    state: "todo",
    priority: "medium",
    assigneeId: null,
    reporterId: "u1",
    labels: [],
    estimateHours: null,
    dueAt: null,
    slaMinutes: null,
    recurrence: null,
    position: 0,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    ...over,
  };
}

const NOW = new Date("2026-06-23T12:00:00.000Z");

describe("isOverdue", () => {
  it("is true when dueAt is in the past and the task is not done", () => {
    const task = makeTask({ dueAt: "2026-06-23T11:00:00.000Z", state: "in_progress" });
    expect(isOverdue(task, NOW)).toBe(true);
  });

  it("is false when dueAt is in the future (not yet due)", () => {
    const task = makeTask({ dueAt: "2026-06-23T13:00:00.000Z" });
    expect(isOverdue(task, NOW)).toBe(false);
  });

  it("is false when the task has no dueAt", () => {
    const task = makeTask({ dueAt: null });
    expect(isOverdue(task, NOW)).toBe(false);
  });

  it("is false when the task is done, even if dueAt is in the past", () => {
    const task = makeTask({ dueAt: "2026-06-23T11:00:00.000Z", state: "done" });
    expect(isOverdue(task, NOW)).toBe(false);
  });

  it("is overdue across every non-done state when past due", () => {
    for (const state of ["todo", "in_progress", "blocked"] as TaskState[]) {
      const task = makeTask({ dueAt: "2026-06-23T11:00:00.000Z", state });
      expect(isOverdue(task, NOW)).toBe(true);
    }
  });

  it("defaults `now` to the current time when omitted", () => {
    const past = makeTask({ dueAt: "2000-01-01T00:00:00.000Z" });
    expect(isOverdue(past)).toBe(true);
    const future = makeTask({ dueAt: "2999-01-01T00:00:00.000Z" });
    expect(isOverdue(future)).toBe(false);
  });
});
