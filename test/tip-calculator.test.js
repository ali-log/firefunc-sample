// Failing tests that pin the two planted bugs in web/tip-calculator.js.
// Both reproduce until FireFunc lands the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitBill } from '../web/tip-calculator.js';

test('happy path: 120 bill, 15% tip, 4 guests = 34.50 per guest', () => {
  const r = splitBill({ bill: 120, tipPercent: 15, guests: 4 });
  assert.equal(r.tip, 18);
  assert.equal(r.total, 138);
  assert.equal(r.perGuest, 34.5);
});

test('BUG 1: empty bill (NaN) should be treated as 0, not propagate NaN', () => {
  // parseFloat('') === NaN, which the UI feeds in. The function should clamp
  // to 0 / surface an error, not return NaN.
  const r = splitBill({ bill: NaN, tipPercent: 15, guests: 4 });
  assert.equal(Number.isNaN(r.total), false, 'total should not be NaN');
  assert.equal(Number.isNaN(r.perGuest), false, 'perGuest should not be NaN');
});

test('BUG 2: guests = 0 should not yield Infinity per guest', () => {
  const r = splitBill({ bill: 120, tipPercent: 15, guests: 0 });
  assert.equal(
    Number.isFinite(r.perGuest),
    true,
    'perGuest should be finite (treat 0 guests as a validation error or as 1)',
  );
});
