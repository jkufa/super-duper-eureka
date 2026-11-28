# TypeScript guidelines

Read this before working on anything under `packages/`. The rules in [AGENTS.md](AGENTS.md) apply as well.

This file is temporary. The TypeScript code is the reference for the Rust port and is deleted when the port passes. Spec 4 of `implementation/rust-redesign/` deletes it.

## Project Structure & Module Organization

- `packages/calculator/`: core calculator + domain utilities (`src/lib/__testing__` for Vitest).
- `packages/cli/`: CLI wrapper and examples (`packages/cli/examples/`).
- `packages/logger/`: shared wide-event logging utilities.

## Build, Test, and Development Commands

The repo runs on Vite+ (`vp`) with Bun as the package manager. Tasks are defined in `vite.config.ts` files and cached; see `run.tasks` in the root config and in each package.

- `vp install`: install dependencies (runs Bun).
- `vp run build`: build every package in dependency order (same as `vp run -r build`). Unchanged packages replay from cache.
- `vp test`: run the calculator's unit tests. `vp run test` runs the same thing through the task cache.
- `vp check`: format check, lint, type-aware lint and TypeScript type check for the whole repo.
- `vp lint` / `vp fmt`: lint or format on their own. `vp check --fix` applies fixes from both.
- `vp run retirement-calc --config <file>`: run the CLI on the Bun runtime.
- `vp run @retirement/calculator#bench`: time 60 `compound` passes and 60 `calculateProjection` runs on the 30-year, five-rule reference case, on Node and then on Bun.
- `vp run @retirement/calculator#write-baseline`: rewrite the engine baseline in `packages/calculator/src/lib/__testing__/baseline/` on Node. Run it only on the engine from before spec 2 part B. After that, the baseline is what the engine must reproduce, and rewriting it would hide a change in the maths. Bun and Node compute some powers differently, so the baseline must be written on Node, which the tests run on. Do not run the tests while it runs: it swaps the folder at the end, and a test run at that moment can see no baseline.

## Coding Style & Naming Conventions

- Language: TypeScript.
- Formatting/linting: Oxfmt + Oxlint, configured in the `fmt` and `lint` blocks of the root `vite.config.ts`. Put package-specific rules in `lint.overrides` there, not in package configs. Run `vp check` after changes and `vp check --fix` if it reports formatting issues.
- Naming: `*.test.ts` for tests, `kebab-case.ts` for utility modules.

## Testing Guidelines

- Unit tests: Vitest through `vp test`, in `packages/calculator/src/lib/__testing__`. Import test APIs from `vite-plus/test`.
- Add/adjust tests for behavioral changes.

## Agent Notes

- CLI examples:
  - `vp run retirement-calc --config packages/cli/examples/basic.json`
  - `vp run retirement-calc --config packages/cli/examples/daily-debug.json --debug`
