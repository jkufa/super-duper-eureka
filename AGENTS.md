# Repository Guidelines

## Project Structure & Module Organization
- `apps/webapp/`: SvelteKit UI (forms, projection, debugger).
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
- `bun run --filter webapp check`: Svelte diagnostics.
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
- For `apps/webapp` changes, default validation sequence:
1. `bun run --filter webapp check`
2. `bun run --filter webapp lint`
3. if needed: `bun run --filter webapp format`, then re-run check + lint.
- E2E note: if local Node/runtime cannot start Playwright web server, run with external server:
  `E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://127.0.0.1:4173 bun run e2e:debugger`

## Commit & Pull Request Guidelines
- Follow concise, imperative commit messages. Current history commonly uses:
  - `refactor(webapp): ...`, `test(e2e): ...`, `docs: ...`
- Keep commits scoped to one concern.
- PRs should include:
  - what changed and why, test evidence, and UI screenshots/videos where relevant.
  - linked/updated docs in `implementation/` or `qa/` when behavior or rollout status changes.

## Agent Notes
- Add brief working notes in `.codex/notes/` for substantial problems/solutions.
- Webapp-specific guidance may also exist in `apps/webapp/.codex/AGENTS.md`.
- CLI examples:
  - `bunx retirement-calc --config packages/cli/examples/basic.json`
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug`
