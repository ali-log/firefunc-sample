import { describe, expect, it } from "vitest";
import { columnPercentage } from "../src/web/Board.js";

describe("Board: column percentage badge", () => {
  it("shows 0% when the project has zero tasks (no NaN/Infinity)", () => {
    // 0 tasks in the column AND 0 tasks total → 0/0 used to be NaN.
    expect(columnPercentage(0, 0)).toBe(0);
    // Defensive: any column count against a zero total stays 0, never Infinity.
    expect(columnPercentage(3, 0)).toBe(0);
    expect(Number.isFinite(columnPercentage(0, 0))).toBe(true);
    expect(Number.isNaN(columnPercentage(0, 0))).toBe(false);
  });

  it("computes a rounded percentage when tasks exist", () => {
    expect(columnPercentage(2, 4)).toBe(50);
    expect(columnPercentage(1, 3)).toBe(33);
    expect(columnPercentage(0, 5)).toBe(0);
    expect(columnPercentage(5, 5)).toBe(100);
  });
});
