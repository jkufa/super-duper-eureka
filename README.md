# super-duper-eureka

Monorepo for a retirement projection toolkit.

It includes:

- A TypeScript calculator engine for monthly/daily compounding retirement projections.
- A CLI package for running projections from JSON scenario files.

## Tech Stack

- Runtime/package manager: Bun
- Toolchain: Vite+ (`vp`) for tasks, tests, linting (Oxlint) and formatting (Oxfmt)
- Language: TypeScript
- Unit testing: Vitest, through `vp test`

## Repository Layout

- `packages/calculator`: core retirement projection engine
- `packages/cli`: command-line interface (`retirement-calc`)
- `implementation`: implementation notes/spec artifacts
- `qa`: QA notes and rollout tracking

## Getting Started

1. Install dependencies:

```bash
vp install
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

## CLI Usage

Run the CLI on the Bun runtime:

```bash
vp run retirement-calc --scenario packages/cli/examples/basic.json --today 2026-01-01
```

Trace one account:

```bash
vp run retirement-calc --scenario packages/cli/examples/daily.json --today 2026-02-01 --trace brokerage
```
