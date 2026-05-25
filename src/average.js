// Returns the arithmetic mean of an array of numbers.
//
// BUG: when given an empty array this divides by zero and returns NaN instead
// of a sensible 0. See ISSUE.md.
export function average(numbers) {
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return total / numbers.length;
}
