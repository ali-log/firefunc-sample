import { describe, expect, it } from "vitest";
import { percentages } from "../src/core/percentages.js";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("percentages: largest-remainder rounding", () => {
  it("three equal counts sum to 100, not 99", () => {
    // Independent Math.round would give 33/33/33 = 99.
    const result = percentages([1, 1, 1]);
    expect(sum(result)).toBe(100);
    expect(result).toEqual([34, 33, 33]);
  });

  it("a distribution that naively rounds to 101 still sums to 100", () => {
    // Board columns: To Do / In Progress / Blocked / Done.
    // Exact: 16.66/16.66/16.66/50 -> Math.round each = 17/17/17/50 = 101.
    const result = percentages([1, 1, 1, 3]);
    expect(sum(result)).toBe(100);
  });

  it("always sums to exactly 100 across many shapes", () => {
    const shapes = [
      [1, 1, 1, 1],
      [2, 3, 5, 7],
      [10, 0, 0, 0],
      [1, 2, 3, 4],
      [7, 7, 7, 7],
      [1, 1, 1, 1, 1, 1, 1],
    ];
    for (const counts of shapes) {
      expect(sum(percentages(counts))).toBe(100);
    }
  });

  it("exact percentages are preserved", () => {
    expect(percentages([1, 1, 1, 1])).toEqual([25, 25, 25, 25]);
    expect(percentages([1, 3])).toEqual([25, 75]);
  });

  it("returns all zeros when there are no items", () => {
    expect(percentages([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    expect(percentages([])).toEqual([]);
  });

  it("extra points go to the largest fractional remainders", () => {
    // Exact: 0/14.28.../28.57.../57.14... -> floors 0/14/28/57 = 99, one point
    // left, which goes to the largest remainder (the 0.57 share at index 2).
    expect(percentages([0, 1, 2, 4])).toEqual([0, 14, 29, 57]);
  });
});
