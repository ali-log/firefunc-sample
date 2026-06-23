/**
 * Convert a list of counts into integer percentages that always sum to 100,
 * using the largest-remainder (Hamilton) method.
 *
 * Rounding each share independently with Math.round lets the totals drift above
 * or below 100 (e.g. counts [1,1,1,3] → 17+17+17+50 = 101), which is the visual
 * glitch seen on the board. Largest-remainder rounding floors every share, then
 * hands the leftover whole points to the shares with the biggest fractional
 * remainders, guaranteeing the result sums to exactly 100.
 *
 * Returns all zeros when the total is 0 (avoids 0/0 = NaN and n/0 = Infinity).
 */
export function largestRemainderPercentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((c) => (c / total) * 100);
  const result = exact.map((x) => Math.floor(x));
  let remaining = 100 - result.reduce((sum, x) => sum + x, 0);

  // Distribute the leftover points to the largest fractional remainders.
  // Ties break by original index for deterministic output.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let k = 0; k < remaining; k++) {
    const target = order[k % order.length];
    if (target) result[target.i] = (result[target.i] ?? 0) + 1;
  }

  return result;
}
