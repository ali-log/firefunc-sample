import { describe, expect, it } from "vitest";
import { columnPercentages } from "../src/web/Board.js";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("Board: columnPercentages (largest-remainder rounding)", () => {
  it("sums to exactly 100 for the reported screenshot case (3,2,1,2 of 8)", () => {
    // Naive per-column Math.round gives 38+25+13+25 = 101 (the bug).
    const pct = columnPercentages([3, 2, 1, 2], 8);
    expect(sum(pct)).toBe(100);
    // The half that rounds up by remainder is To Do (.5) and Blocked (.5);
    // To Do has the larger count so wins the single leftover point.
    expect(pct).toEqual([38, 25, 12, 25]);
  });

  it("always sums to 100 across many count distributions", () => {
    const cases: number[][] = [
      [1, 1, 1],
      [1, 0, 0, 0],
      [2, 2, 2, 1],
      [5, 3, 1, 1],
      [7, 11, 13, 17],
      [1, 2, 3, 4, 5, 6],
      [10, 0, 0, 0, 0, 0, 0],
    ];
    for (const counts of cases) {
      const total = sum(counts);
      expect(sum(columnPercentages(counts, total))).toBe(100);
    }
  });

  it("returns all zeros (no NaN/Infinity) when there are no tasks", () => {
    expect(columnPercentages([0, 0, 0, 0], 0)).toEqual([0, 0, 0, 0]);
  });

  it("gives 100 to the only non-empty column", () => {
    expect(columnPercentages([0, 4, 0], 4)).toEqual([0, 100, 0]);
  });

  it("never produces a negative percentage", () => {
    const pct = columnPercentages([1, 1, 1, 1, 1, 1, 1], 7);
    expect(pct.every((p) => p >= 0)).toBe(true);
    expect(sum(pct)).toBe(100);
  });
});
