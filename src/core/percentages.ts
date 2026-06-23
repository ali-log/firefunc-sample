/**
 * Convert a list of integer counts into whole-number percentages that always
 * sum to exactly 100 (when the total is non-zero).
 *
 * Rounding each share independently with `Math.round` can make the displayed
 * percentages sum to 99 or 101. This uses the largest-remainder (Hamilton)
 * method: floor every share, then hand the leftover points one-by-one to the
 * shares with the largest fractional remainders.
 *
 * Returns an array parallel to `counts`. If the total of all counts is 0 (or
 * negative), every entry is 0 — there is nothing to apportion.
 */
export function largestRemainderPercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total <= 0) {
    return counts.map(() => 0);
  }

  const exact = counts.map((c) => (c / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);

  // Order indices by descending fractional remainder; ties keep input order so
  // the result is deterministic.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  const result = [...floors];
  for (let i = 0; i < order.length && remaining > 0; i += 1) {
    const target = order[i]!.index;
    result[target] = (result[target] ?? 0) + 1;
    remaining -= 1;
  }
  return result;
}
