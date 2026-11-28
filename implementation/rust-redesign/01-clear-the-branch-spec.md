# Spec 1: Clear the branch

Date: 2026-11-27
Depends on: nothing
Blocks: spec 2

## Goal

`rust-redesign` holds only what the redesign needs: the calculator, the CLI, the logger they still import, and their tests. Every caller that would pin the old calculator contract is gone, so spec 2 can break that contract freely.

## Before deleting

The repo holds no link to a Vercel project. `apps/webapp-legacy/.vercel` contained local build output only, and `vercel.json` set the install and build commands. So the owner checks the Vercel dashboard: the production branch must be `main`. If the project builds previews for other branches, switch previews off for `rust-redesign` or accept failing preview builds. Record the result in the PR. As of 2026-11-27 nobody has checked.

## Delete

| Path                        | Why                                                 |
| --------------------------- | --------------------------------------------------- |
| `apps/webapp-legacy/`       | The web target is dropped. The live site is `main`. |
| `apps/web/`                 | Spike app for the dropped plan.                     |
| `apps/desktop/`             | Spike app for the dropped plan.                     |
| `packages/ui/`              | Shared Svelte components for the dropped plan.      |
| `apps/e2e/`                 | Playwright tests for the deleted apps.              |
| `scripts/check-kit-deps.ts` | It checks Kit dependencies. No Kit app remains.     |

Then remove what pointed at them:

- Root `package.json`: the `dev` script, the Kit, web and desktop parts of `check`, and `apps/*` from `workspaces` if `apps/` is now empty.
- Root `vite.config.ts`: the `e2e` tasks, `apps/webapp-legacy` in `test.projects`, the Svelte formatter option, and every `fmt` and `lint` entry that names a deleted path or `.svelte` files.
- Root `tsconfig.json`: the `include` entries for `scripts/` and for legacy files.
- `btca.config.jsonc`: the `svelte`, `kit` and `superforms` resources.
- Root `README.md`: the SvelteKit, Playwright, `apps/*` and e2e content.
- `bun.lock`: regenerate with `vp install`.
- `.codex/notes/`: leave every note. They are history.

## Update AGENTS.typescript.md

The TypeScript rules live in `AGENTS.typescript.md`. Trim it to what remains.

- "Project Structure & Module Organization": list only what remains.
- "Build, Test, and Development Commands": remove the commands for deleted apps. Keep `vp install`, `vp test`, `vp check`, `vp lint`, `vp fmt` and `vp run retirement-calc`.
- "Coding Style & Naming Conventions": remove Svelte and the component rules.
- "Testing Guidelines": remove the legacy validation sequence and the E2E note.
- "Lessons From Review": delete the section. Each lesson is about Svelte bundling or Kit dependencies, and that code is gone. Then remove the first bullet under "Lessons From Review" in `AGENTS.md`, which points at them.
- "Agent Notes": remove the line about `apps/webapp-legacy/.codex/AGENTS.md`.

In `AGENTS.md`, change `apps/`, `packages/` under "Where Things Are" to `packages/`.

## Acceptance criteria

- `vp install`, `vp check` and `vp test` pass.
- `vp test` runs the calculator's four test files and nothing else. On 2026-11-27 that is 275 tests as Vitest counts them, from 41 `it` and `test` declarations.
- `vp run retirement-calc --config packages/cli/examples/basic.json` prints the same output as it does on `gpuix-port`. Save both outputs and diff them.
- `grep -rn "webapp-legacy\|apps/web\|apps/desktop\|packages/ui\|apps/e2e\|svelte" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.codex --exclude-dir=.claude --exclude-dir=implementation --exclude-dir=qa --exclude=bun.lock .` finds nothing. `qa/` holds old audits that name `apps/webapp/`, and `.claude/` is local tool config.
- No file under `packages/calculator`, `packages/cli` or `packages/logger` changed.

## Out of scope

- Any change to the calculator, the CLI or the logger. That is spec 2.
- Removing Vite+ or Bun. Spec 4 does that, after the port.
- `main` and the live site.
