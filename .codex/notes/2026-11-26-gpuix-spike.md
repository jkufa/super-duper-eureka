# gpuix spike (spec 2)

Spec: `implementation/gpuix-port/02-gpuix-spike-spec.md`. Branches: `feat/gpuix-spike-wiring` (Q1, merged
into `gpuix-port`), then `feat/gpuix-spike-questions` (Q2 to Q6), cut from `gpuix-port`.

## Summary

| Question             | Result                  | One line                                                                                               |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Q1. Workspace wiring | pass                    | Two apps plus `packages/ui` work; see Q1 below                                                         |
| Q2. Server rendering | pass (preview deferred) | Kit 3.4.1 on adapter-vercel serves the shared card from a server load, tokens in head, no mismatch     |
| Q3. Text input       | pass, one workaround    | Draft, blur, Enter, Up/Down, empty-to-fallback on both; GPUI fires `blur`; click-away needed a wrapper |
| Q4. Chart            | pass, all seven rows    | No degradation needed; one paint layer per platform, the rest shared                                   |
| Q5. Desktop plumbing | pass                    | Clipboard through `pbcopy`, JSON in `~/Library/Application Support/com.retirement.desktop`             |
| Q6. Packaged build   | pass                    | Unsigned `Retirement Calculator.app`, 108.5 MB, launches and draws its window                          |

Every desktop input in Q3 and Q4 was GPUI's own simulated input (gpuix's automation API), not OS
events. A real OS route (CGEvent) was tried once and is denied on this machine. See "Real input" under
Q3. Nothing in those rows was verified by a person typing or moving a mouse.

## Go or no-go input

Facts for the owner's call. This note makes no call.

- Passed with evidence: Q1, Q2 (local adapter-vercel production build standing in for the preview),
  Q3 on both targets, every Q4 row on both targets, Q5, Q6.
- Degraded: nothing. No Q4 fallback was applied. No feature was dropped.
- Workarounds kept in our code: Q3's click-away commit on GPUI (a `mousedownoutside` listener on the
  field's wrapper that calls gpuix's `blur()`). Q5's clipboard goes through macOS `pbcopy` because
  gpuix-svelte 0.6.0 has no clipboard API, so Windows and Linux would need their own command.
- Unproven:
  - Desktop input by a real user. Typing, Tab, Enter, arrows, clicks and pointer moves went through
    GPUI's in-process simulation (`simulateKeystrokes`, `simulateMouseMove`, `simulateClick`). macOS
    Accessibility and event posting are not granted to this session, so CGEvent input was dropped.
  - The Vercel preview deployment (owner decision: deferred to spec 5).
  - Chart pointer mapping after the chart's box moves without changing size (scrolling, window
    move). `onlayout` reports size changes only (gpuix docs), and the spike's chart sits outside any
    scroll container. Not tested.
  - Chart behaviour on a window resize. The spike never resized the window.
  - Running from Finder by double-click: `open` was used, which goes through LaunchServices the same
    way, but no person clicked it.

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

Result: pass. The Vercel preview deployment is not part of the spike (owner decision, spec 2 amended):
a local `adapter-vercel` production build served by `vp preview` stands in for it, and the real
preview moves to spec 5.

Kit version: **3.4.1** with `@sveltejs/adapter-vercel` 7.0.5. The Kit 2.70 fallback was not needed.

Code: `apps/web/src/routes/+page.server.ts` (load), `+page.svelte`, `+layout.svelte` (`theme_rule` in
`<svelte:head>`), `apps/web/src/app.html` (the base CSS a GPUI window gives for free),
`packages/ui/src/ScenarioCard.svelte` (kit `Card`, `TextField`, `Button`).

