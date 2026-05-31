// Tip Calculator — split a bill across guests with a tip %.
//
// BUGS (planted for FireFunc to fix — see ../ISSUE.md):
//   1. Empty bill input → `parseFloat('')` is NaN → result reads "$NaN".
//   2. Guests = 0 → division by zero → result reads "$Infinity per guest".
//
// Expected behavior for both: show a friendly inline error ("Please enter a
// bill" / "Need at least 1 guest") and clear the result, rather than rendering
// NaN/Infinity values that look broken to users.

export function splitBill({ bill, tipPercent, guests }) {
  const safeBill = Number.isFinite(bill) && bill >= 0 ? bill : 0;
  const safeGuests = Number.isInteger(guests) && guests >= 1 ? guests : 1;
  const tip = safeBill * (tipPercent / 100);
  const total = safeBill + tip;
  const perGuest = total / safeGuests;
  return { tip, total, perGuest };
}

function format(n) {
  return `$${n.toFixed(2)}`;
}

function wire() {
  const billEl = document.getElementById('bill');
  const tipEl = document.getElementById('tip');
  const guestsEl = document.getElementById('guests');
  const resultEl = document.getElementById('result');
  const btn = document.getElementById('calc-btn');
  if (!billEl || !tipEl || !guestsEl || !resultEl || !btn) return;

  btn.addEventListener('click', () => {
    const bill = parseFloat(billEl.value);
    const tipPercent = parseFloat(tipEl.value);
    const guests = parseInt(guestsEl.value, 10);

    if (!Number.isFinite(bill) || bill < 0) {
      resultEl.innerHTML = '<div class="error">Please enter a bill amount</div>';
      return;
    }
    if (!Number.isInteger(guests) || guests < 1) {
      resultEl.innerHTML = '<div class="error">Need at least 1 guest</div>';
      return;
    }

    const { tip, total, perGuest } = splitBill({ bill, tipPercent, guests });

    resultEl.innerHTML = `
      <div>Tip: <strong>${format(tip)}</strong></div>
      <div>Total: <strong>${format(total)}</strong></div>
      <div>Per guest: <strong>${format(perGuest)}</strong></div>
    `;
  });
}

if (typeof document !== 'undefined') {
  wire();
}
