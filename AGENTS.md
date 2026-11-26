# Repository Guidelines

## Project Structure & Module Organization

- `apps/webapp-legacy/`: SvelteKit UI (forms, projection, debugger).
- `apps/e2e/`: Playwright tests (`tests/*.spec.ts`, `tests/helpers/*`).
- `packages/calculator/`: core calculator + domain utilities (`src/lib/__testing__` for Vitest).
- `packages/cli/`: CLI wrapper and examples (`packages/cli/examples/`).
- `packages/logger/`: shared wide-event logging utilities.
- `implementation/`, `qa/`: specs/audits and rollout tracking docs.

## Build, Test, and Development Commands

- `bun install`: install dependencies.
- `bun run dev`: run workspace dev servers.
- `bun run build`: build all workspaces.
- `bun run test`: run non-e2e tests.
- `bun run e2e` / `bun run e2e:debugger`: Playwright suites.
- `bun run --filter webapp-legacy check`: Svelte diagnostics.
- `bun run --filter @retirement/calculator test`: calculator unit tests.
- `bun run lint` / `bun run format`: lint/format all workspaces.

## Coding Style & Naming Conventions

- Language: TypeScript + Svelte 5.
- Formatting/linting: Prettier + ESLint. Run lint after changes; run format if lint reports formatting issues.
- Naming: `PascalCase.svelte` for components, `*.spec.ts` for tests, `kebab-case.ts` for utility modules.
- Prefer small composable components and shared domain utilities over duplicated form logic.

## Testing Guidelines

- Unit tests: Vitest in `packages/calculator/src/lib/__testing__`.
- E2E tests: Playwright in `apps/e2e/tests`.
- Add/adjust tests for behavioral changes (especially custom-variable flows and debugger/projection interactions).
- For `apps/webapp-legacy` changes, default validation sequence:

1. `bun run --filter webapp-legacy check`
2. `bun run --filter webapp-legacy lint`
3. if needed: `bun run --filter webapp-legacy format`, then re-run check + lint.

- E2E note: if local Node/runtime cannot start Playwright web server, run with external server:
  `E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://127.0.0.1:4173 bun run e2e:debugger`

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
  - `bunx retirement-calc --config packages/cli/examples/basic.json`
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug`
- skills:
  - use btca cli to ask questions about external codebases such as svelte, sveltekit (kit), chrono, etc.
