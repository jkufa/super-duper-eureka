# TypeScript guidelines

Read this before working on anything under `packages/`. The rules in [AGENTS.md](AGENTS.md) apply as well.

This file is temporary. The TypeScript code is the reference for the Rust port and is deleted when the port passes. Spec 4 of `implementation/rust-redesign/` deletes it.

## Project Structure & Module Organization

- `packages/calculator/`: the projection engine. `src/index.ts` exports `parseScenario`, `projectScenario`, `traceAccount`, `ScenarioError` and the file and result types, nothing else.
  - `src/lib/`: `plain-date.ts`, `scenario.ts` (file and validated types), `parse-scenario.ts`, `account-schedule.ts`, `compound.ts`, `project-account.ts`, `project-scenario.ts`, `effective-rate.ts`, and `random.ts` (`createSeededRandom`).
  - `src/lib/corpus/`: the parity corpus generator from spec 2 part H. `generateCase(seed)` in `case.ts`, valid cases in `valid.ts`, invalid and engine-failure cases in `faults.ts`, traits in `traits.ts`, and `stableJson` in `json.ts`. Not exported from the package. `no-clock.test.ts` scans it like engine code.
  - `src/lib/__testing__/`: Vitest tests and their helpers. `factories.ts` holds `makeScenarioFile`, `makeAccount` and `makeRule`. `baseline/` holds the stored baseline, which `legacy-scenario.ts` and `legacy-config.ts` read through the adapter.
  - `scripts/bench.ts`: the benchmark. `scripts/write-corpus.ts`: writes corpus cases to a folder.
- `packages/cli/`: the `retirement-calc` CLI (`src/index.ts`), its subprocess tests (`src/__testing__/cli.test.ts`) and example scenarios (`examples/`).

## Build, Test, and Development Commands

The repo runs on Vite+ (`vp`) with Bun as the package manager. Tasks are defined in `vite.config.ts` files and cached; see `run.tasks` in the root config and in each package.

- `vp install`: install dependencies (runs Bun).
- `vp run build`: build every package in dependency order (same as `vp run -r build`). Unchanged packages replay from cache.
- `vp test`: run the calculator's unit tests and the CLI's subprocess tests, the two Vitest projects in the root config. `vp run test` runs the same thing through the task cache.
- `vp check`: format check, lint, type-aware lint and TypeScript type check for the whole repo.
- `vp lint` / `vp fmt`: lint or format on their own. `vp check --fix` applies fixes from both.
- `bun packages/cli/src/index.ts --scenario <file> [--today YYYY-MM-DD] [--trace <accountId>] [--band baseline|positive|negative]`: run the CLI on the Bun runtime. It prints one JSON document to stdout, and nothing else. Programs and the parity harness call it this way. `vp run retirement-calc` with the same options runs it too, for reading by eye: it prints a line of its own to stdout before the JSON. It exits 1 on bad usage or a file that cannot be read or is not JSON, and 2 on a `ScenarioError`, with `{ "error": { "code", "accountId"?, "ruleId"? } }` on stdout.
- `vp run parity-corpus <outputDir> <firstSeed> <lastSeed>`: write the parity corpus. Each seed gives `<seed>.json`, the case `{ scenario, today, traits }`, and `<seed>.scenario.json`, its scenario alone, which a CLI reads with `--scenario <seed>.scenario.json --today <today>`. `traits` is a sorted list of the edges the case reaches; a failing case has `invalid` or `engine_error`, `fault:<name>`, `error:<code>` and, when the error carries them, `error_account:<id>` and `error_rule:<id>`. Nothing generated is committed.
- `vp run @retirement/calculator#bench`: time one effective-rate solve and one `projectScenario` on the 30-year, three-account reference case, on Node and then on Bun.

## Coding Style & Naming Conventions

- Language: TypeScript.
- Formatting/linting: Oxfmt + Oxlint, configured in the `fmt` and `lint` blocks of the root `vite.config.ts`. Put package-specific rules in `lint.overrides` there, not in package configs. Run `vp check` after changes and `vp check --fix` if it reports formatting issues.
- Naming: `*.test.ts` for tests, `kebab-case.ts` for utility modules.

## Testing Guidelines

- Unit tests: Vitest through `vp test`, in `packages/calculator/src/lib/__testing__`. Import test APIs from `vite-plus/test`.
- CLI tests: `packages/cli/src/__testing__/cli.test.ts` runs the real CLI with `bun` as a subprocess and checks stdout, stderr and the exit status. They need `bun` on the `PATH`.
- Add/adjust tests for behavioral changes.
- Build test scenarios with `makeScenarioFile`, `makeAccount` and `makeRule` from `__testing__/factories.ts`, or as JSON objects, and run them through `parseScenario` with a fixed `today`.
- The baseline in `__testing__/baseline/` is fixed. Never edit it. `baseline-scenario.test.ts` and `baseline-project-scenario.test.ts` must reproduce it exactly through the adapter. Nothing can regenerate it.
- `examples.test.ts` projects every file in `packages/cli/examples/` with a fixed `today`. A new example needs an entry there.
- `no-clock.test.ts` fails if engine source outside the test folder contains `new Date`, `Date.now` or `Math.random`. The CLI is the only code that reads the clock.

## Agent Notes

- CLI examples, each with the `today` its test uses:
  - `bun packages/cli/src/index.ts --scenario packages/cli/examples/basic.json --today 2026-01-01`
  - `bun packages/cli/src/index.ts --scenario packages/cli/examples/custom-growth.json --today 2026-01-01`
  - `bun packages/cli/src/index.ts --scenario packages/cli/examples/daily.json --today 2026-02-01 --trace brokerage`
  - `bun packages/cli/src/index.ts --scenario packages/cli/examples/one-time.json --today 2026-01-01`
  - `bun packages/cli/src/index.ts --scenario packages/cli/examples/stale-and-excluded.json --today 2026-06-15`
