import { describe, expect, it } from "vitest";
import {
  comparePriority,
  priorityWeight,
  rankScore,
  sortByRank,
  urgencyScore,
} from "../src/core/priority.js";
import { PRIORITY_WEIGHT } from "../src/shared/constants.js";
import type { Priority, Task } from "../src/shared/types.js";

// Frozen copy of rankScore as it stood BEFORE the urgencyScore extraction,
// with the due-date urgency logic inlined. Used to prove the refactor is a
// behaviour-preserving change (exact numeric parity, not just ordering).
function rankScoreLegacy(task: Task, now: Date): number {
  const MS_PER_HOUR = 3_600_000;
  const PRIORITY_FACTOR = 100;
  const OVERDUE_BONUS = 50;
  const DUE_SOON_WINDOW_HOURS = 72;
  const DUE_SOON_FACTOR = 30;
  const AGE_FACTOR = 0.5;
  const AGE_CAP = 20;

  if (task.state === "done") {
    return Number.NEGATIVE_INFINITY;
  }

  let score = (PRIORITY_WEIGHT[task.priority] ?? 0) * PRIORITY_FACTOR;

  if (task.dueAt) {
    const due = new Date(task.dueAt).getTime();
    if (!Number.isNaN(due)) {
      const hoursUntilDue = (due - now.getTime()) / MS_PER_HOUR;
      if (hoursUntilDue <= 0) {
        score += OVERDUE_BONUS + Math.min(OVERDUE_BONUS, -hoursUntilDue);
      } else if (hoursUntilDue < DUE_SOON_WINDOW_HOURS) {
        const closeness = 1 - hoursUntilDue / DUE_SOON_WINDOW_HOURS;
        score += closeness * DUE_SOON_FACTOR;
      }
    }
  }

  const created = new Date(task.createdAt).getTime();
  if (!Number.isNaN(created)) {
    const ageHours = Math.max(0, (now.getTime() - created) / MS_PER_HOUR);
    score += Math.min(AGE_CAP, ageHours * AGE_FACTOR);
  }

  return score;
}

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

describe("priority: urgencyScore extraction parity", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  // A spread of due-date situations: none, overdue (just/long), within window
  // at varying closeness, exactly at the window edge, far future, unparseable.
  const dueCases: Array<string | null> = [
    null,
    "garbage",
    "2026-05-31T00:00:00.000Z", // 24h overdue
    "2026-04-01T00:00:00.000Z", // long overdue (past the bonus cap)
    "2026-06-01T00:00:00.000Z", // due exactly now (boundary, <= 0)
    "2026-06-01T06:00:00.000Z", // 6h out
    "2026-06-02T00:00:00.000Z", // 24h out
    "2026-06-03T23:00:00.000Z", // 71h out (just inside window)
    "2026-06-04T00:00:00.000Z", // 72h out (exactly at window edge)
    "2026-12-31T00:00:00.000Z", // far future
  ];
  const priorities: Priority[] = ["low", "medium", "high", "urgent"];

  it("rankScore is numerically identical to the pre-extraction implementation", () => {
    for (const priority of priorities) {
      for (const dueAt of dueCases) {
        for (const state of ["todo", "in_progress", "done"] as Task["state"][]) {
          const task = makeTask({ priority, dueAt, state });
          expect(rankScore(task, now)).toBe(rankScoreLegacy(task, now));
        }
      }
    }
  });

  it("rankScore composes urgencyScore additively over priority and age", () => {
    for (const dueAt of dueCases) {
      const task = makeTask({ priority: "high", dueAt });
      const withoutUrgency = rankScore(makeTask({ priority: "high", dueAt: null }), now);
      expect(rankScore(task, now)).toBeCloseTo(
        withoutUrgency + urgencyScore(task, now),
        10,
      );
    }
  });

  it("urgencyScore returns 0 for no / unparseable / out-of-window due dates", () => {
    expect(urgencyScore(makeTask({ dueAt: null }), now)).toBe(0);
    expect(urgencyScore(makeTask({ dueAt: "garbage" }), now)).toBe(0);
    expect(urgencyScore(makeTask({ dueAt: "2026-06-04T00:00:00.000Z" }), now)).toBe(0);
    expect(urgencyScore(makeTask({ dueAt: "2026-12-31T00:00:00.000Z" }), now)).toBe(0);
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
