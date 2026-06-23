import { describe, it, expect } from "vitest";
import { columnPercentages } from "../src/web/Board.js";

describe("columnPercentages (largest-remainder rounding)", () => {
  it("always sums to exactly 100 for non-empty boards", () => {
    const cases = [
      [3, 2, 1, 2], // 8 tasks → independent Math.round gave 38+25+13+25 = 101
      [1, 1, 1],
      [1, 0, 0, 0],
      [7, 11, 5, 9],
      [100, 33, 67, 1],
    ];
    for (const counts of cases) {
      const pcts = columnPercentages(counts);
      expect(pcts.reduce((s, v) => s + v, 0)).toBe(100);
    }
  });

  it("reproduces the ticket scenario summing to 100 (not 101)", () => {
    // To Do 3, In Progress 2, Blocked 1, Done 2 out of 8 tasks.
    // Independent Math.round: 38 + 25 + 13 + 25 = 101.
    const pcts = columnPercentages([3, 2, 1, 2]);
    expect(pcts.reduce((s, v) => s + v, 0)).toBe(100);
  });

  it("returns all zeros when there are no tasks (no NaN)", () => {
    expect(columnPercentages([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it("gives leftover points to the largest fractional remainders", () => {
    // 1/3 each → 33.33; floors sum to 99, one extra point distributed.
    const pcts = columnPercentages([1, 1, 1]);
    expect(pcts.reduce((s, v) => s + v, 0)).toBe(100);
    expect(pcts.filter((v) => v === 34)).toHaveLength(1);
    expect(pcts.filter((v) => v === 33)).toHaveLength(2);
  });
});
