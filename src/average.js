// Returns the arithmetic mean of an array of numbers.
//
// An empty array averages to 0 — guarding the divide-by-zero that previously
// produced NaN. See ISSUE.md.
export function average(numbers) {
  if (numbers.length === 0) return 0;
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return total / numbers.length;
}
