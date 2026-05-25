# Bug: `average([])` returns NaN instead of 0

**What happens:** calling `average([])` (empty array) returns `NaN`.

**Expected:** an empty list should average to `0`.

**Repro:**
```js
import { average } from './src/average.js';
console.log(average([])); // NaN  ← should be 0
```

`npm test` fails on the "average of an empty list is 0" case.

---
> Paste this as a new GitHub Issue in the test repo, then add the label
> `firefunc-autofix` to trigger FireFunc.
