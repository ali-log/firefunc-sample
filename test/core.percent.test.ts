import { describe, expect, it } from "vitest";
import { percentages } from "../src/core/percent.js";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("percentages: largest-remainder (Hamilton) rounding", () => {
  it("always sums to 100 for the case that broke independent Math.round", () => {
    // Independent Math.round([1,1,1,3]/6 * 100) -> 17+17+17+50 = 101.
    expect(sum(percentages([1, 1, 1, 3]))).toBe(100);
  });

  it("sums to 100 for thirds that would otherwise undershoot to 99", () => {
    // Independent rounding -> 33+33+33 = 99.
    expect(sum(percentages([1, 1, 1]))).toBe(100);
  });

  it("hands leftover points to the largest fractional remainders", () => {
    expect(percentages([1, 1, 1, 3])).toEqual([17, 17, 16, 50]);
  });

  it("returns exact values when shares are already whole", () => {
    expect(percentages([1, 1, 2])).toEqual([25, 25, 50]);
    expect(sum(percentages([1, 1, 2]))).toBe(100);
  });

  it("keeps a single non-zero bucket at 100", () => {
    expect(percentages([0, 5, 0, 0])).toEqual([0, 100, 0, 0]);
  });

  it("returns all zeros when the total is zero (no NaN/Infinity)", () => {
    expect(percentages([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    expect(percentages([])).toEqual([]);
  });

  it("treats negative or non-finite counts as zero", () => {
    expect(percentages([-3, 1, 1])).toEqual([0, 50, 50]);
    expect(sum(percentages([Number.NaN, 2, 2]))).toBe(100);
  });

  it("sums to 100 across a sweep of random-ish distributions", () => {
    const cases = [
      [2, 3, 5, 7],
      [1, 2, 3, 4],
      [10, 10, 10, 1],
      [7, 7, 7, 7],
      [1, 0, 0, 99],
      [5, 5, 5, 6],
    ];
    for (const c of cases) {
      expect(sum(percentages(c))).toBe(100);
    }
  });
});
