# Spec 1: Vite+ migration

Date: 2026-11-25
Depends on: nothing
Blocks: every later spec

## Goal

The whole repo runs on Vite+ with Bun as the package manager. The legacy web app still builds, deploys and passes its Playwright suite. No port work happens in this step.

## Starting point

- Bun 1.3.8, no `packageManager` field, no CI.
- Root scripts fan out with `bun run --parallel --filter`.
- `apps/webapp` is on Vite 7.3, SvelteKit 2.50, Svelte 5.49, Tailwind 4.1.
- `packages/calculator` tests with Vitest 4.0.18. The three test files in `apps/webapp` have no `test` script, so nothing runs them.
- Linting is ESLint through `@jkufa/eslint`. The three packages format with `eslint --fix`. Only the web app uses Prettier.
- `tsconfig.base.json` sets `baseUrl`, which Vite+'s type checker does not support.

## Steps

Each numbered step is its own commit so a failure points at one change.

### 1. Rename the web app

- `git mv apps/webapp apps/webapp-legacy` and rename the package to `webapp-legacy`.
- Update every reference: the `--filter webapp` commands in `AGENTS.md`, the `cd ../webapp` web server command in `apps/e2e/playwright.config.ts` and the two demo configs, and the README.
- Change the Vercel project's root directory to `apps/webapp-legacy`. This is a dashboard setting, so do it by hand at merge time.

### 2. Upgrade Bun

- Upgrade to the newest Bun 1.4 patch. gpuix needs 1.4 to build, and Vite+ fixed a Bun 1.4.0 catalog bug in its 1.7.0 release.
- Add `"packageManager": "bun@1.4.x"` with the exact version to the root `package.json`. Vite+ reads this field first. Its docs disagree on what it picks when the field is missing.
- Set the same Bun version for Vercel builds.

### 3. Move legacy to Vite 8

Do this before running the migrator, so a Vite 8 break shows up as a Vite 8 break.

- Bump `@sveltejs/kit` to 2.70 or later. Its peer range accepts Vite 8, and 2.50's may not.
- Bump `vite` to 8, plus `@sveltejs/vite-plugin-svelte` and `@tailwindcss/vite` to releases that support it.
- Build, run the dev server, run the Playwright suite.

### 4. Run the migrator

- Install the `vp` CLI, then run `vp migrate` from the workspace root on a branch. Keep the original lockfile in place while it runs. The migrator reads it to find the old Vitest version.
- This repo counts as a fresh project, so the migrator runs its full conversion with no flag to skip parts. Expect it to rewrite `vitest` imports to `vite-plus/test`, rewrite scripts, add overrides and convert the ESLint and Prettier configs.
- Read the whole diff before accepting it.

### 5. Finish the lint and format swap

- Put the `lint` and `fmt` blocks in the root `vite.config.ts`. Do not add per-package blocks.
- The `lint` block extends [`@cloudflare/oxlint-config`](https://github.com/cloudflare/oxlint-config) through its `/vite-plus` entry, with `env` and `ignorePatterns` taken from the preset as its README shows. Pin the exact version. Fix what it reports. Turn a rule off only with a one-line reason next to it.
- Remove ESLint, `@jkufa/eslint`, `typescript-eslint`, `@stylistic/eslint-plugin`, `eslint-config-prettier`, `@eslint/compat`, Prettier and its two plugins, every `eslint.config.js` and `.prettierrc`.
- Turn on Oxfmt's `svelte` option. Carry over the web app's Prettier settings for the whole repo: single quotes, no trailing commas, width 100, spaces.
- Reformat everything once in a commit that contains nothing else. The packages move from the stylistic style to Oxfmt's, so this diff touches most TS files.
- Try Oxfmt's Tailwind class sorting with `apps/webapp-legacy/src/routes/layout.css` as the stylesheet. If it does not sort inside `.svelte` files, leave legacy classes unsorted. That app is going away.

### 6. Tests

- `vp test` runs the four calculator test files.
- Add a test config to `apps/webapp-legacy` so its three orphaned test files run too. Spec 3 moves them to the shared package.
- The migrator leaves commented Vitest 4 compatibility settings. Remove each one the tests pass without.

### 7. Tasks

Define tasks in `run.tasks` in the root `vite.config.ts` so they cache. Replace the root `package.json` scripts with `vp run` calls.

| Task              | Command                                          | Notes                                                      |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `build`           | per package                                      | depends on the build of workspace dependencies             |
| `test`            | `vp test`                                        |                                                            |
| `check`           | `svelte-kit sync && svelte-check` in the web app | `vp check` covers lint, format and TS, not `.svelte` types |
| `e2e`             | `playwright test`                                | `cache: false`                                             |
| `retirement-calc` | `bun run packages/cli/src/index.ts`              | stays on the Bun runtime, `cache: false`                   |
| `dev`             | per app                                          | `cache: false`                                             |

The packages keep building with `tsc --build`. Moving them to `vp pack` is optional and not part of this spec.

### 8. Type checking

- Remove `baseUrl` from `tsconfig.base.json` and fix any import that relied on it.
- Turn on type-aware linting and type checking in the `lint` block.

### 9. Docs

Rewrite the commands section of `AGENTS.md` for `vp`.

## Acceptance criteria

- `bun.lock` is the only lockfile and `vp install` runs Bun.
- `vp check` passes at the root.
- `vp test` runs seven test files and all pass.
- `vp run -r build` passes, and a second run reports cache hits.
- The legacy app runs in dev and builds on Vite 8.
- All 24 Playwright tests pass against the legacy app.
- A Vercel preview deployment of the legacy app builds and loads.
- No ESLint or Prettier dependency or config file is left in the repo.
- `AGENTS.md` shows the new commands and the `webapp-legacy` name.

## Out of scope

- The new app and anything gpuix.
- CI and remote caching. Vite+ has not shipped remote caching.
- Changes to legacy source beyond formatting and import rewrites.

## Risks

- **Legacy may not survive Vite 8.** superforms, the Tailwind plugin or the LayerChart prerelease could break. Step 3 isolates this. If no fix exists, stop and revisit decision 4, since the fallback is to port first and migrate after deleting legacy.
- **Lint coverage drops for Svelte.** Oxlint reads only the `<script>` block of `.svelte` files and cannot run `eslint-plugin-svelte`. `svelte-check` still reports compiler and accessibility warnings.
- **Oxlint's JS plugin support is alpha.** If a rule from `@jkufa/eslint` matters to you and has no native equivalent, name it during review of step 4 and we decide then.
