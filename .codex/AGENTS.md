# AGENTS

This repo contains a retirement calculator, a CLI wrapper, and a shared logger package. Bun is used for development and testing.

## Setup

- Install dependencies: `bun install`
- Workspace layout:
  - `packages/calculator` (library)
  - `packages/cli` (CLI)
  - `packages/logger` (wide-event logger)

## Tests

- Run all tests: `bun run test`
- Run calculator tests only: `bun run --cwd packages/calculator test`
- Coverage (calculator): `bun run --cwd packages/calculator test --coverage --run`

## Linting

- Always run the linter after making changes.
- Lint all packages: `bun run lint`
- Lint specific package only: `bun run --filter '<package-name>' lint`
  - Example: `bun run --filter '@retirement/calculator' lint`

## Formatting

- Always run the formatter after making changes.
- Format all packages: `bun run format`
- Format specific package only: `bun run --filter '<package-name>' format`

## CLI usage

Examples live in `packages/cli/examples/`.

- Basic run:
  - `bunx retirement-calc --config packages/cli/examples/basic.json`

- Debug run (step-by-step wide events, pretty JSON by default):
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug`

- Non-interactive debug (raw JSON):
  - `bunx retirement-calc --config packages/cli/examples/one-time.json --debug --no-interactive --raw`

Skip steps:

- Skip specific steps and ranges:
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug --skip "1,3-5,12"`
- Skip next N steps (interactive or via flag):
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug --skip "next:10"`

Notes:

- `--debug` emits wide-event JSON per step plus a final run summary.
- Interactive mode pauses between steps (press Enter to continue, `q` to quit).

## Debug module (UI integration)

The debug utilities are exported directly from `@retirement/calculator`:

- `calculateProjectionWithSteps`
- `buildStepWideEvent`
- `buildRunWideEvent`
- `createWideEventLogger` (from `@retirement/logger`)

The logger is a standalone module for UI reuse:

- Package: `@retirement/logger`
- Entry: `packages/logger/src/index.ts`
