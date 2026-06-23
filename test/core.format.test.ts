import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatMoney,
  formatPriority,
  formatRelative,
  formatState,
  formatTaskRef,
  formatTaskSummary,
} from "../src/core/format.js";

describe("format: state & priority labels", () => {
  it("state labels", () => {
    expect(formatState("todo")).toBe("To Do");
    expect(formatState("in_progress")).toBe("In Progress");
    expect(formatState("blocked")).toBe("Blocked");
    expect(formatState("done")).toBe("Done");
  });
  it("priority labels are capitalized", () => {
    expect(formatPriority("low")).toBe("Low");
    expect(formatPriority("urgent")).toBe("Urgent");
  });
});

describe("format: formatDuration", () => {
  it("zero", () => expect(formatDuration(0)).toBe("0m"));
  it("minutes only", () => expect(formatDuration(45)).toBe("45m"));
  it("hours + minutes", () => expect(formatDuration(90)).toBe("1h 30m"));
  it("exact hour drops minutes", () => expect(formatDuration(120)).toBe("2h"));
  it("days + hours, capped at two units", () =>
    expect(formatDuration(60 * 24 + 60 + 30)).toBe("1d 1h"));
  it("rounds sub-minute input", () => {
    expect(formatDuration(0.4)).toBe("0m");
    expect(formatDuration(0.6)).toBe("1m");
  });
  it("negative keeps a sign", () => expect(formatDuration(-30)).toBe("-30m"));
  it("non-finite is safe", () => {
    expect(formatDuration(Number.NaN)).toBe("0m");
    expect(formatDuration(Infinity)).toBe("0m");
  });
});

describe("format: formatMoney", () => {
  it("default USD with thousands separators", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(1000000)).toBe("$1,000,000.00");
  });
  it("negatives place the sign before the symbol", () => {
    expect(formatMoney(-42.1)).toBe("-$42.10");
  });
  it("custom currency and fraction digits", () => {
    expect(formatMoney(99.9, "€")).toBe("€99.90");
    expect(formatMoney(100, "£", 0)).toBe("£100");
  });
  it("non-finite is safe", () => {
    expect(formatMoney(Number.NaN)).toBe("$0.00");
  });
});

describe("format: formatRelative", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("just now within ~45s", () => {
    expect(formatRelative(new Date(now.getTime() + 10_000), now)).toBe("just now");
  });
  it("future minutes/hours/days", () => {
    expect(formatRelative(new Date(now.getTime() + 5 * 60_000), now)).toBe(
      "in 5 minutes",
    );
    expect(formatRelative(new Date(now.getTime() + 2 * 3_600_000), now)).toBe(
      "in 2 hours",
    );
    expect(formatRelative(new Date(now.getTime() + 3 * 86_400_000), now)).toBe(
      "in 3 days",
    );
  });
  it("past phrasing uses ago", () => {
    expect(formatRelative(new Date(now.getTime() - 2 * 3_600_000), now)).toBe(
      "2 hours ago",
    );
  });
  it("singular vs plural", () => {
    expect(formatRelative(new Date(now.getTime() + 1 * 86_400_000), now)).toBe(
      "in 1 day",
    );
  });
  it("invalid date falls back to a string", () => {
    expect(formatRelative(new Date("nope"), now)).toBe("invalid date");
  });
});

describe("format: formatTaskRef", () => {
  it("joins key and number", () => {
    expect(formatTaskRef("FIRE", 123)).toBe("FIRE-123");
  });
});

describe("format: formatTaskSummary", () => {
  it("uppercases priority, keeps title and raw state", () => {
    expect(
      formatTaskSummary({
        priority: "high",
        title: "Fix the parser",
        state: "in_progress",
      }),
    ).toBe("[HIGH] Fix the parser (in_progress)");
  });
  it("handles other priorities and states", () => {
    expect(
      formatTaskSummary({ priority: "urgent", title: "Ship it", state: "todo" }),
    ).toBe("[URGENT] Ship it (todo)");
  });
});
