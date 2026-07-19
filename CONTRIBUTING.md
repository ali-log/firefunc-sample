# Contributing

Thanks for contributing to firefunc-sample! Requires Node.js >= 20.

## Install

Install dependencies from the lockfile:

```bash
npm ci
```

## Develop

Start the Fastify API dev server (via `tsx watch`, serves `/health` on http://localhost:3000):

```bash
npm run dev
```

To run the React + Vite board UI instead, use `npm run web:dev`.

## Test

Run the full test suite (vitest):

```bash
npm test
```
