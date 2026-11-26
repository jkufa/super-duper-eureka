# Repository Guidelines

## Project Structure & Module Organization

- `apps/webapp-legacy/`: SvelteKit UI (forms, projection, debugger).
- `apps/e2e/`: Playwright tests (`tests/*.spec.ts`, `tests/helpers/*`).
- `packages/calculator/`: core calculator + domain utilities (`src/lib/__testing__` for Vitest).
- `packages/cli/`: CLI wrapper and examples (`packages/cli/examples/`).
- `packages/logger/`: shared wide-event logging utilities.
- `implementation/`, `qa/`: specs/audits and rollout tracking docs.

## Build, Test, and Development Commands

The repo runs on Vite+ (`vp`) with Bun as the package manager. Tasks are defined in `vite.config.ts` files and cached; see `run.tasks` in the root config and in each package.

- `vp install`: install dependencies (runs Bun).
- `vp run dev`: start the legacy web app's dev server.
- `vp run build`: build every package in dependency order (same as `vp run -r build`). Unchanged packages replay from cache.
- `vp test`: run all unit tests (calculator and legacy app). `vp run test` runs the same thing through the task cache.
- `vp check`: format check, lint, type-aware lint and TypeScript type check for the whole repo. It does not type-check `.svelte` files.
- `vp run webapp-legacy#check`: `svelte-kit sync` + `svelte-check` for the legacy app, which covers `.svelte` files.
- `vp run check`: `vp check` followed by `vp run webapp-legacy#check`.
- `vp lint` / `vp fmt`: lint or format on their own. `vp check --fix` applies fixes from both.
- `vp run e2e` / `vp run e2e:debugger` / `vp run e2e:ui`: Playwright suites (never cached).
- `vp run retirement-calc --config <file>`: run the CLI on the Bun runtime.

## Coding Style & Naming Conventions

- Language: TypeScript + Svelte 5.
- Formatting/linting: Oxfmt + Oxlint, configured in the `fmt` and `lint` blocks of the root `vite.config.ts`. Put package-specific rules in `lint.overrides` there, not in package configs. Run `vp check` after changes and `vp check --fix` if it reports formatting issues.
- Naming: `PascalCase.svelte` for components, `*.spec.ts` for tests, `kebab-case.ts` for utility modules.
- Prefer small composable components and shared domain utilities over duplicated form logic.

## Testing Guidelines

- Unit tests: Vitest through `vp test`, in `packages/calculator/src/lib/__testing__` and `apps/webapp-legacy/src/**/*.test.ts`. Import test APIs from `vite-plus/test`.
- E2E tests: Playwright in `apps/e2e/tests`.
- Add/adjust tests for behavioral changes (especially custom-variable flows and debugger/projection interactions).
- For `apps/webapp-legacy` changes, default validation sequence:

1. `vp run webapp-legacy#check`
2. `vp check`
3. if needed: `vp check --fix`, then re-run both.

- E2E note: if Playwright cannot start the web server itself, start it yourself with `vp -C apps/webapp-legacy dev --host 127.0.0.1 --port 4173` and run against it:
  `E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://127.0.0.1:4173 vp run e2e:debugger`

## Commit & Pull Request Guidelines

- Follow concise, imperative commit messages. Current history commonly uses:
  - `refactor(webapp): ...`, `test(e2e): ...`, `docs: ...`
- Keep commits scoped to one concern.
- PRs should include:
  - what changed and why, test evidence, and UI screenshots/videos where relevant.
  - linked/updated docs in `implementation/` or `qa/` when behavior or rollout status changes.

## gpuix Port Migration

Specs live in `implementation/gpuix-port/`. Read its `README.md` first, then the spec for the step you are on.

### Models

- Orchestration agent: Fable 5.2.
- Implementation agents: Opus 5.5.
- Code review agents: GPT 6.2 Sol when the work under review is low or medium effort, GPT 6.2 Astra when it is high effort. The orchestrator states the effort level when it hands work to review.

### Code Review Log

- Review agents keep running notes in `implementation/gpuix-port/code-review-log.md`. Record code smells and habits the implementers show, one entry per finding.
- Before adding an entry, search the log for the same problem. If it has happened before, add a guideline under "Lessons From Review" below so later agents stop repeating it, and mark the log entries as promoted.
- Only PR review agents read or write the log. Orchestration and implementation agents do not open it. They get its lessons through this file.

### Lessons From Review

None yet. Review agents add one bullet per recurring problem, phrased as an instruction.

### Finishing Work

- When work is finished, end the report with 1 to 3 next steps.

## Agent Notes

- Add brief working notes in `.codex/notes/` for substantial problems/solutions.
- Webapp-specific guidance may also exist in `apps/webapp-legacy/.codex/AGENTS.md`.
- CLI examples:
  - `vp run retirement-calc --config packages/cli/examples/basic.json`
  - `vp run retirement-calc --config packages/cli/examples/daily-debug.json --debug`
- skills:
  - use btca cli to ask questions about external codebases such as svelte, sveltekit (kit), chrono, etc.
