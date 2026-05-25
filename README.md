# firefunc-sample

A deliberately tiny app used to validate the **FireFunc** auto-fix loop
end-to-end. It has one planted bug (`average([])` returns `NaN`) and a test that
catches it.

```bash
npm test   # the "empty list" test fails until the bug is fixed
```

The end-to-end test: open the issue in `ISSUE.md`, label it `firefunc-autofix`,
and FireFunc dispatches a Claude Code Routine that writes the fix, makes the test
pass, and opens a draft PR.
