import { describe, expect, it } from "vitest";
import { columnPercentages } from "../src/core/percent.js";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("columnPercentages: largest-remainder rounding", () => {
  it("sums to exactly 100 for the classic 101 case", () => {
    // Independent Math.round gives 17+17+17+50 = 101.
    expect(sum(columnPercentages([1, 1, 1, 3]))).toBe(100);
  });

  it("never overshoots or undershoots 100 across many distributions", () => {
    const cases = [
      [1, 1, 1],
      [1, 1, 1, 3],
      [2, 2, 2, 1],
      [1, 0, 0, 5],
      [3, 3, 3, 3],
      [7, 11, 13, 1],
      [1, 2, 3, 4],
    ];
    for (const counts of cases) {
      expect(sum(columnPercentages(counts))).toBe(100);
    }
  });

  it("returns all zeros when there are no tasks (no NaN/Infinity)", () => {
    expect(columnPercentages([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it("gives a single non-empty column the full 100", () => {
    expect(columnPercentages([0, 4, 0, 0])).toEqual([0, 100, 0, 0]);
  });

  it("hands leftover points to the largest fractional remainders", () => {
    // counts [1,1,1,3] over total 6: floors 16,16,16,50 (=98), two points
    // go to the three 0.66 remainders → 17,17,16,50 (order-stable).
    expect(columnPercentages([1, 1, 1, 3])).toEqual([17, 17, 16, 50]);
  });

  it("preserves alignment with the input order", () => {
    const result = columnPercentages([5, 0, 5, 0]);
    expect(result).toEqual([50, 0, 50, 0]);
  });
});
