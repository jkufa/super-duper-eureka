# gpuix spike (spec 2)

Spec: `implementation/gpuix-port/02-gpuix-spike-spec.md`. Branch: `feat/gpuix-spike-wiring`, cut from `gpuix-port`.

## Q1. Workspace wiring

Result: pass. The two-app split works. The fallback (single package) was not needed.

Layout: `apps/web` (package `web`), `apps/desktop` (package `desktop`), `packages/ui` (`@retirement/ui`).
The shared root is `packages/ui/src/App.svelte`. It takes a `platform` prop, which each app builds in its own
`platform.ts`. `packages/ui/src/BalanceSummary.svelte` imports `@retirement/calculator` and shows a 30-year
projected balance.

### Versions

| Package                                   | Version                                           |
| ----------------------------------------- | ------------------------------------------------- |
| gpuix-svelte                              | 0.6.0 (exact pin)                                 |
| gpuix-svelte-ui                           | 0.6.0 (exact pin)                                 |
| @gpuix/native (via gpuix-svelte)          | 0.11.0                                            |
| Svelte bundled inside gpuix-svelte        | 5.57.2 (custom-renderer build)                    |
| svelte (apps/web, hoisted to root)        | 5.59.2                                            |
| @sveltejs/kit (apps/web)                  | 3.4.1                                             |
| @sveltejs/adapter-vercel (apps/web)       | 7.0.5                                             |
| @sveltejs/vite-plugin-svelte              | 7.3.2                                             |
| svelte-check                              | 4.7.8                                             |
| typescript                                | 5.9.3 (the repo's; Kit 3's TS 6 peer is optional) |
| Bun / Vite+ / Vite                        | 1.4.5 / 1.7.0 / 8.3.8                             |
| Node (system, used by the gpuix launcher) | 24.13.0                                           |

### Criteria

Scratch scripts used below live outside the repo and are not committed. What they do is described inline.

**1. The desktop window opens from `apps/desktop` through gpuix's dev command, started with `vp run`: pass.**

```
$ vp run desktop#dev
~/apps/desktop$ gpuix-svelte --bun app.ts ⊘ cache disabled
[gpuix-svelte] created native window
[gpuix-svelte] mount complete
```

CoreGraphics window list for the `bun.native` process the task started (pid 56955): window 5210, on screen,
960 × 709 at (384, 219). `screencapture` could not take a picture of it (see "Screen capture" below), so the
screenshots come from gpuix's automation protocol, which launches the same `app.ts` through the same
launcher with `--bun` and asks the window's own Metal renderer for a PNG:

- `.codex/notes/assets/gpuix-spike/q1-desktop-window-shows-balance.png`

**2. The desktop tsconfig resolves the bundled Svelte wherever Bun installed gpuix-svelte: pass.**

`apps/desktop/tsconfig.json` lists two `paths` candidates for `svelte` and `svelte/*`: gpuix-svelte installed
for the app (`./node_modules/gpuix-svelte/...`) and gpuix-svelte hoisted to the root
(`../../node_modules/gpuix-svelte/...`). TypeScript takes the first that exists.

