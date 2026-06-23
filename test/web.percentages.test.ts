import { describe, it, expect } from "vitest";
import { largestRemainderPercentages } from "../src/web/percentages.js";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("largestRemainderPercentages", () => {
  it("sums to exactly 100 for a distribution that naive rounding inflates past 100", () => {
    // Naive Math.round: 17 + 17 + 17 + 50 = 101 (the reported board glitch).
    const pct = largestRemainderPercentages([1, 1, 1, 3]);
    expect(sum(pct)).toBe(100);
    expect(pct).toEqual([17, 17, 16, 50]);
  });

  it("sums to exactly 100 for a distribution that naive rounding deflates below 100", () => {
    // Naive Math.round: 33 + 33 + 33 + 0 = 99.
    const pct = largestRemainderPercentages([1, 1, 1, 0]);
    expect(sum(pct)).toBe(100);
  });

  it("returns all zeros when there are no tasks (no NaN/Infinity)", () => {
    const pct = largestRemainderPercentages([0, 0, 0, 0]);
    expect(pct).toEqual([0, 0, 0, 0]);
    expect(pct.every((n) => Number.isFinite(n))).toBe(true);
  });

  it("always sums to 100 across many random distributions", () => {
    let seed = 12345;
    const rand = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 50;
    for (let trial = 0; trial < 200; trial++) {
      const counts = [rand(), rand(), rand(), rand()];
      if (sum(counts) === 0) continue;
      expect(sum(largestRemainderPercentages(counts))).toBe(100);
    }
  });

  it("gives a clean 25 each for an even split", () => {
    expect(largestRemainderPercentages([2, 2, 2, 2])).toEqual([25, 25, 25, 25]);
  });
});
