// Pin a DST-observing timezone so whole-day SLA math is exercised across a
// spring-forward boundary. All assertions below use epoch ms / UTC ISO, so the
// pinned zone does not affect any other case.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import {
  effectiveSlaMinutes,
  evaluateSla,
  isAtRisk,
  slaDeadline,
} from "../src/core/sla.js";
import { DEFAULT_SLA_MINUTES, SLA_AT_RISK_RATIO } from "../src/shared/constants.js";
import type { Priority, Task, TaskState } from "../src/shared/types.js";

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

describe("sla: effectiveSlaMinutes", () => {
  it("uses an explicit positive value", () => {
    expect(effectiveSlaMinutes(120, "low")).toBe(120);
  });
  it("falls back to the per-priority default when null", () => {
    for (const p of ["low", "medium", "high", "urgent"] as Priority[]) {
      expect(effectiveSlaMinutes(null, p)).toBe(DEFAULT_SLA_MINUTES[p]);
    }
  });
  it("ignores zero / negative / non-finite explicit values", () => {
    expect(effectiveSlaMinutes(0, "high")).toBe(DEFAULT_SLA_MINUTES.high);
    expect(effectiveSlaMinutes(-5, "high")).toBe(DEFAULT_SLA_MINUTES.high);
    expect(effectiveSlaMinutes(Number.NaN, "high")).toBe(DEFAULT_SLA_MINUTES.high);
  });
});

describe("sla: slaDeadline", () => {
  it("adds the window in minutes", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    expect(slaDeadline(created, 90).toISOString()).toBe("2026-01-01T01:30:00.000Z");
  });

  const ONE_DAY_MIN = 60 * 24;

  it("is exactly N*24h later across a US spring-forward DST boundary", () => {
    // 2026-03-08 02:00 local is when US clocks jump to 03:00 (EST -> EDT).
    // createdAt sits just before that boundary; a one-day SLA must land exactly
    // 24h later in real (epoch) time, not keep the same wall-clock hour.
    const created = new Date("2026-03-08T05:00:00.000Z"); // 00:00 EST
    const deadline = slaDeadline(created, ONE_DAY_MIN);
    expect(deadline.getTime() - created.getTime()).toBe(ONE_DAY_MIN * 60_000);
    expect(deadline.toISOString()).toBe("2026-03-09T05:00:00.000Z");
  });

  it("is exactly N*24h later for a non-DST control window", () => {
    // Mid-summer: no DST transition is crossed by a one-day window.
    const created = new Date("2026-07-15T12:00:00.000Z");
    const deadline = slaDeadline(created, ONE_DAY_MIN);
    expect(deadline.getTime() - created.getTime()).toBe(ONE_DAY_MIN * 60_000);
    expect(deadline.toISOString()).toBe("2026-07-16T12:00:00.000Z");
  });
});

describe("sla: evaluateSla", () => {
  const created = new Date("2026-01-01T00:00:00.000Z");

  it("returns 'none' for done tasks", () => {
    const e = evaluateSla(makeTask({ state: "done" }));
    expect(e).toEqual({
      status: "none",
      deadline: null,
      minutesRemaining: null,
      consumedRatio: null,
    });
  });

  it("on_track early in the window", () => {
    const task = makeTask({ slaMinutes: 100 });
    const now = new Date(created.getTime() + 10 * 60_000); // 10% consumed
    const e = evaluateSla(task, now);
    expect(e.status).toBe("on_track");
    expect(e.consumedRatio).toBeCloseTo(0.1, 6);
    expect(e.minutesRemaining).toBeCloseTo(90, 6);
    expect(e.deadline?.toISOString()).toBe("2026-01-01T01:40:00.000Z");
  });

  it("at_risk once the threshold ratio is crossed", () => {
    const task = makeTask({ slaMinutes: 100 });
    const now = new Date(created.getTime() + SLA_AT_RISK_RATIO * 100 * 60_000);
    const e = evaluateSla(task, now);
    expect(e.status).toBe("at_risk");
    expect(e.consumedRatio).toBeCloseTo(SLA_AT_RISK_RATIO, 6);
  });

  it("breached at and beyond the deadline, with negative minutesRemaining", () => {
    const task = makeTask({ slaMinutes: 100 });
    const atDeadline = new Date(created.getTime() + 100 * 60_000);
    expect(evaluateSla(task, atDeadline).status).toBe("breached");

    const past = new Date(created.getTime() + 130 * 60_000);
    const e = evaluateSla(task, past);
    expect(e.status).toBe("breached");
    expect(e.minutesRemaining).toBeCloseTo(-30, 6);
    expect(e.consumedRatio).toBeCloseTo(1.3, 6);
  });

  it("clamps consumedRatio at 0 when now precedes createdAt", () => {
    const task = makeTask({ slaMinutes: 100 });
    const before = new Date(created.getTime() - 60 * 60_000);
    const e = evaluateSla(task, before);
    expect(e.consumedRatio).toBe(0);
    expect(e.status).toBe("on_track");
  });

  it("uses the priority default when slaMinutes is null", () => {
    const task = makeTask({ slaMinutes: null, priority: "urgent" });
    const now = new Date(created.getTime() + 1);
    const e = evaluateSla(task, now);
    expect(e.deadline?.getTime()).toBe(
      created.getTime() + DEFAULT_SLA_MINUTES.urgent * 60_000,
    );
  });

  it("returns 'none' for an unparseable createdAt", () => {
    const task = makeTask({ createdAt: "not-a-date", slaMinutes: 100 });
    expect(evaluateSla(task).status).toBe("none");
  });
});

describe("sla: isAtRisk", () => {
  it("true only in [threshold, 1)", () => {
    expect(isAtRisk(SLA_AT_RISK_RATIO - 0.01)).toBe(false);
    expect(isAtRisk(SLA_AT_RISK_RATIO)).toBe(true);
    expect(isAtRisk(0.99)).toBe(true);
    expect(isAtRisk(1)).toBe(false);
    expect(isAtRisk(1.5)).toBe(false);
  });
});