Hoisted (this repo's install):

```
$ tsc -p apps/desktop/tsconfig.json --traceResolution | grep "Module name 'svelte' was successfully"
... resolved to '.../super-duper-eureka/node_modules/gpuix-svelte/node_modules/svelte/types/index.d.ts' with Package ID 'svelte/types/index.d.ts@5.57.2'
```

Not hoisted: a scratch copy of the repo installed with `bun install --linker isolated`. There
`node_modules/gpuix-svelte` does not exist and `apps/desktop/node_modules/gpuix-svelte` is a symlink into
`node_modules/.bun/gpuix-svelte@0.6.0/...`.

```
... resolved to '.../iso/node_modules/.bun/gpuix-svelte@0.6.0/node_modules/gpuix-svelte/node_modules/svelte/types/index.d.ts' with Package ID 'svelte/types/index.d.ts@5.57.2'
$ svelte-check --tsconfig ./tsconfig.json --config ./svelte.config.js --fail-on-warnings   (in iso/apps/desktop)
svelte-check found 0 errors and 0 warnings
```

The desktop window also opened and showed the balance from the isolated install, and the web build there
still bundled one Svelte.

**3. A `packages/ui` component compiles with the bundled Svelte for desktop and with the app's Svelte for web: pass.**

Desktop: a probe run through the launcher (`gpuix-svelte --bun probe.ts`) compiled `BalanceSummary.svelte`
with gpuix's own compile function and compared runtime instances:

```
compiler VERSION seen by the launcher: 5.57.2
compiled imports: import $renderer from 'gpuix-svelte/renderer'; import 'svelte/internal/flags/custom-renderer'; ... import * as $ from 'svelte/internal/client'; import { calculateProjection, makeConfig } from '@retirement/calculator'; ...
"svelte/internal/client" from the component is the bundled runtime: true
... and is not the registry runtime at node_modules/svelte: true
natural resolution from packages/ui would have been: .../node_modules/svelte/src/internal/client/index.js
```

gpuix's Bun plugin pins every `svelte/*` specifier to its bundled copy, whatever the importer. That is why a
component in another workspace package still runs on the bundled runtime.

Web: see criterion 4. The only Svelte in both web bundles is `node_modules/svelte` 5.59.2, which is what
`apps/web` resolves.

**4. The web build contains one Svelte runtime, and the guard plugin stays quiet: pass.**

The shared root uses gpuix-svelte's `Scroller` and gpuix-svelte-ui's `apply_theme`, so gpuix-svelte's DOM
code (`lib/dom.js` and the DOM `Scroller`, both of which import `svelte`) is in the web bundle. The check is
not vacuous.

```
$ vp run web#build
✓ built in 86ms
> Using @sveltejs/adapter-vercel
✔ done
$ vp build 2>&1 | grep -iE "warn|one-svelte|bundled svelte"    # no output
```

A scratch script ran the same build through `createBuilder().buildApp()` with one extra plugin that lists,
per environment, the `svelte` package directories of every bundled module:

```
[ssr] bundled svelte copies: 1
    .../super-duper-eureka/node_modules/svelte
[ssr] bundled gpuix-svelte modules: .../dom/Scroller.svelte, gpuix-svelte/lib/dom.js, ...
[ssr] external svelte imports: none
[client] bundled svelte copies: 1
    .../super-duper-eureka/node_modules/svelte
[client] bundled gpuix-svelte modules: .../dom/Scroller.svelte, gpuix-svelte/lib/dom.js, ...
[client] external svelte imports: none
```

The guard fires when the bundled Svelte leaks in. A temporary plugin emptied `resolve.dedupe`, then was reverted:

```
error during build:
Error: gpuix-svelte's bundled svelte reached the web build: svelte/internal/init-operations from .../node_modules/gpuix-svelte/src/components/dom/Scroller.svelte
```

The guard differs from the demo's in two ways. It finds gpuix-svelte through `@retirement/ui`'s
resolution, not `./node_modules`, because `apps/web` does not depend on gpuix-svelte and Bun hoists it. It
also checks every `svelte` import, not only those from inside gpuix-svelte.

**5. Both type checks pass over the shared components: pass.**

```
$ vp run web#check
1795676533400 COMPLETED 349 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
$ vp run desktop#check
svelte-check found 0 errors and 0 warnings
```

Each check types the shared markup as its own renderer. A GPUI-only attribute (`testid`) on a div in
`App.svelte` passed desktop and failed web with `'"testid"' does not exist in type 'HTMLProps<"div", ...>'`.
A DOM-only one (`title`) failed desktop with `'"title"' does not exist in type 'GpuixAttributes'`. Both
edits were reverted. Desktop runs `svelte-check` with every diagnostic source. The demo's
`--diagnostic-sources js,svelte` was not needed. A TS error added to `app.ts` was caught by the same
command, so the demo's separate `tsc` pass is not needed either.

**6. Editing a shared component hot-reloads in both targets: pass, with one workaround on desktop.**

The edit each time: `Balance after` → `Projected balance after` in `packages/ui/src/BalanceSummary.svelte`,
reverted afterwards.

Desktop, through `vp run desktop#dev` (edit, then revert):

```
[gpuix-svelte] mount complete
[gpuix-svelte] remount complete
[gpuix-svelte] remount complete
```

Desktop, through automation (text read from the live window's element tree):

```
before:     Balance after 30 years | $432,194 | Running on desktop
[gpuix-svelte] remount complete
after edit: Projected balance after 30 years | $432,194 | Running on desktop
```

- `.codex/notes/assets/gpuix-spike/q1-desktop-window-shows-balance.png` (before)
- `.codex/notes/assets/gpuix-spike/q1-desktop-hot-reload-after-shared-edit.png` (after)

Web, through `vp run web#dev` and headless Chromium (Playwright from `apps/e2e`). A marker set on `window`
before the edit survived, so this was HMR, not a full reload:

```
before: Balance after 30 years | $432,194 | Running on web
after:  Projected balance after 30 years | $432,194 | Running on web
marker survived (no full reload): set before edit
(client) hmr update /@fs/.../packages/ui/src/BalanceSummary.svelte
```

- `.codex/notes/assets/gpuix-spike/q1-web-page-shows-balance.png` (before)
- `.codex/notes/assets/gpuix-spike/q1-web-hot-reload-after-shared-edit.png` (after)

**7. A shared component imports `@retirement/calculator` and shows a computed balance on both targets: pass.**

`$432,194` on both: `makeConfig({ currentBalance: 100_000, timeHorizonYears: 30 })` at the default 5%.
Screenshots under criterion 6. The SSR HTML from the dev server contains it too:
`curl -s http://127.0.0.1:5180/` → `Balance after 30 years`, `$432,194`, `Running on web`.

### Workarounds and attempts

All of these are in our own code and config. Nothing in gpuix is patched.

1. Desktop hot reload of `packages/ui` (criterion 6).
   - Attempt 1: plain `render_hot`. Failed: the window text did not change after the edit. `render_hot`
     watches only the root component's own directory (`apps/desktop/src`).
   - Attempt 2: `app.ts` watches `packages/ui/src` too and, on a `.svelte` change, sets the root file's
     mtime with `utimesSync`. `render_hot`'s watcher sees that and remounts. On Bun the remount drops every
     `.svelte` file outside `node_modules` from the module cache, so the shared components reload too. Works.
     Side effect: `DesktopRoot.svelte`'s mtime changes, but its content does not. An editor with it open may
     notice.
2. svelte-check config lookup (criterion 5).
   - Attempt 1: no Svelte config. Both checks failed on the shared files with `Error in vite.config ... No
     Svelte configuration found in vite config`. svelte-check walks up from each file. From `packages/ui` it
     reaches the root `vite.config.ts`. From `apps/desktop` it finds that app's `vite.config.ts`, which only
     holds Vite+ tasks. A vite config wins over a `svelte.config.js` in the same directory.
   - Attempt 2: an empty `packages/ui/svelte.config.js`, an empty `apps/desktop/svelte.config.js`, and
     `--config ./svelte.config.js` in the desktop check task. Works.
3. `@retirement/calculator` types (criterion 5): the shared component's import failed to type-check
   (`Cannot find module '@retirement/calculator'`), because calculator and logger declared only `module`,
   which `moduleResolution: bundler` ignores. Added `"types": "src/index.ts"` to both package.json files.
   Runtime resolution is unchanged.
4. Web dev SSR of workspace packages (criterion 6/7).
   - Attempt 1: no change. 500 with `Failed to resolve entry for package "@retirement/calculator"`. The dev
     server externalized it and resolved it Node-style, which ignores `module`.
   - Attempt 2: `"exports": "./src/index.ts"` in calculator and logger. 500 with `ERR_MODULE_NOT_FOUND
     .../packages/calculator/src/lib/calculator` because Node now loaded the TS source and cannot follow its
     extensionless imports. Reverted to the `types` field from item 3.
   - Attempt 3: `ssr: { noExternal: [/^@retirement\//] }` in `apps/web/vite.config.ts`. Works. The legacy app
     avoids this with Kit `alias` entries pointing at the source files.
5. `vp check` hung with no output (criterion 5/deliverable 3). `tsrs` sat at 0% CPU when a linted file had no
   owning tsconfig: `packages/ui/src/platform.ts` and `apps/desktop/svelte.config.js`. Fixed with
   `packages/ui/tsconfig.json` (extends `packages/tsconfig.pkg.json`) and `allowJs` in the desktop tsconfig.
   A missing owner shows up as a hang, not an error.

### gpuix warnings seen

None. The only `[gpuix-svelte]` lines in any run were `created native window`, `mount complete` and
`remount complete`. No compile warnings from gpuix's loader for the shared components.

### Screen capture

macOS has not granted Screen Recording to this terminal session.

- `screencapture -x full.png` succeeded but captured only the wallpaper and menu bar, without the window.
- `screencapture -x -o -l 5210 win.png` (the gpuix window id): `could not create image from window`, exit 1.
- `CGPreflightScreenCaptureAccess()` from a Swift script: `false`.
- `osascript -e 'tell application "System Events" to get ... of (every process whose unix id is ...)'`:
  `execution error: System Events got an error: AppleEvent timed out. (-1712)` after 120 s. Accessibility
  was never granted, so no input went through System Events either. None was needed.

The desktop screenshots therefore come from `App.screenshot()` in `gpuix-svelte/automation`
(`captureScreenshot` on the live window's renderer). It needs no permission. The driver must run with
`node --conditions custom-renderer --conditions development`, or importing `gpuix-svelte/automation` throws
`custom_renderer_unavailable_on_server`.

### Install layout: Kit 3 at the root, and a Svelte bump for the legacy app

Bun's hoisted linker puts the highest version at the root. After adding `apps/web`, the root has Kit 3.4.1,
adapter-vercel 7.0.5 and svelte 5.59.2, and the legacy app's Kit 2.70.4 and adapter-vercel 6.3.1 moved into
`apps/webapp-legacy/node_modules`. Workspace order in the root `package.json` does not change this (tested in
a scratch copy). Bun has no hoist-pattern option.

Bun also nested the legacy app's locked svelte 5.50.0, while bits-ui and the other hoisted libraries got the
root 5.59.2. `webapp-legacy#check` then failed with 4 errors, all "Two different types with this name exist"
on `Snippet`. Fix: deleted the `"webapp-legacy/svelte"` entries from `bun.lock` and reinstalled from
scratch. The legacy app now resolves the root svelte 5.59.2, which its `^5.49.2` range allows. Its
`package.json` and source are unchanged. If `apps/webapp-legacy/node_modules/svelte` ever reappears after an
install, this has regressed.

Legacy evidence after the bump:

- `vp run webapp-legacy#check`: 0 errors, 46 warnings. Baseline at `e56934a`: the same 46 warnings.
- `vp test`: 7 files, 295 tests pass.
- `vp run e2e`: 29 failed, 7 skipped, 12 passed. The baseline worktree at `e56934a` with the old lockfile
  gives exactly the same 29 failing tests (compared by name). These failures predate this branch.

Legacy's Kit is nested now. `apps/webapp-legacy/node_modules/sveltekit-superforms` is nested beside it and
resolves that same Kit copy. Root-level `runed` and `sveltekit-superforms` each have their own nested Kit
2.70.4. `runed` only imports `$app/*`, which Vite resolves virtually.

### Things a later agent (Q2 to Q6) needs to know

- Kit 3 has no `svelte.config.js`. Config goes in `sveltekit({...})` in `vite.config.ts`. `$lib` is gone.
  Use `#lib/*` through `package.json` `imports`, with the file extension in the import (`#lib/platform.ts`).
  `extends: "$app/tsconfig"` points at `node_modules/$app/tsconfig.json`, which `svelte-kit sync` writes.
  `apps/web`'s `prepare` script runs it on install.
- The desktop dev task needs `--bun`. Without it the launcher runs on Node under `vp run`. Node fails on
  `@retirement/calculator` with `Cannot find package .../@retirement/calculator/index.js`, because it ignores
  `module`. gpuix's Node loader also adds its `?v=N` cache-buster only to relative `.svelte` imports, so
  `@retirement/ui/...` imports would not reload there. That second point is read from `lib/compile.js` and was
  not tested.
- Import shared components by their `.svelte` subpath (`@retirement/ui/App.svelte`), not through a `.ts`
  barrel. On Bun, a reload only drops `.svelte` modules from the cache, so a barrel module would keep handing
  out the old components.
- `.ts` and `.svelte.ts` edits under `apps/desktop/src` need a window restart. `render_hot` says so in its
  log. The touch watcher in `app.ts` only forwards `.svelte` edits from `packages/ui`.
- The registry svelte 5.59.2 also exports `./renderer` and `push_renderer` now. gpuix-svelte's `main`
  (#87, "run on Svelte 5.59 from npm instead of a bundled build") is unreleased. When we upgrade past 0.6.0,
  the bundled copy may disappear. The desktop `paths`, the `one-svelte` guard and the WRONG_SVELTE check
  will need another look then.
- `bun.lock` records `gpuix-svelte/svelte` as `svelte@5.59.2` with `"bundled": true`. On disk it is the
  tarball's 5.57.2 build. Read the version from `node_modules/gpuix-svelte/node_modules/svelte/package.json`,
  not from the lockfile.
- `apply_theme()` runs in an `$effect`. The web page therefore shows the browser's default colours until
  hydration (see `q1-web-page-shows-balance.png`). Q2's `theme_rule` in `<svelte:head>` fixes that.
- The root `dev` script now runs `vp run webapp-legacy#dev` instead of `vp run -r --parallel dev`. Otherwise
  `vp run dev` would also open the web dev server and a desktop window.
- gpuix's automation screenshots are 2x and opaque. Text read through `getByType('text')` or the
  `getAllText` call is the most reliable desktop assertion.

## Q2. Server rendering

Not started.

## Q3. Text input

Not started.

## Q4. Chart

Not started.

## Q5. Desktop plumbing

Not started.

## Q6. Packaged build

Not started.
