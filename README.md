# firefunc-sample

A complex task/project-tracker SaaS sample app used to validate the FireFunc
auto-fix loop end-to-end. This is a real (if compact) application: a Fastify API,
a SQLite store with numbered migrations, pure-logic core modules, and a React +
Vite board UI.

> Current state: **compiling stub skeleton with fixed contracts.** The shared
> types, module entry points, and function signatures are frozen; module agents
> implement the logic against those contracts next.

## Stack

- **API** — Fastify (`src/api`), `/health` + tasks/projects/users/reports routes
- **Core** — pure logic: state machine, SLA, priority ranking, recurrence,
  query DSL, formatting (`src/core`)
- **DB** — better-sqlite3 + numbered migration runner (`src/db`)
- **Web** — React + Vite Kanban board, filters, reports, settings (`src/web`)
- **Shared** — types, constants, config, logger (`src/shared`)

## Scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm run build`    | Type-check + emit with `tsc`                     |
| `npm run typecheck`| Type-check only (`tsc --noEmit`)                 |
| `npm test`         | Run the vitest suite                             |
| `npm run dev`      | Boot the Fastify API via `tsx watch`             |
| `npm run migrate`  | Apply pending SQL migrations                     |
| `npm run seed`     | Seed the database with demo data                 |
| `npm run web:dev`  | Start the Vite dev server for the UI             |
| `npm run screenshot` | Capture a screenshot of the running UI         |

## Quick start

```bash
npm install
npm run build
npm test
npm run dev   # serves /health on http://localhost:3000
```

## Domain model

`Task` (state: `todo | in_progress | blocked | done`, priority:
`low | medium | high | urgent`) belongs to a `Project`, is reported/assigned to
`User`s, carries labels, an optional SLA window, and an optional recurrence rule.
See `src/shared/types.ts` for the full, frozen contract.

## License

Released under the [MIT License](LICENSE).
