# e2e

Playwright e2e harness for the webapp, designed for repeatable use by humans and agents.

## What this does

- Starts `apps/webapp` automatically on `http://127.0.0.1:4173` (unless disabled).
- Runs chromium desktop + mobile projects.
- Captures trace/video/screenshots on failure.
- Provides stable debugger-specific tests under `tests/debugger.spec.ts`.

## Prerequisites

- Node runtime compatible with current Vite/SvelteKit in this repo.
  - Current requirement: Node `20.19+` or `22.12+`.
- Playwright browser installed:

```bash
bunx playwright install --with-deps chromium
```

If Node runtime is not compatible on your machine, run the webapp separately in a compatible environment and use `E2E_SKIP_WEBSERVER=1` mode below.

## Install

```bash
bun install
```

## Run

From repo root:

```bash
bun run --filter e2e test
bun run --filter e2e test:debugger
bun run --filter e2e test:headed
```

From `apps/e2e`:

```bash
bun run test
bun run test:debugger
```

## Reusing an already-running app server

If `apps/webapp` is already running, skip Playwright webServer startup:

```bash
E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://127.0.0.1:4173 bun run --filter e2e test
```

## Overriding web server command

Set a custom command when local environment needs a different runtime:

```bash
E2E_WEBSERVER_COMMAND="cd ../webapp && bun run dev -- --host 127.0.0.1 --port 4173 --strictPort" bun run --filter e2e test:debugger
```

## Structure

- `playwright.config.ts`: shared infra (webServer/baseURL/projects/reporter)
- `tests/helpers/`: reusable page/test helpers
- `tests/debugger.spec.ts`: baseline debugger UX validations
