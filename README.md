# super-duper-eureka

Monorepo for a retirement projection toolkit.

It includes:

- A SvelteKit web app for configuring scenarios, viewing projection charts/tables, and using a debugger.
- A TypeScript calculator engine for monthly/daily compounding retirement projections.
- A CLI package for running projections from JSON configs.
- Shared logging utilities and end-to-end tests.

## Tech Stack

- Runtime/package manager: Bun
- App framework: SvelteKit + TypeScript
- Unit testing: Vitest
- E2E testing: Playwright

## Repository Layout

- `apps/webapp`: main UI application
- `apps/e2e`: Playwright end-to-end test suite
- `packages/calculator`: core retirement projection engine
- `packages/cli`: command-line interface (`retirement-calc`)
- `packages/logger`: shared logging helpers
- `implementation`: implementation notes/spec artifacts
- `qa`: QA notes and rollout tracking

## Getting Started

1. Install dependencies:

```bash
bun install
```

1. Run all workspace dev processes:

```bash
bun run dev
```

1. Build all workspaces:

```bash
bun run build
```

## Common Commands

- Run non-e2e tests:

```bash
bun run test
```

- Run e2e tests:

```bash
bun run e2e
```

- Run e2e tests in debugger mode:

```bash
bun run e2e:debugger
```

- Lint all workspaces:

```bash
bun run lint
```

- Format all workspaces:

```bash
bun run format
```

## Webapp Validation Flow

For changes in `apps/webapp`, run:

1. `bun run --filter webapp check`
2. `bun run --filter webapp lint`
3. If formatting is required: `bun run --filter webapp format`, then re-run check + lint

## CLI Usage

Run the CLI from workspace scripts:

```bash
bun run retirement-calc --config packages/cli/examples/basic.json
```

Example with debug output:

```bash
bun run retirement-calc --config packages/cli/examples/daily-debug.json --debug
```
