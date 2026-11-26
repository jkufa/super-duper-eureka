# super-duper-eureka

Monorepo for a retirement projection toolkit.

It includes:

- A SvelteKit web app for configuring scenarios, viewing projection charts/tables, and using a debugger.
- A TypeScript calculator engine for monthly/daily compounding retirement projections.
- A CLI package for running projections from JSON configs.
- Shared logging utilities and end-to-end tests.

## Tech Stack

- Runtime/package manager: Bun
- Toolchain: Vite+ (`vp`) for tasks, tests, linting (Oxlint) and formatting (Oxfmt)
- App framework: SvelteKit + TypeScript
- Unit testing: Vitest, through `vp test`
- E2E testing: Playwright

## Repository Layout

- `apps/webapp-legacy`: main UI application
- `apps/e2e`: Playwright end-to-end test suite
- `packages/calculator`: core retirement projection engine
- `packages/cli`: command-line interface (`retirement-calc`)
- `packages/logger`: shared logging helpers
- `implementation`: implementation notes/spec artifacts
- `qa`: QA notes and rollout tracking

## Getting Started

1. Install dependencies:

```bash
vp install
```

1. Start the legacy web app's dev server:

```bash
vp run dev
```

1. Build all packages in dependency order (cached):

```bash
vp run build
```

## Common Commands

- Run unit tests:

```bash
vp test
```

- Format check, lint and type check the repo:

```bash
vp check
```

- Apply formatting and lint fixes:

```bash
vp check --fix
```

- Run e2e tests:

```bash
vp run e2e
```

- Run e2e tests in debugger mode:

```bash
vp run e2e:debugger
```

## Webapp Validation Flow

For changes in `apps/webapp-legacy`, run:

1. `vp run webapp-legacy#check` (`svelte-check`, covers `.svelte` files)
2. `vp check`
3. If formatting or lint fixes are needed: `vp check --fix`, then re-run both

## CLI Usage

Run the CLI on the Bun runtime:

```bash
vp run retirement-calc --config packages/cli/examples/basic.json
```

Example with debug output:

```bash
vp run retirement-calc --config packages/cli/examples/daily-debug.json --debug
```
