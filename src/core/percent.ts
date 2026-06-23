/**
 * Distribute integer percentages across `counts` so they always sum to 100
 * (whenever the total is positive), using the largest-remainder (Hamilton)
 * method.
 *
 * Rounding each share independently with `Math.round` can yield sums of 99 or
 * 101 (e.g. counts [1, 1, 1, 3] -> 17 + 17 + 17 + 50 = 101). Hamilton rounding
 * floors every share, then hands the leftover whole points to the entries with
 * the largest fractional remainders, guaranteeing the result sums to exactly
 * 100.
 *
 * Returns an array the same length as `counts`. Negative counts are treated as
 * 0. If the total is 0 (or `counts` is empty), every percentage is 0.
 */
export function percentages(counts: number[]): number[] {
  const safe = counts.map((c) => (Number.isFinite(c) && c > 0 ? c : 0));
  const total = safe.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return safe.map(() => 0);

  const exact = safe.map((c) => (c / total) * 100);
  const result = exact.map((x) => Math.floor(x));
  let remaining = 100 - result.reduce((sum, f) => sum + f, 0);

  // Hand the leftover points to the largest fractional remainders first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < order.length && remaining > 0; k++) {
    const i = order[k]!.i;
    result[i]! += 1;
    remaining -= 1;
  }

  return result;
}
