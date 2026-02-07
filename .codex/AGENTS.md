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

## Notes

As you work on the project, always add md files to `.codex/notes/` explaining the problem and your solution. You can reference these notes in your future work.

Webapp-specific agent guidance lives in `apps/webapp/.codex/AGENTS.md`.

## E2E (Agents)

- Preferred command: `bun run e2e:debugger` (or `bun run e2e` for full suite).
- e2e web server startup requires a Node runtime compatible with current Vite/SvelteKit.
  - Current requirement: Node `20.19+` or `22.12+`.
- If local Node is not compatible, start webapp externally and run e2e with:
  - `E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://127.0.0.1:4173 bun run e2e:debugger`
- For custom startup behavior, set:
  - `E2E_WEBSERVER_COMMAND="<your command>" bun run e2e:debugger`
