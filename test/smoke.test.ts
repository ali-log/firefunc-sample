import { describe, expect, it } from "vitest";
import { PRIORITIES, TASK_STATES } from "../src/shared/constants.js";
import { priorityWeight } from "../src/core/priority.js";
import { formatPriority, formatState } from "../src/core/format.js";

describe("smoke", () => {
  it("exposes the four task states", () => {
    expect(TASK_STATES).toEqual(["todo", "in_progress", "blocked", "done"]);
  });

  it("exposes the four priorities", () => {
    expect(PRIORITIES).toEqual(["low", "medium", "high", "urgent"]);
  });

  it("orders priority weights ascending", () => {
    expect(priorityWeight("urgent")).toBeGreaterThan(priorityWeight("low"));
  });

  it("formats labels", () => {
    expect(formatState("in_progress")).toBe("In Progress");
    expect(formatPriority("high")).toBe("High");
  });
});