Driver: a scratch Playwright script (headless Chromium from `apps/e2e`'s Playwright) run against the
production build (`vp run --no-cache 'web#build'`, then `vp preview --port 4181` in `apps/web`) and
the dev server (`vp dev --port 5181`). Not committed; what it does is shown inline.

**1. A route with a `+page.server.ts` load renders a shared component that uses the kit's Button, TextField and Card: pass.**

The load returns `scenario: { name: 'Server scenario', startingBalance: 250_000, source: 'the server load' }`.
`curl -s http://127.0.0.1:4181/` (production build), grepped:

```
Loaded by the server load            (Card description)
Scenario name                        (TextField label)
value="Server scenario"              (TextField's input)
Server scenario: $250,000            (shared markup)
Add $1,000                           (Button)
Running on web | Committed: 5% (0 commits) | Measuring…
```

**2. The server HTML contains the rendered component and the `--ui-*` tokens, using the kit's `theme_rule` in `<svelte:head>`: pass.**

```
:root{--ui-bg:#000000;--ui-panel:#111111;--ui-raised:#1c1c1c;--ui-raised-hover:#262626;--ui-border:#242424;--ui-border-strong:#404040;...
style in head: True     (the rule's index is before </head>)
```

In the browser, `getComputedStyle(documentElement).getPropertyValue('--ui-accent')` is `#ff3e00`.

**3. The page hydrates with no mismatch warning: pass.**

Production build:

```
[prod] streamed: streamed-ok 2026-01-01T00:00:00.000Z
[prod] summary before click: Server scenario: $250,000
[prod] summary after Add click: Server scenario: $251,000      (handlers attached: hydrated)
[prod] summary after typing name: Renamed: $251,000
[prod] page errors: none
[prod] console (non-debug): none
```

Svelte reports hydration problems only in dev builds, so the same script ran against `vp dev`:
`page errors: none`, `console (non-debug): none` (the only console lines were `[vite] connecting...`,
`[vite] connected.` and the spike's own `debug` traces).

Negative probe, to show the capture would see a warning: a temporary
`{@html typeof window === 'undefined' ? '<b>server</b>' : '<i>client</i>'}` in `+page.svelte` gave

```
warning: [svelte] hydration_html_changed The value of an `{@html ...}` block near src/routes/+page.svelte:30:5 changed between server and client renders...
```

A server/client `{#if}` branch mismatch produced no warning (Svelte 5 repairs that silently). Probe
reverted.

Screenshot: `.codex/notes/assets/gpuix-spike/q2-web-hydrated.png` (after the click and the rename).

**4. Streamed promise with a `Date` (owner addition, the path a devalue mismatch broke in Q1): pass.**

The load also returns `streamed`, a top-level promise resolving after 300 ms to
`{ when: new Date(Date.UTC(2026, 0, 1)), label: 'streamed-ok' }`. Server HTML from the production
build:

```
Streaming…
__sveltekit_qkfqj8.resolve(1, () => [{when:new Date(1767225600000),label:"streamed-ok"}])
```

The page then shows `streamed-ok 2026-01-01T00:00:00.000Z` (`value.when.toISOString()` ran on a real
`Date`), with 0 page errors, in both the production build and dev.

**5. A Vercel preview deployment serves it: deferred to spec 5 (owner decision).** Not attempted.

## Q3. Text input

Result: pass on both targets, with one workaround on GPUI (click-away). All desktop input below is
GPUI's simulated input through gpuix's automation API, not OS events (see "Real input").

Code: `packages/ui/src/NumberField.svelte` and `packages/ui/src/number-field.ts`. The field keeps a
`draft` string (`$derived` from the committed value, overwritten by typing). It never calls `bind:`.
The handlers are spread per renderer, as the kit's `TextField` does: GPUI gets `onchange` (every
edit, `e.value`), `onsubmit` (Enter), `onfocus`, `onblur`, `onkeydown` and a `theme` object; the DOM
gets `oninput`, `onblur` and `onkeydown`. Keys are read through the kit's `key_of`, so both see
`up`, `down` and `enter`. `App.svelte` shows `Committed: <value>% (<n> commits)`, which changes only
through `oncommit`. Each handler reports to `platform.trace` (`[spike] ...` on desktop stderr, the
browser console on the web).

### What gpuix's automation API can do (gpuix-svelte 0.6.0, `@gpuix/native` 0.11.0)

Read from `gpuix-svelte/lib/automation-server.js` and `@gpuix/native/dist/automation/client.{js,d.ts}`,
then used:

| Input                        | Call                                                 | Goes through                                                   | Used for   |
| ---------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- | ---------- |
| Typing, Enter, Tab, arrows   | `keystrokes` (`Locator.fill`/`press`, or no element) | GPUI's `simulateKeystrokes` to the focused element             | Q3, Q4, Q5 |
| Key down / up                | `keyDown`, `keyUp`                                   | `simulateKeyDown/Up`                                           | not needed |
| Click                        | `click` / `Locator.click` / `mouse.click`            | `simulateClick` at window coordinates, GPUI's real hit testing | Q3, Q4, Q5 |
| Pointer move with x, y       | `mouseMove` / `mouse.move({x, y})`                   | `simulateMouseMove`                                            | Q4         |
| Mouse down / up, drag, wheel | `mouseDown`, `mouseUp`, `mouse.drag`, `scrollWheel`  | `simulate*`                                                    | not needed |
| Focus change / blur          | `focus` (element id), `blur`                         | `focusElement`, `blur` (hands focus back to the window)        | Q3         |
| Reads                        | `getTree`, `getAllText`, `getBounds`, `screenshot`   | the live window's tree, bounds and Metal renderer              | everywhere |

It cannot read an `<input>`'s current text: the tree node for the field is
`{"id":45,"type":"input","testId":"rate-input","bounds":{...}}` with no value. The draft is therefore
shown by the `[spike] numberfield:draft` trace (the `change` event's `e.value`) and by screenshots.

### Real input

One attempt at OS-level input, against the window's real process (the `bun` child of the launcher), with
a Swift script posting `CGEvent`s (mouse move and click over the chart, then Right arrow) to
`.cghidEventTap`:

```
AXIsProcessTrusted: false
CGPreflightPostEventAccess: false
window bounds: ["Y": 109.0, "Height": 929.0, "X": 264.0, "Width": 1200.0]
posted move+click at 825.1333333333333 537.0 and Right arrow
[driver] readout before: 2055: $1,080,486
[driver] readout after OS events: 2055: $1,080,486
```

macOS dropped the events (no Accessibility or event-posting permission for this session; Q1 found
System Events via `osascript` times out too). So no Q3 or Q4 criterion was exercised by real OS input.
What was exercised is GPUI's own input path inside the window process: GPUI's keystroke dispatch,
focus handling and hit testing, then gpuix's event mapping and our handlers. The OS → GPUI part
(NSEvent delivery, IME) is not covered.

### Criteria

Desktop log: launched with `launch({ entry: 'app.ts', bun: true, cwd: 'apps/desktop' })`, the same
launcher as `vp run desktop#dev`. `[driver]` lines are the driver reading the window, `[spike]` lines
the app's own traces.

**1. Typing edits a draft string and does not change the committed value: pass on both** (desktop by
simulated input).

```
[driver] Q3 start: null | Committed: 5% (0 commits)
[spike] numberfield:draft {"type":"change","draft":"7"}
[spike] numberfield:draft {"type":"change","draft":"7."}
[spike] numberfield:draft {"type":"change","draft":"7.2"}
[spike] numberfield:draft {"type":"change","draft":"7.25"}
[driver] Q3 typed 7.25: null | Committed: 5% (0 commits)
```

`q3-desktop-typed-draft.png`: the field shows `7.25` with the caret, the line under it
`Committed: 5% (0 commits)`. Web: `[prod] Q3 typed 7.25: 7.25 | Committed: 5% (0 commits)`.

**2. Blur commits the parsed number. Enter commits too: pass on both** (desktop by simulated input).

Which event gpuix fires on blur: **`blur`**, delivered to the `<input>`'s `onblur` with
`e.type === "blur"`. It fired on Tab and on gpuix's `blur()`.

```
[spike] numberfield:keydown {"key":"tab"}
[spike] numberfield:blur {"type":"blur"}
[spike] numberfield:commit {"source":"blur","draft":"7.25","next":7.25}
[driver] Q3 after tab: null | Committed: 7.25% (1 commits)
...
[spike] numberfield:blur {"type":"blur"}
[spike] numberfield:commit {"source":"blur","draft":"6","next":6}
[driver] Q3 typed 6 then automation blur(): null | Committed: 6% (3 commits)
[spike] numberfield:commit {"source":"enter","draft":"8","next":8}
[driver] Q3 typed 8 + enter: null | Committed: 8% (4 commits)
```

GPUI's input reports Enter as `submit`, not as a `keydown` the element sees, so the GPUI branch
commits from `onsubmit`.

Click-away on GPUI (workaround, see below): clicking plain text outside the field does not blur a
GPUI text field, where a browser does. Before the workaround:

```
[spike] numberfield:draft {"type":"change","draft":"8"}
[driver] Q3 typed 8: null | Committed: 7.25% (1 commits)
[driver] Q3 after click on plain text elsewhere: null | Committed: 7.25% (1 commits)   (no blur, no commit)
```

After:

```
[spike] numberfield:mousedownoutside {"type":"mouseDownOutside"}
[spike] numberfield:blur {"type":"blur"}
[spike] numberfield:commit {"source":"blur","draft":"8","next":8}
[driver] Q3 after click on plain text elsewhere: null | Committed: 8% (2 commits)
```

Web: `after Tab (blur): 7.25 | Committed: 7.25% (1 commits)`, `after Enter: 8 | Committed: 8% (2 commits)`,
`after click elsewhere (blur): 5 | Committed: 5% (6 commits)`; the DOM fires `blur` (`{"type":"blur"}`).

**3. Up and Down arrows step the value and commit: pass on both** (desktop by simulated input).

The element's own `onkeydown` receives `up` and `down` on GPUI; the input's built-in arrow bindings
did not swallow them. Step 0.5:

```
[spike] numberfield:keydown {"key":"up"}
[spike] numberfield:step {"direction":1,"draft":"8","next":8.5}
[driver] Q3 up: null | Committed: 8.5% (5 commits)
[spike] numberfield:step {"direction":-1,"draft":"8.5","next":8}
[spike] numberfield:step {"direction":-1,"draft":"8","next":7.5}
[driver] Q3 down x2: null | Committed: 7.5% (7 commits)
```

Web: `after ArrowUp: 8.5 | Committed: 8.5% (3 commits)`, `after ArrowDown x2: 7.5 | Committed: 7.5% (5 commits)`.

**4. An empty field commits its fallback value: pass on both** (desktop by simulated input). Fallback 5.

```
[spike] numberfield:draft {"type":"change","draft":""}
[driver] Q3 emptied: null | Committed: 7.5% (7 commits)
[spike] numberfield:commit {"source":"enter","draft":"","next":5}
[driver] Q3 empty + enter: null | Committed: 5% (8 commits)
[spike] numberfield:commit {"source":"blur","draft":"","next":5}
[driver] Q3 empty + tab: null | Committed: 5% (9 commits)
```

`q3-desktop-after-commits.png`: field `5`, `Committed: 5% (9 commits)`; the Tab moved focus to the
next field (Note), whose border shows it. Web: `emptied: "" | Committed: 7.5%`, then on blur
`5 | Committed: 5% (6 commits)`. Not a number (`abc` + Enter) keeps the previous value on the web
(`5 | Committed: 5% (7 commits)`).

The controlled value round-trips on GPUI: after each commit the field shows the formatted committed
value (`5` in the screenshot after the empty commit), so writing `value` back to GPUI's input works.

### Workaround attempts (click-away commit on GPUI)

1. `onmousedownoutside` on the `<input>` itself, calling gpuix's `blur()` when focused. No effect:
   no `mousedownoutside` trace. GPUI's input does not report that event.
2. The same listener on the field's wrapper `<div>` (spread only on GPUI). Works, log above. On the
   web the wrapper gets no extra handler; the browser blurs by itself.

## Q4. Chart

Result: every row passes on both targets. No fallback applied.

Code: `packages/ui/src/chart-geometry.ts` (copied unchanged from `reference/chart-geometry.ts`, with
`d3-scale` and `d3-shape` added to `@retirement/ui`), `packages/ui/src/ProjectionChart.svelte` (size,
selected year, pointer and keys, marker, x labels, tooltip, all shared), `packages/ui/src/chart-paint.ts`
(the paint layer's props and colours), and one paint layer per app passed in through
`platform.ChartPaint`: `apps/desktop/src/ChartPaint.svelte` (GPUI `<svg source>` masks) and
`apps/web/src/lib/ChartPaint.svelte` (one DOM `<svg>`). Data: `projection-points.ts`, 30 years from
`@retirement/calculator` at the committed rate with ±1% variance lines.

Desktop evidence is simulated input as in Q3. Pixel samples come from a scratch Python PNG decoder
reading the screenshots (desktop captures are 2x).

| Check                                 | Result                 | Evidence                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime-generated SVG mask per colour | pass (desktop and web) | Five `<svg source=...>` layers generated from the geometry each render (grid, area, +1%, -1%, balance), each tinted by `style:color`. `getByTestId('chart-box').getByType('svg').count()` → `5`. All three series visible in `q4-desktop-hover-2036.png`.                                                                                                                            |
| Dashed strokes inside a mask          | pass                   | `stroke-dasharray="6 4"` in the mask source. Columns with a green (+1%) pixel across the left 40% of the plot, device px: `off17 on11 off8 on12 off7 on12 off7 ...` (31 gaps), about 6/4 logical px along a shallow slope. Web: `on6 off4 ...` (29 gaps).                                                                                                                            |
| Translucent fills                     | pass                   | The area layer's colour is `var(--ui-accent-wash)` = `#ff3e0029` (16% alpha). Pixel inside the area, window (983, 836): `(41, 10, 0)`; expected #ff3e00 × 0x29/255 over black = `(41, 10, 0)`. Black above the lines: `(0, 0, 0)`. Web: same `(41, 10, 0)`.                                                                                                                          |
| Plot size                             | pass                   | `onlayout` on the chart box: `[spike] chart:layout {"x":404,"y":54.5,"width":772,"height":822.5}`, equal to automation's `getElementBounds`: `{"x":404,"y":54.5,"width":772,"height":822.5}`. Web: ResizeObserver, `{"width":772,"height":721.36}`.                                                                                                                                  |
| Pointer to year                       | pass                   | `onmousemove`'s `e.x` is window x. Year = `columnIndexAtX(geometry, e.x - left)`, `left` from `onlayout`'s `e.x`. `mouse.move` to x = 436.5 / 685.8 / 1159.5 → `2026`, `2036`, `2055` (indexes 0, 10, 29); the trace shows the event's x, e.g. `mousemove x=685.7999877929688 ... "label":"2036"`. Web: same three years from `clientX` minus the box's `getBoundingClientRect().x`. |
| Hover tooltip                         | pass                   | A box with absolute `left`/`top` inside the chart box, at the column's x + 12 (flipped left near the edge). Bounds per move: x 448.5 (column 436.5), 698 (685.8), 997.5 (flipped at 1159.5). `q4-desktop-hover-2036.png`, `q4-web-hover-2036.png`. `Popover` was not needed.                                                                                                         |
| Keyboard                              | pass                   | Click at index 15 focuses the box (`tabindex="0"`, `role="slider"`) → `2041`; `right` → `2042`; `left left` → `2040`, sent with no target element, so they went to the focused box. `q4-desktop-keyboard.png`, `q4-web-keyboard.png`.                                                                                                                                                |

Limit (not tested): `onlayout` fires on size changes only, so if the box moved without resizing
(inside a scrolled container), `left` would go stale. The kit's `bounds_of(node)` reads the painted
box on demand on GPUI and is the likely fix; the web path already reads the box at each event.

## Q5. Desktop plumbing

Result: pass. Code: `apps/desktop/src/platform.ts` (`clipboard` and `store` adapters),
`packages/ui/src/PlumbingCard.svelte` (shown only when the platform passes both adapters; the web
passes neither in the spike).

- gpuix-svelte 0.6.0 and `@gpuix/native` 0.11.0 have no clipboard call (no match for `clipboard` in
  their `lib`, `dist` or the native binary's strings). The window runs in Bun, so the adapter pipes
  the text to macOS's `pbcopy` with `execFile`. Windows and Linux would need their own command.
- App data: `~/Library/Application Support/com.retirement.desktop/spike-state.json`, named after the
  bundle identifier the Q6 build uses. `node:fs/promises`, parsed back into `{ note, savedAt }`.

Two separate processes, driven through the automation API (simulated clicks and typing):

```
clipboard before: 0 bytes
[driver run 1] window process pid (launcher): 63417
[driver run 1] On launch: nothing saved yet
[driver run 1] saved {"note":"spike-q5-note","savedAt":"2026-11-26T11:44:22.630Z"}
[driver run 1] copied "Projected at 5%: 1080486"
--- pbpaste after run 1:
Projected at 5%: 1080486
--- file after run 1 (process exited):
-rw-r--r--@ 1 jkufa  staff  71 Nov 26 06:44 /Users/jkufa/Library/Application Support/com.retirement.desktop/spike-state.json
{
  "note": "spike-q5-note",
  "savedAt": "2026-11-26T11:44:22.630Z"
}
--- processes between runs:
none
--- run 2 (new process)
[driver run 2] window process pid (launcher): 63491
[driver run 2] On launch: {"note":"spike-q5-note","savedAt":"2026-11-26T11:44:22.630Z"}
clipboard restored: 0 bytes
```

- Copy to clipboard: pass. Read back with `pbpaste`.
- Write, restart, read back: pass. Run 2 is a new process (new pid, none running between); it read
  the file at mount. Screenshots: `q5-desktop-run1-saved.png`, `q5-desktop-run2-read-back.png`.
- Clean-up: the clipboard held no text before; `pbcopy` put back the empty string (non-text clipboard
  content would not survive this). The app-data folder was deleted afterwards.

## Q6. Packaged build

Result: pass. `apps/desktop/standalone.ts` (a static `render()` with `app: { name, identifier }`, as
`gpuix-svelte/build` requires) and `apps/desktop/build.ts`, run by the new task
`vp run desktop#package` (`bun build.ts`, uncached). It is not named `build`, so `vp run build` does
not package the app every time. Output goes to `apps/desktop/dist`, which the root `.gitignore`
already ignores (`git check-ignore -v` → `.gitignore:6:dist`).

```
$ vp run --no-cache desktop#package        (Bun 1.4.5)
[gpuix-svelte/build] dist/Retirement Calculator.app (108.5 MB) — Retirement Calculator 0.0.0, com.retirement.desktop, default icon
[gpuix-svelte/build] CODESIGN_IDENTITY not set; leaving the .app unsigned
```

Size: **108.5 MB** as the build reports it (`du -sh` 109M; the executable is 113,812,482 bytes).
Inside the docs' 110 to 155 MB range, at its low end. Signing: `codesign -dv` shows only the linker's
ad-hoc signature (`flags=0x20002(adhoc,linker-signed)`, `Signature=adhoc`), no identity.

Launch:

```
$ open 'dist/Retirement Calculator.app'
$ pgrep -fl retirement-calculator
63804 .../apps/desktop/dist/Retirement Calculator.app/Contents/MacOS/retirement-calculator
$ ps   (PPID 1: started by LaunchServices)
63804     1 253792   00:05 .../Retirement Calculator.app/Contents/MacOS/retirement-calculator
$ CGWindowList for pid 63804
window 5534 owner Retirement Calculator layer 0 bounds { Height = 929; Width = 1200; X = 264; Y = 109; } onscreen 1
$ timeout 8 '.../Contents/MacOS/retirement-calculator'    (from a shell, for the log)
[gpuix-svelte] created native window
[gpuix-svelte] mount complete
[spike] chart:layout {"x":404,"y":54.5,"width":772,"height":822.5}
```

The last line is the shared chart's `onlayout` from inside the packaged binary, so the shared
components mounted and laid out there. No screenshot: the build compiles the automation server out
(`gpuix-svelte/lib/build.js` defines `process.env.GPUIX_AUTOMATION` as `""`), a piped `initialize`
got no reply, and `screencapture` is denied (Q1). The app was stopped after each launch.

The app was built locally; macOS's Gatekeeper prompt for downloaded unsigned apps did not apply
(no quarantine attribute) and was not tested.

## gpuix warnings across the spike (Q1 to Q6)

None. Every `[gpuix-svelte]` line in every desktop run, the packaged binary included, was
`created native window`, `mount complete` or (Q1) `remount complete`. The build printed its size line
and `CODESIGN_IDENTITY not set; leaving the .app unsigned`, which is information, not a warning. No
compile warnings from gpuix's `.svelte` loader for the new shared components.

## Versions (Q2 to Q6)

As in Q1's table, plus: d3-scale 4.0.2, d3-shape 3.2.0, @types/d3-scale 4.0.9, @types/d3-shape 3.2.0
(in `@retirement/ui`); Playwright's Chromium from `apps/e2e` for the web runs; Swift from the
Xcode command line tools for the CGEvent and window-list scripts.

## Things a later agent needs to know (Q2 to Q6)

- Desktop automation reads no input values. Trace the `change` event or show the value in the UI.
- A gpuix text field keeps focus when the pointer goes down on non-focusable content. Forms that
  commit on blur need the wrapper `mousedownoutside` pattern from `NumberField.svelte`.
- GPUI's `<input>` reports Enter as `submit`, not as a `keydown` its own handler sees.
- `launch()` resolves `app.screenshot({ path })` against the app's cwd: pass an absolute path.
- `pkill -f 'vp dev'` leaves the Vite child running. Stop servers by the port's listener
  (`lsof -tnP -iTCP:<port> -sTCP:LISTEN`).
- The packaged binary has no automation server. Drive `app.ts` through `launch()` instead.
- `vp check` rejects an explicit `unknown` binding with an initialiser and a broad `object` param;
  `{@attach}` callbacks shared between renderers take `node: unknown`.
