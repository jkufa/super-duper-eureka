# gpuix spike (spec 2)

Spec: `implementation/gpuix-port/02-gpuix-spike-spec.md`. Branch: `feat/gpuix-spike-wiring`, cut from `gpuix-port`.

## Q1. Workspace wiring

Result: pass. The two-app split works. The fallback (single package) was not needed.

Review round 1 (PR #6) found five problems in the first version of this wiring. All are fixed, and
the evidence below is the corrected one: Svelte type resolution under criterion 2, the guard under
criterion 4, markup-only components under criterion 5, the shared-module restart notice under
criterion 6, and the broken legacy build under "Kit runtime dependencies" in "Install layout".

Review round 2 found three more, also fixed: `scripts/check-kit-deps.ts` compared directories and
crawled Kit's source (see "Kit runtime dependencies"), the desktop `svelte/*` path mapping also
caught `svelte/package.json` (criterion 2), and the guard knew Svelte only by a directory named
`svelte` (criterion 4).

Layout: `apps/web` (package `web`), `apps/desktop` (package `desktop`), `packages/ui` (`@retirement/ui`).
The shared root is `packages/ui/src/App.svelte`. It takes a `platform` prop, which each app builds in its own
`platform.ts`. `packages/ui/src/BalanceSummary.svelte` imports `@retirement/calculator` and shows a 30-year
projected balance.

### Versions

| Package                                    | Version                                           |
| ------------------------------------------ | ------------------------------------------------- |
| gpuix-svelte                               | 0.6.0 (exact pin)                                 |
| gpuix-svelte-ui                            | 0.6.0 (exact pin)                                 |
| @gpuix/native (via gpuix-svelte)           | 0.11.0                                            |
| Svelte bundled inside gpuix-svelte         | 5.57.2 (custom-renderer build)                    |
| svelte (apps/web, hoisted to root)         | 5.59.2                                            |
| @sveltejs/kit (apps/web)                   | 3.4.1                                             |
| @sveltejs/adapter-vercel (apps/web)        | 7.0.5                                             |
| @sveltejs/vite-plugin-svelte               | 7.3.2                                             |
| svelte-check                               | 4.7.8                                             |
| typescript                                 | 5.9.3 (the repo's; Kit 3's TS 6 peer is optional) |
| Bun / Vite+ / Vite                         | 1.4.5 / 1.7.0 / 8.3.8                             |
| Node (system, used by the gpuix launcher)  | 24.13.0                                           |
| cookie / devalue for apps/web (Kit 3)      | 2.0.2 / 5.9.4 (declared, Kit 3's ranges)          |
| cookie / devalue for webapp-legacy (Kit 2) | 0.6.0 / 5.9.4 (declared, Kit 2's ranges)          |
| devalue for svelte 5.59.2                  | 6.0.4 (nested under `node_modules/svelte`)        |

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

`apps/desktop/tsconfig.json` does three things, each with two candidates: gpuix-svelte installed for
the app (`./node_modules/gpuix-svelte/...`) and gpuix-svelte hoisted to the root
(`../../node_modules/gpuix-svelte/...`). TypeScript takes the first that exists.

- `paths` lists the bundled package's typed `exports` one by one. `svelte/elements` maps to
  `elements.d.ts`. `svelte` and the 14 other typed subpaths (`action`, `animate`, `attachments`,
  `compiler`, `easing`, `events`, `legacy`, `motion`, `reactivity`, `reactivity/window`, `renderer`,
  `server`, `store`, `transition`) map to `types/index.d.ts`, the dts-buddy file that declares all
  of them. The first version mapped `svelte/*` to `svelte/*`, which only matched subpaths with a file
  at the package root. `svelte/reactivity`, `svelte/reactivity/window` and `svelte/events` have none,
  fell through to `node_modules`, and loaded the registry 5.59.2 `types/index.d.ts`. Its ambient
  `declare module 'svelte/...'` blocks then merged into the bundled ones.
- `svelte/package.json` is not mapped. Round 1 used a `svelte/*` wildcard to `types/index.d.ts`,
  which also caught the manifest: `import pkg from 'svelte/package.json'` in a shared `.ts` file
  passed `web#check` and failed `desktop#check` with `File '.../gpuix-svelte/node_modules/svelte/types/index.d.ts'
  is not a module` (TS2306). gpuix's `pin_svelte` (`lib/plugin.js`) skips string-valued exports, so
  at runtime the manifest comes from normal resolution. Launcher probe (`gpuix-svelte --bun probe.ts`
  in `apps/desktop`, importing a shared helper that reads the manifest):
  `manifest from shared importer: 5.59.2 | svelte/compiler VERSION under launcher: 5.57.2`.
  TypeScript now resolves it the same way, to the registry `package.json` at 5.59.2.
  `svelte/internal/*` exports have no types and are left unmapped too.
- `typeRoots` lists gpuix-svelte's own `node_modules` first. svelte-check prefixes every component with
  `/// <reference types="svelte" />`, and type references ignore `paths`. Without this they walked up
  to the registry svelte too.
- `typeRoots` also lists both `@types` folders, so `bun` in `types` still resolves.
  `gpuix-svelte/html` moved from `types` to `apps/desktop/src/gpuix-html.d.ts`, because with custom
  typeRoots a name in `types` is looked up in typeRoots only. A reference written in a file still walks
  `node_modules`.

Probe: a temporary `packages/ui/src/svelte-types-probe.ts` importing every public subpath (`svelte`
and the 15 above), the type `RendererConnection` from `svelte/renderer` (it exists in 5.59.2 and not
in 5.57.2), and `svelte/package.json`. Before the round 1 fix, both layouts resolved
`svelte/reactivity` to the registry copy and both `tsc` and svelte-check accepted
`RendererConnection`.

After the round 2 fix, hoisted (this repo's install), `tsc -p apps/desktop/tsconfig.json
--traceResolution` and `--listFilesOnly`:

```
svelte, svelte/action, animate, attachments, compiler, easing, events, legacy, motion, reactivity,
reactivity/window, renderer, server, store, transition
    -> node_modules/gpuix-svelte/node_modules/svelte/types/index.d.ts
svelte/elements -> node_modules/gpuix-svelte/node_modules/svelte/elements.d.ts
svelte/package.json -> node_modules/svelte/package.json (5.59.2)
svelte package files in the program: 5.57.2 types/index.d.ts, 5.57.2 elements.d.ts,
    5.57.2 node_modules/magic-string (from svelte/compiler), 5.59.2 package.json (nothing else)
error TS2305: Module '"svelte/renderer"' has no exported member 'RendererConnection'.
```

svelte-check (`desktop#check`'s command) on the same probe reports that one error and nothing for
the manifest import.

svelte-check, with a `--require` hook logging every svelte declaration file it reads:

```
READ 5.57.2 node_modules/gpuix-svelte/node_modules/svelte/types/index.d.ts
READ 5.57.2 node_modules/gpuix-svelte/node_modules/svelte/elements.d.ts
READ 5.59.2 node_modules/svelte/svelte-html.d.ts
READ 5.59.2 node_modules/svelte/elements.d.ts
ERROR "../../packages/ui/src/svelte-types-probe.ts" 4:15 "Module '"svelte/renderer"' has no exported member 'RendererConnection'."
```

Isolated: a scratch copy installed with `bun install --linker isolated`. `node_modules/gpuix-svelte`
does not exist there and `apps/desktop/node_modules/gpuix-svelte` is a symlink into the `.bun` store.
Same result, every typed subpath going to
`node_modules/.bun/gpuix-svelte@0.6.0/node_modules/gpuix-svelte/node_modules/svelte/...` at 5.57.2,
the manifest to `node_modules/.bun/svelte@5.59.2/node_modules/svelte/package.json`, and the same
single `RendererConnection` error from both `tsc` and svelte-check.

Limit: the two 5.59.2 reads above are svelte-check's own. It picks a Svelte with
`require.resolve('svelte/package.json')` from the tsconfig's directory, ignoring `paths`, and adds that
package's `svelte-html.d.ts` (which imports its own `./elements.js`) as a global. No tsconfig option
moves it. Those files declare no `svelte/*` modules, so imports are unaffected. But
`svelte-html.d.ts` starts with `/// <reference lib="dom" />`: a shared `.ts` file using `document`
passes `desktop#check` (0 errors) while `tsc -p apps/desktop/tsconfig.json` rejects it with TS2584.
DOM globals in shared code are not caught on desktop yet.

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

The guard has two checks. `resolveId` names the importer when a bare `svelte` import resolves to the
bundled copy. `generateBundle` reads every emitted chunk's module IDs, per environment, finds each
module's owning package (the nearest `package.json` with a `name`), and fails when a package named
`svelte` has a real directory other than the one `apps/web` resolves `svelte/package.json` to. The
second check was added in round 1: the first version only had `resolveId`, so an import of the
bundled runtime's resolved path built without complaint, and both outputs then held both runtimes.
Round 2 replaced its directory-name regex (`/node_modules/svelte/`) with the manifest lookup.

Negative probes, each reverted afterwards (run in scratch copies, hoisted and isolated):

1. Dedupe disabled (a temporary plugin emptying `resolve.dedupe` in `config` and `configEnvironment`):
   ```
   Error: gpuix-svelte's bundled svelte reached the web build: svelte/internal/server from .../gpuix-svelte/src/components/dom/Scroller.svelte
   Error: gpuix-svelte's bundled svelte reached the web build: svelte from .../gpuix-svelte/lib/dom.js
   ```
   With the `resolveId` check short-circuited, the chunk check alone still fails it:
   ```
   RolldownError: [ssr] gpuix-svelte's bundled svelte is in the web build: node_modules/gpuix-svelte/node_modules/svelte/src/escaping.js (in entries/pages/_page.svelte.js)
   ```
2. Direct resolved-path import (`import * as b from '<gpuix>/node_modules/svelte/src/internal/client/index.js'`
   from `apps/web/src/lib`, used by `+page.svelte`). Before the fix the build passed. Now:
   ```
   RolldownError: [ssr] gpuix-svelte's bundled svelte is in the web build: node_modules/gpuix-svelte/node_modules/svelte/src/constants.js (in entries/pages/_page.svelte.js)
   ```
   The same probe in the isolated-linker copy fails with the `.bun/gpuix-svelte@0.6.0/...` path, and
   the clean build there passes.
3. Svelte under another name (`bun add svelte-compat@npm:svelte@5.50.0` in `apps/web`, `tick` from
   both `svelte` and `svelte-compat` in a `+page.svelte` click handler). Before round 2 the build
   passed with two runtimes in separate client chunks. Now:
   ```
   RolldownError: [client] the web build contains Svelte other than .../node_modules/svelte:
     .../node_modules/svelte-compat/src/internal/shared/utils.js (in _app/immutable/nodes/2.CaQ5lNyh.js)
   ```
   Isolated: the same error naming `.bun/svelte@5.50.0/node_modules/svelte/...` against
   `.bun/svelte@5.59.2/node_modules/svelte`.

Probes 1 (with `resolveId` short-circuited) and 2 now fail with the same new message, naming the
bundled copy's `src/escaping.js` and `src/constants.js`, in both layouts. Limit: the check reads
bundled modules only. A second Svelte the server build leaves external (the aliased package in
probe 3 is external in `ssr`) is not reported there; the client check catches probe 3.

The guard differs from the demo's in three ways. It finds gpuix-svelte through `@retirement/ui`'s
resolution, not `./node_modules`, because `apps/web` does not depend on gpuix-svelte and Bun hoists
it. It checks every `svelte` import, not only those from inside gpuix-svelte. And it checks the
emitted chunks.

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
edits were reverted. A TS error added to `app.ts` was caught by the same command, so the demo's
separate `tsc` pass is not needed for that.

Markup-only components (no `<script lang="ts">`) need `checkJs`, which review found missing on
desktop. A temporary `packages/ui/src/MarkupProbe.svelte` containing only
`<div title="probe">markup only</div>` passed `desktop#check` with 0 errors. With `"checkJs": true` in
the desktop tsconfig:

```
Error: Object literal may only specify known properties, and '"title"' does not exist in type 'GpuixAttributes'. (js)
svelte-check found 1 error and 0 warnings in 1 file
```

The web check already had `checkJs` through Kit's generated tsconfig. The same file with
`<div testid="probe">` fails `web#check` (`'"testid"' does not exist in type 'HTMLProps<"div", ...>'`)
and passes desktop. Probe removed. Without it both checks report 0 errors, and `vp check` passes.
The `desktop#check` cache does notice shared files: adding one under `packages/ui/src` gave
`cache miss: 'TsProbe.svelte' added in 'packages/ui/src'`.

Not caught on desktop: DOM globals in shared code. See the limit under criterion 2.

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

Limit on desktop: only `.svelte` edits hot-reload. `.ts` and `.svelte.ts` modules load once per
process, in `apps/desktop/src` and `packages/ui/src` alike, so the window keeps their old code until
it restarts. gpuix's `render_hot` prints a notice for its own directory. Review found the shared
watcher printed nothing. Probe: a temporary `packages/ui/src/probe-label.ts` returning the label,
used by `BalanceSummary.svelte`, driven through the automation API:

```
before fix (committed app.ts):
before:                  Balance after 30 years | $432,194 | Running on desktop
edited packages/ui/src/probe-label.ts            (no notice)
after helper edit:       Balance after 30 years | ...
[gpuix-svelte] remount complete                  (after a .svelte edit)
after component remount: Balance after 30 years | ...   (still the old helper)
```

After the fix, through `vp run desktop#dev`, editing the shared helper, an app-local `.ts`, a new
shared `.svelte.ts` and then a shared component:

```
[gpuix-svelte] mount complete
[desktop] packages/ui/src/probe-label.ts changed — modules load once per process, restart to pick it up
[gpuix-svelte] platform.ts changed — modules load once per process, restart to pick it up
[desktop] packages/ui/src/probe-state.svelte.ts changed — modules load once per process, restart to pick it up
[gpuix-svelte] remount complete
```

A fresh launch then showed `Helper edited, balance after 30 years`. The first run also printed a
notice for `.!92984!probe-label.ts`, the temporary file `sed -i` writes through, so the watcher now
skips dotfiles. Probe files reverted.

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
   - Review fix: the same watcher prints render_hot's restart notice for shared `.ts`/`.js` edits
     (`.svelte.ts` included), once per file, and skips dotfiles. gpuix's `on_change` that decides this
     for render_hot is not exported, so `app.ts` mirrors its rule.
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
6. Kit runtime dependencies per app (review fix). See "Install layout" below.
7. Desktop type resolution (review fix): `paths` listing the bundled package's typed `exports`,
   `typeRoots`, and `src/gpuix-html.d.ts`. See criterion 2.

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
on `Snippet`. The first fix deleted the `"webapp-legacy/svelte"` entry from `bun.lock` by hand. The
review round replaced that with a declaration: legacy's `svelte` range is now `^5.59.2`, the version it
already resolved. Test in a scratch copy, with the old 5.50.0 entry planted back into `bun.lock`:
with `^5.59.2`, `bun install` dropped the entry and nothing nested; with the old `^5.49.2`, the entry
survived and `apps/webapp-legacy/node_modules/svelte` came back at 5.50.0. Legacy source is unchanged.

#### Kit runtime dependencies (review fix)

The first version broke `vp run --no-cache 'webapp-legacy#build'`, which passes on `gpuix-port`:

```
import { parse as parse$1, serialize } from "cookie";
SyntaxError: The requested module 'cookie' does not provide an export named 'parse'
    at async prerender (.../apps/webapp-legacy/node_modules/@sveltejs/kit/src/core/postbuild/prerender.js:56:21)
```

Cause: Vite bundles Kit's server runtime into each app's server output but leaves Kit's dependencies
as bare imports. Node, and adapter-vercel's file tracing, resolve those from the app's directory, not
Kit's. Kit's own nested copies (`apps/webapp-legacy/node_modules/@sveltejs/kit/node_modules/cookie` at
0.6.0) were on disk but unreachable from the output. The app reached the root copies instead.

What each Kit declares, read from the installed `package.json` files:

| Dependency        | Kit 2.70.4 | Kit 3.4.1 | Root copy before | Bare import in the emitted server          |
| ----------------- | ---------- | --------- | ---------------- | ------------------------------------------ |
| cookie            | ^0.6.0     | ^2.0.1    | 2.0.2            | yes, both apps, both layouts               |
| devalue           | ^5.8.1     | ^5.9.4    | 6.0.4 (svelte's) | yes, both apps, both layouts               |
| magic-string      | ^0.30.5    | ^1.2.3    | 1.4.5            | no, build time only (Kit's own dir)        |
| set-cookie-parser | ^3.0.0     | (none)    | 3.x, matches     | legacy, hoisted only (isolated inlines it) |
| esm-env           | ^1.2.2     | ^1.2.2    | matches          | no, inlined                                |

The last column comes from scanning `.svelte-kit/output/server` with `Bun.Transpiler#scanImports`
after a build in hoisted and isolated scratch copies. Round 1 read it from Kit's source instead.

The root `devalue` 6.0.4 was Svelte 5.59.2's (`^6.0.4`). Devalue 6 changed the `uneval` replacer:
v5 calls `replacer(value, uneval)` and takes a string, v6 calls `replacer(value, js)` and takes a
`JavaScriptSource`. Kit 2 and Kit 3 both return strings for streamed promises. So the new web app was
broken too, which the review did not flag. A probe route returning `{ slow: Promise<{ when: Date, label }> }`
served from `apps/web`'s production output (`vp preview`) rendered `<p>Internal Error</p>`, logging
`TypeError: Cannot read properties of undefined (reading 'slice')`. `__data.json` (the `stringify`
path) was fine.

The web server output bundles both Kit's runtime and Svelte's server runtime, and both import bare
`devalue`. A single bare specifier cannot serve two majors. Svelte 5.59.2 handles this in
`src/internal/server/hydratable.js`: "A user may still be using SvelteKit 2/3 which may resolve to
devalue v5", and it falls back to a string placeholder. So devalue 5 at the app level is correct for
both.

Fix: each app declares the dependencies whose hoisted copy is wrong for its Kit, with Kit's own
ranges. Legacy gets `cookie ^0.6.0` and `devalue ^5.8.1`, web gets `cookie ^2.0.1` and `devalue ^5.9.4`
(cookie already matched for web; declaring it keeps it right if hoisting changes). Bun then hoisted
`devalue` 5.9.4 to the root and nested Svelte's 6.0.4 under `node_modules/svelte/node_modules`.
Alternatives rejected: Bun `overrides` are workspace-wide and cannot split per app.
`ssr.noExternal` for `cookie`/`devalue` would resolve them from Kit's directory, but needs a change to
legacy's `vite.config.ts`, and an exact pin here would rot on the next Kit bump.

Against that rot, `scripts/check-kit-deps.ts` runs in `vp run check`, uncached, after `vp check`.
For every app depending on Kit, it resolves `cookie` and `devalue` from the app's directory the way
Node does, and fails unless the package found is named `cookie`/`devalue` and its installed version
satisfies the range the app's Kit declares (`Bun.semver.satisfies`). A missing package fails too.
It reports the range to declare. Clean run:

```
webapp-legacy: Kit 2.70.4, cookie 0.6.0, devalue 5.9.4
web: Kit 3.4.1, cookie 2.0.2, devalue 5.9.4
```

Round 1's version walked Kit's runtime source for imports and compared the app's resolved directory
with Kit's. Round 2 found it wrong both ways, and these probes, run in scratch copies, now behave:

| Probe                                                            | Round 1                                | Now                                        |
| ---------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| root `overrides` `"devalue": "6.0.4"`, hoisted install           | exit 0                                 | exit 1, both apps: would load 6.0.4        |
| copy of root devalue 5.9.4 into `apps/web/node_modules`          | exit 1, 5.9.4 vs 5.9.4                 | exit 0                                     |
| root `devalue` moved aside                                       | exit 0                                 | exit 1, both apps: would load nothing      |
| root `devalue` replaced by a copy of `cookie` (a stand-in alias) | (not run)                              | exit 1, both apps: would load cookie 2.0.2 |
| fresh `bun install --frozen-lockfile --linker isolated`          | exit 1, `esm-env`, `set-cookie-parser` | exit 0                                     |

`set-cookie-parser` is a bare import in legacy's hoisted output and is not checked. Kit 2 is the only
Kit using it, the root copy satisfies its range, and legacy is deleted at parity.

Evidence after the fix:

- `vp run --no-cache 'webapp-legacy#build'`: `vp run: 3/3 successful`.
- `vp run --no-cache 'web#build'`: `✔ done`.
- The streaming probe route, added temporarily to both apps and served from each production build
  with `vp preview`, streams `__sveltekit_*.resolve(1, () => [{when:new Date(0),label:"streamed-value-ok"}])`.
  In headless Chromium both pages render `streamed-value-ok 1970-01-01T00:00:00.000Z` with 0 page
  errors. Probe removed.
- `vp run webapp-legacy#check`: 0 errors, 46 warnings, the same as the baseline.

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
- `.ts` and `.svelte.ts` edits under `apps/desktop/src` or `packages/ui/src` need a window restart. The log
  says so: `[gpuix-svelte] ...` for the app's own files, `[desktop] packages/ui/src/...` for shared ones.
- When Kit is upgraded in either app, run `vp run check`. `scripts/check-kit-deps.ts` says which
  dependency the app must declare, with which range.
- The desktop check does not reject DOM globals (`document`, `window`) in shared code. See the limit
  under criterion 2. Review shared code for them by hand until that is closed.
- The registry svelte 5.59.2 also exports `./renderer` and `push_renderer` now. gpuix-svelte's `main`
  (#87, "run on Svelte 5.59 from npm instead of a bundled build") is unreleased. When we upgrade past 0.6.0,
  the bundled copy may disappear. The desktop `paths` and `typeRoots`, `src/gpuix-html.d.ts`, the
  `one-svelte` guard and the WRONG_SVELTE check will need another look then.
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
