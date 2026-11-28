# Code review log

For PR review agents only. Orchestration and implementation agents do not read this file.

## How to use it

1. After each review, add one entry per code smell or implementer habit you found. Skip one-off typos and anything the lint task already catches.
2. Before adding an entry, search this file for the same problem.
3. If it has happened before, add a guideline to "Lessons From Review" in `AGENTS.md`, phrased as an instruction, and set `Promoted` to yes on every matching entry here.

## Entry format

```
### YYYY-MM-DD, spec N, short name of the problem
- Where: file paths or PR
- What: what the implementer did
- Better: what they should do
- Seen before: no, or the dates of earlier entries
- Promoted: no, or yes with the AGENTS.md bullet
```

## Entries

### 2026-11-26, spec 1, build cache omits a build-time environment variable

- Where: `apps/webapp-legacy/vite.config.ts` (431835c)
- What: The legacy build substitutes `MOCK_REAL_DATA` at compile time, but changes to the variable leave the Vite Task cache warm.
- Better: Declare compile-time environment variables as cache inputs and verify that changing a value triggers a fresh build.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 1, cached generator omits required artifacts

- Where: `apps/webapp-legacy/vite.config.ts` (b2a73a2)
- What: A cached SvelteKit sync can replay success without restoring the generated tsconfig that the next command requires.
- Better: Restore the generator's outputs on a hit or execute the generator uncached.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 1, task migration leaves app setup instructions behind

- Where: `apps/webapp-legacy/README.md` (431835c)
- What: Removing the package scripts broke the app README's development and build commands. Its recreation command also installs the retired tools.
- Better: Check workspace-level setup instructions when removing scripts or replacing tooling.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, generated servers resolve another package's dependency major

- Where: `bun.lock`, PR #6
- What: Adding Kit 3 hoisted `cookie@2` and `devalue@6`. The legacy production server loads them from its output directory. Prerendering fails on the missing `cookie.parse` export. Fixing cookie alone still leaves Kit 2's streamed page data using an incompatible serializer.
- Better: Make compatible runtime dependencies resolvable from each generated app. Build both production targets from the lockfile and exercise the emitted servers when introducing another framework major.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, desktop type resolution falls through on Svelte subpaths

- Where: `apps/desktop/tsconfig.json`, PR #6
- What: The resolution probe checked the package root. Subpaths such as `svelte/reactivity` lack a matching file at the wildcard target, so TypeScript loads the registry declarations alongside the bundled declarations.
- Better: Resolve public subpaths to the type entries in the bundled package's exports. Verify both install layouts with a shared importer and an API that differs between versions.
- Seen before: no
- Promoted: yes, the desktop Svelte path mapping guideline in AGENTS.md

### 2026-11-26, spec 2, runtime guard checks import spelling

- Where: `apps/web/vite.config.ts`, PR #6
- What: The guard checks bare Svelte imports. A build probe imported the resolved gpuix runtime path and both the SSR and client bundles included two runtimes without an error.
- Better: Check the emitted chunks' module IDs against the app's Svelte package directory in both build environments.
- Seen before: no
- Promoted: yes, the emitted chunks and bundled runtime identity guidelines in AGENTS.md

### 2026-11-26, spec 2, desktop markup checks depend on a TypeScript script tag

- Where: `apps/desktop/tsconfig.json`, PR #6
- What: A shared component containing only a div with a DOM-only `title` attribute passed the GPUI check. The negative test in the spike used a component with a TypeScript script block.
- Better: Enable `checkJs` for the desktop check and test a markup-only component alongside a TypeScript component.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, shared module edits get no desktop restart notice

- Where: `apps/desktop/app.ts` and `AGENTS.md`, PR #6
- What: The shared watcher ignores TypeScript changes. Editing a shared helper leaves the running window on the old code, although the development instructions say the directory hot-reloads.
- Better: Document the file extensions that remount and give the same restart notice for shared module changes that gpuix gives for app-local ones.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, directory equality stands in for Kit version compatibility

- Where: `scripts/check-kit-deps.ts:117`, PR #6 second pass
- What: With a workspace override for `devalue@6.0.4`, the checker exits zero for both apps. The Kit 3 build succeeds and its streamed HTML request returns HTTP 500. A separate copy of the exact same compatible `devalue@5.9.4` produces the opposite result and tells the developer to add a dependency already declared.
- Reproduce in separate scratch copies at `5a8081e`. Add `"devalue": "6.0.4"` to the root `overrides`, run `bun install --linker hoisted` and `bun scripts/check-kit-deps.ts` (exit 0). Give a Kit 3 page a server load returning `{ slow: new Promise(resolve => setTimeout(() => resolve({ label: "ok", when: new Date(0) }), 80)) }` and render `slow` in an await block. Run `vp run --no-cache web#build`, serve with `vp preview` from `apps/web`, and GET the route as HTML. The build succeeds and the request returns 500. With the unmodified hoisted lockfile, `cp -R node_modules/devalue apps/web/node_modules/devalue` makes the checker reject 5.9.4 versus 5.9.4 (exit 1). Separately, renaming the root `node_modules/devalue` out of the way on the clean install makes both lookups return `undefined` and the checker passes (exit 0).
- Better: Require an installed version satisfying the owning Kit's declared range. Exercise both an incompatible shared copy and compatible separate copies.
- Seen before: no
- Promoted: yes, the dependency diagnostic guideline in AGENTS.md covers the redundant install advice

### 2026-11-26, spec 2, Kit source imports stand in for server externals

