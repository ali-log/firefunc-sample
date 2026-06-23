/**
 * Convert a set of counts into integer percentages that sum to exactly 100,
 * using the largest-remainder (Hamilton) method.
 *
 * Rounding each share independently with Math.round can over- or under-shoot
 * the total: e.g. counts [1, 1, 1] each round to 33 and sum to 99, while other
 * distributions can sum to 101. Hamilton floors every share, then hands the
 * leftover points to the shares with the largest fractional remainders, so the
 * result always sums to 100 while staying as close as possible to each exact
 * share.
 *
 * Returns an array of integer percentages aligned to `counts`. When the grand
 * total is 0 (no items), every percentage is 0.
 */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map((x) => Math.floor(x));
  let remaining = 100 - floors.reduce((sum, x) => sum + x, 0);

  // Indices ordered by largest fractional remainder; ties broken by original order.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floors.slice();
  for (let k = 0; k < order.length && remaining > 0; k++) {
    const idx = order[k]!.i;
    result[idx] = result[idx]! + 1;
    remaining -= 1;
  }
  return result;
}
