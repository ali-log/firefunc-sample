/**
 * Round a list of counts into integer percentages that always sum to 100
 * (when the total is non-zero), using the largest-remainder / Hamilton method.
 *
 * Rounding each share independently with `Math.round` can drift above or below
 * 100 (e.g. counts [1, 1, 1, 3] → 17 + 17 + 17 + 50 = 101). Largest-remainder
 * rounding floors every share, then hands the leftover points to the shares
 * with the biggest fractional remainders, so the result is exact.
 *
 * @param counts per-bucket counts (e.g. tasks per board column)
 * @returns integer percentages aligned to `counts`; all zeros when total is 0
 */
export function columnPercentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map((x) => Math.floor(x));
  const result = floors.slice();

  const remaining = 100 - floors.reduce((sum, f) => sum + f, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < remaining; k++) {
    const target = byRemainder[k % byRemainder.length];
    if (target) result[target.i] = (result[target.i] ?? 0) + 1;
  }

  return result;
}
