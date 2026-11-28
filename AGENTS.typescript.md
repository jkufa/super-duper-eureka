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
- Use the btca CLI to ask questions about external TypeScript codebases such as chrono.
