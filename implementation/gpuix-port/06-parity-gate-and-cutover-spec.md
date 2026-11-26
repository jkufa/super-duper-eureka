# Spec 6: Parity gate and cutover

Date: 2026-11-25
Depends on: spec 5

## Goal

Prove the new app matches the old one where it should, move the production deployment to it, and delete `apps/webapp-legacy`.

## The gate

All of these must be true before anything in production changes.

### Automated

- Every `@parity` Playwright test passes on all four projects.
- Every `@app-only` test passes on both app projects.
- Every `@legacy-only` row in `apps/e2e/PARITY.md` names its replacement test or the decision that removed the behaviour.
- `vp check`, both type checks and `vp test` pass.
- The desktop smoke suite passes on macOS.

### Saved data

- Capture a `localStorage` payload written by the legacy app, with at least one custom variable and a disabled contribution rule. Store it as a test fixture.
- A test loads that payload into the new app's web store adapter and gets the same config back.
- The same payload, saved as the desktop JSON file, produces the same projection through `retirement-calc --config`.

### By hand

One pass on the web at wide and narrow widths, and one on the packaged desktop app.

- Every form field edits, commits and persists across a reload or restart.
- Add, edit and delete a custom variable using only the keyboard.
- The chart tooltip, click selection and arrow keys work.
- The debugger opens, steps and copies.
- The numbers match the legacy app for the same config. Compare three years from the table and the final balance.

Styling is expected to differ. Decision 14 strips it to the kit's defaults.

## Cutover

1. Tag the commit `webapp-legacy-final`.
2. Deploy the new app to a Vercel preview. Check that `DEBUG` and `MOCK_REAL_DATA` are set for it as they are for legacy.
3. Point the Vercel project's root directory at `apps/web` and deploy to production.
4. Open production in a browser that has saved legacy data and confirm it loads.

Rollback is Vercel's instant rollback to the last legacy deployment. Keep legacy in the repo until step 4 has held for a few days of your own use.

## Deletion

One commit, after the cutover has held.

- Delete `apps/webapp-legacy`.
- Delete the two legacy Playwright projects, the legacy selector map and every `@legacy-only` test.
- Decide on `demo-video.spec.ts` and its two configs. Re-record against the new app or delete them.
- Remove dependencies only legacy used. `vp install` then shows what dropped out of the lockfile.
- Remove the Tailwind stylesheet path from the `fmt` block.
- Update `AGENTS.md` and the README: the structure section, the commands, and the webapp guidance that mentions shadcn and Tailwind.
- Add a note in `.codex/notes/` recording what the port changed for users.

## Acceptance criteria

- Production serves the new app.
- The repo has no `webapp-legacy`, no shadcn, bits-ui, superforms, formsnap, vaul, LayerChart, number-flow, mode-watcher or Tailwind dependency.
- `vp check`, `vp test`, `vp run -r build` and `vp run e2e` pass.
- `PARITY.md` has only `@parity` and `@app-only` rows, or is deleted.

## After this spec

Not planned here. These are the items the earlier decisions deferred.

- A design direction on top of the blank slate.
- The calendar grid and a theme toggle.
- Multiple scenarios, file open and save, and the SQLite store adapter.
- Signing and notarising the desktop build, and Windows or Linux builds.