- Where: `scripts/check-kit-deps.ts:68`, PR #6 second pass
- What: On an isolated install the checker fails for `esm-env` in the new web app. The emitted server has no bare import of it. The production route builds, streams and hydrates without an app-level installation.
- Reproduce with a fresh `bun install --frozen-lockfile --linker isolated`, then `bun scripts/check-kit-deps.ts`. It reports three mismatches: `esm-env` for both apps and `set-cookie-parser` for legacy. Neither emitted server imports `esm-env`. Legacy's isolated `chunks/utils.js` includes the parser implementation, whereas the hoisted output imports it by name. For the isolated legacy chunks, run `MOCK_REAL_DATA=true vp build` from `apps/webapp-legacy`; it emits the chunks before failing to resolve `zod`. The full isolated legacy build task stops earlier in the logger package on missing Node types.
- Better: Scope a fast pre-build check to known external dependencies such as `cookie` and `devalue`. Use emitted server imports if the check needs to discover more dependencies automatically.
- Seen before: 2026-11-26, spec 2, runtime guard checks import spelling
- Promoted: yes, the emitted chunks guideline in AGENTS.md

### 2026-11-26, spec 2, desktop Svelte wildcard maps a JSON export to declarations

- Where: `apps/desktop/tsconfig.json:50`, PR #6 second pass
- What: A shared default import of `svelte/package.json` passes the web check and runs through the gpuix launcher. Desktop reports TS2306 because the wildcard maps the manifest to a file of ambient module declarations. The previous desktop config accepted the import.
- With a shared module that prints the imported manifest's version, `gpuix-svelte --bun` prints `5.59.2` in both layouts. Its runtime plugin skips string-valued exports, including the manifest, and normal resolution from the shared importer selects the registry manifest.
- Better: Limit the ambient declaration mapping to exports that use it. Let the manifest resolve as JSON and verify which manifest the launcher reads from the shared importer.
- Seen before: 2026-11-26, spec 2, desktop type resolution falls through on Svelte subpaths
- Promoted: yes, the desktop Svelte path mapping guideline in AGENTS.md

### 2026-11-26, spec 2, desktop checker adds browser globals to shared code

- Where: `apps/desktop/vite.config.ts`, PR #6 second pass
- What: In both install layouts, a shared helper reading `document.title` passes the desktop Svelte check. Plain TypeScript with the desktop config reports TS2584. The spike notes already document the checker loading Svelte's browser declarations.
- Better: Track this separately from Q1's GPUI markup check. Before relying on a check for browser globals, exercise a shared TypeScript helper and a shared component script.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, runtime guard infers package identity from the install directory name

- Where: `apps/web/vite.config.ts:19`, PR #6 second pass
- What: In a scratch copy, run `bun add svelte-compat@npm:svelte@5.50.0` in `apps/web`, then call `tick` from both `svelte-compat` and `svelte` in a page click handler. The uncached web build succeeds. Client chunk module IDs include both packages' `src/internal/client/runtime.js`. The alias directory fails the regex for a directory literally named `svelte`.
- Better: For the general one-runtime assertion, identify Svelte by its owning manifest's name and compare its real package directory with the app's resolved Svelte. Cache owner lookups during the build.
- Seen before: 2026-11-26, spec 2, runtime guard checks import spelling
- Promoted: yes, the emitted chunks and bundled runtime identity guidelines in AGENTS.md

### 2026-11-26, spec 2, Kit checker recommends an existing declaration

- Where: `scripts/check-kit-deps.ts:84`, PR #6 third pass at `df167f8`
- What: Set the root `overrides.devalue` to `6.0.4`, run `bun install --linker hoisted`, then `bun scripts/check-kit-deps.ts`. The check correctly exits 1, but tells both apps to add the exact ranges they already declare. Following the advice keeps the incompatible override in effect.
- Better: When the app already declares the requested range, point to the override or installed copy. Keep the add-dependency hint for an absent declaration.
- Seen before: 2026-11-26, spec 2, directory equality stands in for Kit version compatibility
- Promoted: yes, the dependency diagnostic guideline in AGENTS.md

### 2026-11-26, spec 2, hover tooltip extends below the plot

- Where: `packages/ui/src/ProjectionChart.svelte:51`, PR #7
- What: Q4's hover evidence uses the default rate. At 1200 × 800, commit 10% and hover over 2026. The tooltip ends at y=787.73 and the plot clips it at y=776. Headless GPUI reports the same bounds overrun, 883 versus 876.
- Better: Measure the tooltip and constrain its entire box to the plot, or record the clipping as a limit in the go/no-go inputs. Probe the first and last columns after changing the rate.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, chart sits beyond a narrow viewport

- Where: `packages/ui/src/App.svelte:70`, PR #7
- What: On the production web build at 390 × 844, the fixed-width sidebar places the entire chart to the right of the initial viewport. Its left edge is x=404.
- Better: State the viewport used for Q4 and document the narrow-width limit until the app gives the chart space at small widths.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, console claim exceeds hydration evidence

- Where: `.codex/notes/2026-11-26-gpuix-spike.md`, Q2 criterion 3, PR #7
- What: Chromium reports a 404 for `/favicon.ico` on dev and preview in the review. Hydration produces no mismatch warning or page error.
- Second pass at `57c5f12`: The note now names the 404 and narrows the capture to hydration warnings and page errors. The old dev sentence still says "the only console lines" were Vite and spike traces. Chromium reproduced the favicon error on both dev and preview.
- Better: Report hydration warnings and page errors separately from incidental HTTP errors.
- Seen before: no
- Promoted: no
