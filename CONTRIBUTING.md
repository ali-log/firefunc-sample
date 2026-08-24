# Contributing

Thanks for contributing to **firefunc-sample**! This guide covers the two things
you need most often: how to run the tests and how to open a pull request.

## Prerequisites

- **Node.js >= 20** (see the `engines` field in `package.json`)
- Install dependencies once after cloning:

  ```bash
  npm install
  ```

## Running the tests

The project uses [Vitest](https://vitest.dev/) for unit tests and
[Playwright](https://playwright.dev/) for end-to-end tests.

```bash
npm test          # run the full Vitest suite once
npm run typecheck # type-check without emitting (tsc --noEmit)
npm run test:e2e  # run the Playwright end-to-end tests
```

Before opening a pull request, make sure `npm test` and `npm run typecheck` both
pass. If you touch the UI, run `npm run test:e2e` as well.

To iterate on a single test while developing, you can pass a filename or name
pattern through to Vitest:

```bash
npx vitest run test/state-machine.test.ts   # a single file
npx vitest -t "transitions"                  # tests whose name matches
```

## Opening a pull request

1. **Create a branch** off `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b my-change
   ```

2. **Make your change** and keep it focused. Add or update tests that cover the
   behavior you changed.

3. **Verify locally** before pushing:

   ```bash
   npm test
   npm run typecheck
   ```

4. **Commit** with a clear, descriptive message:

   ```bash
   git add -A
   git commit -m "Describe what changed and why"
   ```

5. **Push** your branch and **open the PR** against `main`:

   ```bash
   git push -u origin my-change
   ```

   Then open the pull request on GitHub — either follow the link printed by
   `git push`, or use the GitHub CLI:

   ```bash
   gh pr create --base main --fill
   ```

6. In the PR description, explain **what** changed and **why**, and note how you
   tested it. Make sure CI is green, then request a review.

Thanks again for helping improve the project!
