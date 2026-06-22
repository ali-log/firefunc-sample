import { describe, expect, it } from "vitest";
import {
  comparePriority,
  priorityWeight,
  rankScore,
  sortByRank,
} from "../src/core/priority.js";
import { PRIORITY_WEIGHT } from "../src/shared/constants.js";
import type { Priority, Task } from "../src/shared/types.js";

function makeTask(over: Partial<Task> = {}): Task {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return {
    id: "t",
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

describe("priority: weight & compare", () => {
  it("matches the constant table", () => {
    for (const p of ["low", "medium", "high", "urgent"] as Priority[]) {
      expect(priorityWeight(p)).toBe(PRIORITY_WEIGHT[p]);
    }
  });
  it("compare is positive when a outranks b", () => {
    expect(comparePriority("urgent", "low")).toBeGreaterThan(0);
    expect(comparePriority("low", "urgent")).toBeLessThan(0);
    expect(comparePriority("high", "high")).toBe(0);
  });
});

describe("priority: rankScore", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("higher priority outranks lower, all else equal", () => {
    const created = "2026-06-01T00:00:00.000Z";
    const urgent = makeTask({ priority: "urgent", createdAt: created });
    const low = makeTask({ priority: "low", createdAt: created });
    expect(rankScore(urgent, now)).toBeGreaterThan(rankScore(low, now));
  });

  it("done tasks sink to -Infinity", () => {
    expect(rankScore(makeTask({ state: "done", priority: "urgent" }), now)).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });

  it("an overdue task outranks the same task not overdue", () => {
    const base: Partial<Task> = {
      priority: "medium",
      createdAt: "2026-05-30T00:00:00.000Z",
    };
    const overdue = makeTask({ ...base, dueAt: "2026-05-31T00:00:00.000Z" });
    const future = makeTask({ ...base, dueAt: "2026-12-31T00:00:00.000Z" });
    expect(rankScore(overdue, now)).toBeGreaterThan(rankScore(future, now));
  });

  it("a sooner deadline outranks a later one within the urgency window", () => {
    const base: Partial<Task> = {
      priority: "medium",
      createdAt: "2026-06-01T00:00:00.000Z",
    };
    const dueIn6h = makeTask({ ...base, dueAt: "2026-06-01T06:00:00.000Z" });
    const dueIn48h = makeTask({ ...base, dueAt: "2026-06-03T00:00:00.000Z" });
    expect(rankScore(dueIn6h, now)).toBeGreaterThan(rankScore(dueIn48h, now));
  });

  it("ignores an unparseable dueAt without throwing", () => {
    const t = makeTask({ dueAt: "garbage", createdAt: "2026-06-01T00:00:00.000Z" });
    expect(Number.isFinite(rankScore(t, now))).toBe(true);
  });

  it("older tasks rank slightly higher (age tie-break)", () => {
    const old = makeTask({ createdAt: "2026-05-01T00:00:00.000Z" });
    const fresh = makeTask({ createdAt: "2026-06-01T00:00:00.000Z" });
    expect(rankScore(old, now)).toBeGreaterThan(rankScore(fresh, now));
  });
});

describe("priority: sortByRank", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("orders most urgent first and does not mutate input", () => {
    const input = [
      makeTask({ id: "low", priority: "low" }),
      makeTask({ id: "urgent", priority: "urgent" }),
      makeTask({ id: "high", priority: "high" }),
    ];
    const snapshot = input.map((t) => t.id);
    const sorted = sortByRank(input, now);
    expect(sorted.map((t) => t.id)).toEqual(["urgent", "high", "low"]);
    expect(input.map((t) => t.id)).toEqual(snapshot); // unmutated
  });

  it("is stable for equal-score tasks", () => {
    const created = "2026-06-01T00:00:00.000Z";
    const a = makeTask({ id: "a", priority: "medium", createdAt: created });
    const b = makeTask({ id: "b", priority: "medium", createdAt: created });
    const c = makeTask({ id: "c", priority: "medium", createdAt: created });
    expect(sortByRank([a, b, c], now).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("pushes done tasks to the end", () => {
    const sorted = sortByRank(
      [
        makeTask({ id: "done", state: "done", priority: "urgent" }),
        makeTask({ id: "live", state: "todo", priority: "low" }),
      ],
      now,
    );
    expect(sorted[sorted.length - 1]!.id).toBe("done");
  });
});
