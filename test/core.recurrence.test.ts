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

/** Calendar-field tuple, so assertions are independent of the host timezone. */
function ymd(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

describe("recurrence: isRecurring", () => {
  it("is false for a null rule", () => {
    expect(isRecurring(null)).toBe(false);
  });

  it("is false for the none frequency", () => {
    expect(isRecurring(rule({ freq: "none" }))).toBe(false);
  });

  it("is true for daily/weekly/monthly with a valid interval", () => {
    expect(isRecurring(rule({ freq: "daily" }))).toBe(true);
    expect(isRecurring(rule({ freq: "weekly" }))).toBe(true);
    expect(isRecurring(rule({ freq: "monthly" }))).toBe(true);
  });

  it("is false when the interval is below 1 or non-finite", () => {
    expect(isRecurring(rule({ interval: 0 }))).toBe(false);
    expect(isRecurring(rule({ interval: -3 }))).toBe(false);
    expect(isRecurring(rule({ interval: Number.NaN }))).toBe(false);
    expect(isRecurring(rule({ interval: Number.POSITIVE_INFINITY }))).toBe(false);
  });
});

describe("recurrence: nextOccurrence", () => {
  it("returns null for a non-recurring rule", () => {
    expect(nextOccurrence(rule({ freq: "none" }), new Date(2026, 0, 1))).toBeNull();
    expect(nextOccurrence(rule({ interval: 0 }), new Date(2026, 0, 1))).toBeNull();
  });

  it("returns null for an invalid from date", () => {
    expect(nextOccurrence(rule(), new Date("not-a-date"))).toBeNull();
  });

  it("advances one day for a daily rule", () => {
    const next = nextOccurrence(rule({ freq: "daily" }), new Date(2026, 0, 1));
    expect(next && ymd(next)).toEqual([2026, 0, 2]);
  });

  it("advances by the custom daily interval", () => {
    const next = nextOccurrence(rule({ freq: "daily", interval: 3 }), new Date(2026, 0, 1));
    expect(next && ymd(next)).toEqual([2026, 0, 4]);
  });

  it("advances one week for a weekly rule", () => {
    const next = nextOccurrence(rule({ freq: "weekly" }), new Date(2026, 0, 1));
    expect(next && ymd(next)).toEqual([2026, 0, 8]);
  });

  it("advances by the custom weekly interval", () => {
    const next = nextOccurrence(rule({ freq: "weekly", interval: 2 }), new Date(2026, 0, 1));
    expect(next && ymd(next)).toEqual([2026, 0, 15]);
  });

  it("advances one calendar month for a monthly rule", () => {
    const next = nextOccurrence(rule({ freq: "monthly" }), new Date(2026, 0, 15));
    expect(next && ymd(next)).toEqual([2026, 1, 15]);
  });

  it("rolls a monthly rule across a year boundary", () => {
    const next = nextOccurrence(rule({ freq: "monthly", interval: 2 }), new Date(2026, 10, 10));
    expect(next && ymd(next)).toEqual([2027, 0, 10]);
  });

  it("clamps the day to the last valid day of a short month", () => {
    const next = nextOccurrence(rule({ freq: "monthly" }), new Date(2026, 0, 31));
    // Feb 2026 is not a leap year → Feb 28.
    expect(next && ymd(next)).toEqual([2026, 1, 28]);
  });

  it("clamps to Feb 29 in a leap year", () => {
    const next = nextOccurrence(rule({ freq: "monthly" }), new Date(2024, 0, 31));
    expect(next && ymd(next)).toEqual([2024, 1, 29]);
  });

  it("preserves the time-of-day for a monthly step", () => {
    const next = nextOccurrence(
      rule({ freq: "monthly" }),
      new Date(2026, 0, 15, 13, 45, 30, 250),
    );
    expect(next?.getHours()).toBe(13);
    expect(next?.getMinutes()).toBe(45);
    expect(next?.getSeconds()).toBe(30);
    expect(next?.getMilliseconds()).toBe(250);
  });

  it("returns the candidate when it falls on the inclusive until bound", () => {
    const next = nextOccurrence(
      rule({ freq: "daily", until: new Date(2026, 0, 2).toISOString() }),
      new Date(2026, 0, 1),
    );
    expect(next && ymd(next)).toEqual([2026, 0, 2]);
  });

  it("returns null when the next candidate is past the until bound", () => {
    const next = nextOccurrence(
      rule({ freq: "daily", until: new Date(2026, 0, 1, 12).toISOString() }),
      new Date(2026, 0, 1),
    );
    expect(next).toBeNull();
  });

  it("returns null when count is 1 (anchor is the only occurrence)", () => {
    expect(nextOccurrence(rule({ count: 1 }), new Date(2026, 0, 1))).toBeNull();
  });

  it("returns the candidate when count is 2 or more", () => {
    const next = nextOccurrence(rule({ count: 2 }), new Date(2026, 0, 1));
    expect(next && ymd(next)).toEqual([2026, 0, 2]);
  });
});

describe("recurrence: expandOccurrences", () => {
  it("returns an empty array for a non-recurring rule", () => {
    expect(expandOccurrences(rule({ freq: "none" }), new Date(2026, 0, 1))).toEqual([]);
    expect(expandOccurrences(rule({ interval: 0 }), new Date(2026, 0, 1))).toEqual([]);
  });

  it("returns an empty array for an invalid start date", () => {
    expect(expandOccurrences(rule(), new Date("nope"))).toEqual([]);
  });

  it("includes the anchor as the first occurrence", () => {
    const out = expandOccurrences(rule({ freq: "daily" }), new Date(2026, 0, 1), 3);
    expect(out.map(ymd)).toEqual([
      [2026, 0, 1],
      [2026, 0, 2],
      [2026, 0, 3],
    ]);
  });

  it("expands a weekly series", () => {
    const out = expandOccurrences(rule({ freq: "weekly" }), new Date(2026, 0, 1), 3);
    expect(out.map(ymd)).toEqual([
      [2026, 0, 1],
      [2026, 0, 8],
      [2026, 0, 15],
    ]);
  });

  it("expands a monthly series with day clamping along the way", () => {
    const out = expandOccurrences(rule({ freq: "monthly" }), new Date(2026, 0, 31), 3);
    // Anchor Jan 31; addStep is applied to the clamped cursor each step.
    expect(out.map(ymd)).toEqual([
      [2026, 0, 31],
      [2026, 1, 28],
      [2026, 2, 28],
    ]);
  });

  it("respects a custom interval", () => {
    const out = expandOccurrences(rule({ freq: "daily", interval: 5 }), new Date(2026, 0, 1), 3);
    expect(out.map(ymd)).toEqual([
      [2026, 0, 1],
      [2026, 0, 6],
      [2026, 0, 11],
    ]);
  });

  it("honours the count cap (inclusive of the anchor)", () => {
    const out = expandOccurrences(rule({ freq: "daily", count: 4 }), new Date(2026, 0, 1));
    expect(out).toHaveLength(4);
    expect(ymd(out[out.length - 1]!)).toEqual([2026, 0, 4]);
  });

  it("yields a single occurrence when count is 1", () => {
    const out = expandOccurrences(rule({ freq: "daily", count: 1 }), new Date(2026, 0, 1));
    expect(out.map(ymd)).toEqual([[2026, 0, 1]]);
  });

  it("still yields the anchor when count is 0 (anchor is pushed before the cap check)", () => {
    const out = expandOccurrences(rule({ freq: "daily", count: 0 }), new Date(2026, 0, 1));
    expect(out.map(ymd)).toEqual([[2026, 0, 1]]);
  });

  it("honours the inclusive until bound", () => {
    const out = expandOccurrences(
      rule({ freq: "daily", until: new Date(2026, 0, 3).toISOString() }),
      new Date(2026, 0, 1),
    );
    expect(out.map(ymd)).toEqual([
      [2026, 0, 1],
      [2026, 0, 2],
      [2026, 0, 3],
    ]);
  });

  it("stops at whichever of count and until comes first", () => {
    const out = expandOccurrences(
      rule({ freq: "daily", count: 10, until: new Date(2026, 0, 2).toISOString() }),
      new Date(2026, 0, 1),
    );
    expect(out.map(ymd)).toEqual([
      [2026, 0, 1],
      [2026, 0, 2],
    ]);
  });

  it("returns an empty array when the start is already past until", () => {
    const out = expandOccurrences(
      rule({ freq: "daily", until: new Date(2025, 11, 31).toISOString() }),
      new Date(2026, 0, 1),
    );
    expect(out).toEqual([]);
  });

  it("respects the max cap", () => {
    const out = expandOccurrences(rule({ freq: "daily" }), new Date(2026, 0, 1), 5);
    expect(out).toHaveLength(5);
  });

  it("treats a zero or negative max as no occurrences", () => {
    expect(expandOccurrences(rule({ freq: "daily" }), new Date(2026, 0, 1), 0)).toEqual([]);
    expect(expandOccurrences(rule({ freq: "daily" }), new Date(2026, 0, 1), -10)).toEqual([]);
  });

  it("clamps max to the internal hard ceiling", () => {
    const out = expandOccurrences(rule({ freq: "daily" }), new Date(2026, 0, 1), 50_000);
    expect(out).toHaveLength(10_000);
  });

  it("returns fresh Date instances (no aliasing of the cursor)", () => {
    const out = expandOccurrences(rule({ freq: "daily" }), new Date(2026, 0, 1), 3);
    expect(out[0]).not.toBe(out[1]);
    expect(out[0]!.getTime()).not.toBe(out[1]!.getTime());
  });
});
