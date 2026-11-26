# Repository Guidelines

## Project Structure & Module Organization

- `apps/webapp-legacy/`: SvelteKit UI (forms, projection, debugger).
- `apps/web/`: new SvelteKit app (gpuix port). Kit 3 on `adapter-vercel`.
- `apps/desktop/`: gpuix-svelte desktop app (gpuix port). `app.ts` opens the window.
- `packages/ui/`: `@retirement/ui`, Svelte components shared by `apps/web` and `apps/desktop`.
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
- `vp run web#dev` / `vp run web#build`: the new web app's dev server and build.
- `vp run desktop#dev`: open the desktop window. Edits to `.svelte` files in `apps/desktop/src` and `packages/ui/src` hot-reload. Edits to `.ts` and `.svelte.ts` modules there do not: the log prints a restart notice, and the window keeps the old code until you restart it.
- `vp run desktop#package`: gpuix-svelte's packaged build on Bun. Writes an unsigned `apps/desktop/dist/Retirement Calculator.app` (about 110 MB, gitignored). Not part of `vp run build`.
- `vp run web#check` / `vp run desktop#check`: `svelte-check` for each target, both over `packages/ui/src`.
- `vp run check`: `vp check`, then `scripts/check-kit-deps.ts`, then the `check` task of `webapp-legacy`, `web` and `desktop`. The script fails when `cookie` or `devalue`, resolved from an app's directory, is missing or outside the range that app's Kit declares. Fix that by adding the dependency to the app with Kit's range.
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

### Branches

- `gpuix-port` is the long-running integration branch for the migration. It was cut from `main`.
- Open every migration PR against `gpuix-port`, not `main`. Stacked PRs may target the PR below them, as long as the bottom of the stack targets `gpuix-port`.
- `gpuix-port` merges into `main` once, at cutover (step 6). Merge `main` into `gpuix-port` when it needs fixes landed on `main`.

### Models

- Orchestration agent: Fable 5.2.
- Implementation agents: Opus 5.5.
- Code review agents: GPT 6.2 Sol when the work under review is low or medium effort, GPT 6.2 Astra when it is high effort. The orchestrator states the effort level when it hands work to review.

### Code Review Log

- Review agents keep running notes in `implementation/gpuix-port/code-review-log.md`. Record code smells and habits the implementers show, one entry per finding.
- Before adding an entry, search the log for the same problem. If it has happened before, add a guideline under "Lessons From Review" below so later agents stop repeating it, and mark the log entries as promoted.
- Only PR review agents read or write the log. Orchestration and implementation agents do not open it. They get its lessons through this file.

### Lessons From Review

- Check bundling rules against the emitted chunks. For server dependency checks, inspect the imports the server still resolves at runtime.
- When counting bundled runtimes, identify each package by its manifest name and real directory. Include an npm package alias in the check.
- Check desktop Svelte path mappings from a shared importer against the launcher's behavior. Cover public exports with different shapes, including declaration files and the package manifest.
- Before a dependency check tells someone to add a package, check the app's manifest. If the requested range is already declared, report the installed version and suggest checking overrides or reinstalling.

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
