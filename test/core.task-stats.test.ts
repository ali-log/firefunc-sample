import { describe, expect, it } from "vitest";
import { countTasksByState } from "../src/core/task-stats.js";
import type { Task, TaskState } from "../src/shared/types.js";

function makeTask(state: TaskState, id = "t"): Task {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return {
    id,
    projectId: "p1",
    parentId: null,
    title: "Task",
    description: null,
    state,
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
  };
}

describe("task-stats: countTasksByState", () => {
  it("returns all-zero counts for an empty list", () => {
    expect(countTasksByState([])).toEqual({
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    });
  });

  it("counts a mixed list grouped by state", () => {
    const tasks = [
      makeTask("todo", "a"),
      makeTask("todo", "b"),
      makeTask("in_progress", "c"),
      makeTask("blocked", "d"),
      makeTask("done", "e"),
      makeTask("done", "f"),
      makeTask("done", "g"),
    ];
    expect(countTasksByState(tasks)).toEqual({
      todo: 2,
      in_progress: 1,
      blocked: 1,
      done: 3,
    });
  });
});
