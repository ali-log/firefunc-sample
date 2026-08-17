import { describe, expect, it } from "vitest";
import { columnPercent } from "../src/web/Board.js";

describe("columnPercent", () => {
  it("returns 0 for an empty board instead of NaN", () => {
    // Regression: a project with zero tasks used to compute 0/0 → NaN%.
    const pct = columnPercent(0, 0);
    expect(pct).toBe(0);
    expect(Number.isNaN(pct)).toBe(false);
  });

  it("never returns Infinity when a column has tasks but the total is 0", () => {
    const pct = columnPercent(3, 0);
    expect(pct).toBe(0);
    expect(Number.isFinite(pct)).toBe(true);
  });

  it("computes a rounded percentage for a non-empty board", () => {
    expect(columnPercent(1, 4)).toBe(25);
    expect(columnPercent(1, 3)).toBe(33);
    expect(columnPercent(2, 3)).toBe(67);
    expect(columnPercent(4, 4)).toBe(100);
  });
});
