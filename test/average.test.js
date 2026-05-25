import { test } from 'node:test';
import assert from 'node:assert/strict';
import { average } from '../src/average.js';

test('average of a non-empty list', () => {
  assert.equal(average([2, 4, 6]), 4);
});

test('average of an empty list is 0 (not NaN)', () => {
  // Reproduces the bug: average([]) currently returns NaN.
  assert.equal(average([]), 0);
});
