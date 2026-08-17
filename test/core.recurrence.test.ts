import { describe, expect, it } from "vitest";
import {
  expandOccurrences,
  isRecurring,
  nextOccurrence,
} from "../src/core/recurrence.js";
import type { RecurrenceRule } from "../src/shared/types.js";

function rule(over: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    freq: "daily",
    interval: 1,
    count: null,
    until: null,
    ...over,
  };
}

describe("recurrence: isRecurring", () => {
  it("is false for a null rule", () => {
    expect(isRecurring(null)).toBe(false);
  });

  it("is false when freq is 'none'", () => {
    expect(isRecurring(rule({ freq: "none" }))).toBe(false);
  });

  it("is true for each repeating cadence", () => {
    for (const freq of ["daily", "weekly", "monthly"] as const) {
      expect(isRecurring(rule({ freq }))).toBe(true);
    }
  });

  it("requires a finite interval of at least 1", () => {
    expect(isRecurring(rule({ interval: 0 }))).toBe(false);
    expect(isRecurring(rule({ interval: -1 }))).toBe(false);
    expect(isRecurring(rule({ interval: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(isRecurring(rule({ interval: Number.NaN }))).toBe(false);
    expect(isRecurring(rule({ interval: 1 }))).toBe(true);
    expect(isRecurring(rule({ interval: 3 }))).toBe(true);
  });
});

describe("recurrence: nextOccurrence", () => {
  const from = new Date("2026-01-01T09:30:00.000Z");

  it("returns null for a non-recurring rule", () => {
    expect(nextOccurrence(rule({ freq: "none" }), from)).toBeNull();
  });

  it("returns null for an invalid `from` date", () => {
    expect(nextOccurrence(rule(), new Date("not-a-date"))).toBeNull();
  });

  it("advances one daily step", () => {
    const next = nextOccurrence(rule({ freq: "daily", interval: 1 }), from);
    expect(next?.toISOString()).toBe("2026-01-02T09:30:00.000Z");
  });

  it("advances a multi-day interval", () => {
    const next = nextOccurrence(rule({ freq: "daily", interval: 3 }), from);
    expect(next?.toISOString()).toBe("2026-01-04T09:30:00.000Z");
  });

  it("advances one weekly step", () => {
    const next = nextOccurrence(rule({ freq: "weekly", interval: 1 }), from);
    expect(next?.toISOString()).toBe("2026-01-08T09:30:00.000Z");
  });

  it("advances one monthly step preserving time-of-day", () => {
    const next = nextOccurrence(rule({ freq: "monthly", interval: 1 }), from);
    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(1); // February
    expect(next?.getDate()).toBe(1);
  });

  it("clamps a monthly step onto a shorter month", () => {
    // Jan 31 + 1 month → Feb 28 (2026 is not a leap year). Uses local time.
    const jan31 = new Date(2026, 0, 31, 12, 0, 0);
    const next = nextOccurrence(rule({ freq: "monthly", interval: 1 }), jan31);
    expect(next?.getMonth()).toBe(1); // February
    expect(next?.getDate()).toBe(28);
    expect(next?.getHours()).toBe(12);
  });

  it("returns null when the next candidate is past `until`", () => {
    const r = rule({ freq: "daily", interval: 1, until: "2026-01-01T00:00:00.000Z" });
    expect(nextOccurrence(r, from)).toBeNull();
  });

  it("honours `until` as an inclusive bound", () => {
    // Candidate is exactly 2026-01-02T09:30 — equal to `until`, so allowed.
    const r = rule({ freq: "daily", interval: 1, until: "2026-01-02T09:30:00.000Z" });
    expect(nextOccurrence(r, from)?.toISOString()).toBe("2026-01-02T09:30:00.000Z");
  });

  it("returns null when count <= 1 (anchor is the only occurrence)", () => {
    expect(nextOccurrence(rule({ count: 1 }), from)).toBeNull();
    expect(nextOccurrence(rule({ count: 0 }), from)).toBeNull();
  });

  it("returns a next occurrence when count > 1", () => {
    expect(nextOccurrence(rule({ count: 2 }), from)).not.toBeNull();
  });
});

describe("recurrence: expandOccurrences", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");

  it("returns [] for a non-recurring rule", () => {
    expect(expandOccurrences(rule({ freq: "none" }), start)).toEqual([]);
  });

  it("returns [] for an invalid start date", () => {
    expect(expandOccurrences(rule(), new Date("not-a-date"))).toEqual([]);
  });

  it("returns [] when max is 0", () => {
    expect(expandOccurrences(rule(), start, 0)).toEqual([]);
  });

  it("begins with the anchor and steps by the interval", () => {
    const out = expandOccurrences(rule({ freq: "daily", interval: 1 }), start, 3);
    expect(out.map((d) => d.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    ]);
  });

  it("is bounded by `max`", () => {
    const out = expandOccurrences(rule({ freq: "daily", interval: 1 }), start, 5);
    expect(out).toHaveLength(5);
  });

  it("is bounded by `count`, inclusive of the anchor", () => {
    const out = expandOccurrences(rule({ freq: "daily", count: 3 }), start, 100);
    expect(out).toHaveLength(3);
    expect(out[0].toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(out[2].toISOString()).toBe("2026-01-03T00:00:00.000Z");
  });

  it("treats `until` as an inclusive upper bound", () => {
    const r = rule({ freq: "daily", interval: 1, until: "2026-01-03T00:00:00.000Z" });
    const out = expandOccurrences(r, start, 100);
    // Jan 1, 2, 3 — the boundary date is included.
    expect(out.map((d) => d.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    ]);
  });

  it("stops before an occurrence strictly past `until`", () => {
    const r = rule({ freq: "daily", interval: 1, until: "2026-01-02T12:00:00.000Z" });
    const out = expandOccurrences(r, start, 100);
    // Jan 3 (00:00) would be > until, so only Jan 1 and Jan 2.
    expect(out.map((d) => d.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-02T00:00:00.000Z",
    ]);
  });

  it("expands weekly cadence", () => {
    const out = expandOccurrences(rule({ freq: "weekly", interval: 1 }), start, 3);
    expect(out.map((d) => d.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-08T00:00:00.000Z",
      "2026-01-15T00:00:00.000Z",
    ]);
  });

  it("expands monthly cadence with end-of-month clamping", () => {
    const jan31 = new Date(2026, 0, 31, 0, 0, 0);
    const out = expandOccurrences(rule({ freq: "monthly", interval: 1 }), jan31, 3);
    expect(out).toHaveLength(3);
    expect(out[0].getDate()).toBe(31); // Jan 31
    expect(out[1].getMonth()).toBe(1); // February
    expect(out[1].getDate()).toBe(28); // clamped to Feb 28 (non-leap)
    expect(out[2].getMonth()).toBe(2); // March
    expect(out[2].getDate()).toBe(28); // stepping from the clamped Feb 28
  });

  it("clamps `max` to the hard internal ceiling", () => {
    // A huge max plus a large count must not exceed HARD_CAP (10_000).
    const out = expandOccurrences(rule({ freq: "daily", count: 50_000 }), start, 1_000_000);
    expect(out).toHaveLength(10_000);
  });
});
