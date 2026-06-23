import { describe, expect, it } from "vitest";
import { largestRemainderPercentages } from "../src/core/percentages.js";

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

describe("largestRemainderPercentages", () => {
  it("rounds shares that would otherwise sum to 101 down to exactly 100", () => {
    // 1/3 each → 33.33% rounded independently is 33+33+33 = 99,
    // and naive Math.round of three thirds can drift; Hamilton fixes it.
    const result = largestRemainderPercentages([1, 1, 1]);
    expect(sum(result)).toBe(100);
  });

  it("matches the documented 101 case (independent rounding overshoots)", () => {
    // Counts where independent Math.round overshoots 100.
    // 5/12, 5/12, 2/12 → 41.67, 41.67, 16.67 → naive round = 42+42+17 = 101.
    const counts = [5, 5, 2];
    const naive = counts.map((c) => Math.round((c / sum(counts)) * 100));
    expect(sum(naive)).toBe(101); // demonstrates the bug

    const fixed = largestRemainderPercentages(counts);
    expect(sum(fixed)).toBe(100);
  });

  it("returns all zeros when there are no tasks (no NaN/Infinity)", () => {
    const result = largestRemainderPercentages([0, 0, 0, 0]);
    expect(result).toEqual([0, 0, 0, 0]);
    expect(result.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("gives leftover points to the largest fractional remainders", () => {
    // total 6: shares 16.67, 16.67, 66.67 → floors 16,16,66 = 98,
    // 2 points go to the two largest remainders.
    const result = largestRemainderPercentages([1, 1, 4]);
    expect(sum(result)).toBe(100);
    expect(result).toEqual([17, 17, 66]);
  });

  it("keeps exact shares unchanged", () => {
    expect(largestRemainderPercentages([1, 1, 2])).toEqual([25, 25, 50]);
    expect(sum(largestRemainderPercentages([1, 1, 2]))).toBe(100);
  });

  it("always sums to 100 across many random distributions", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const counts = [seed % 7, (seed * 3) % 5, (seed * 7) % 11, seed % 2];
      if (sum(counts) === 0) continue;
      expect(sum(largestRemainderPercentages(counts))).toBe(100);
    }
  });
});
