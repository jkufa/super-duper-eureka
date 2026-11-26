# gpuix port

Date: 2026-11-25
Status: planned, nothing built yet

One Svelte codebase that ships as the SvelteKit web app and as a native desktop app through [gpuix-svelte](https://gpuix-svelte.stanislav.garden/overview.html). The repo moves to Vite+ first. The current web app stays live as `apps/webapp-legacy` until the new app passes the parity gate, then we delete it.

## Specs, in order

1. [Vite+ migration](01-vite-plus-migration-spec.md)
2. [gpuix spike](02-gpuix-spike-spec.md). Go or no-go happens here.
3. [Shared core extraction](03-shared-core-extraction-spec.md)
4. [Playwright parity suite](04-playwright-parity-spec.md)
5. [Build-out](05-build-out-spec.md)
6. [Parity gate and cutover](06-parity-gate-and-cutover-spec.md)

Step 2 comes before step 3 on purpose. Steps 3 to 5 only pay off if gpuix works, and the spike needs nothing but `@retirement/calculator`.

## Decisions

| # | Decision |
|---|---|
| 1 | One shared Svelte codebase for web and desktop. TypeScript only, no Swift. |
| 2 | One implementation of every component, written to gpuix's shared subset on top of `gpuix-svelte-ui`. The new app has no shadcn, bits-ui, formsnap, superforms, vaul, LayerChart, number-flow, mode-watcher or Tailwind. |
| 3 | The new code lives in `apps/web`, `apps/desktop`, `packages/core` and `packages/ui`. `apps/webapp` becomes `apps/webapp-legacy`, untouched in source, deleted at parity. |
| 4 | Vite+ migration happens first, across the whole repo. Bun stays the package manager. |
| 5 | Oxlint and Oxfmt replace ESLint and Prettier everywhere. `svelte-check` stays as its own task. |
| 6 | The web target keeps its server on `adapter-vercel`. |
| 7 | The server keeps today's three jobs. Both targets boot through a shared `createBoot(env)` and `<App {boot} />`. |
| 8 | Config persistence goes through an async store interface keyed by scenario id. `localStorage` on web, one JSON file on desktop, SQLite possible later. |
| 9 | Our own runes form store replaces superforms. Fields are controlled. Typed accessors replace string paths. Numeric fields keep arrow-key stepping and lose wheel and spinner stepping. |
| 10 | One shared chart. Geometry in framework-free TS, a thin paint layer per platform, hover tooltip kept. Gradient fills, the reveal animation and animated KPI numbers go on both targets. |
| 11 | Date entry is text only, with the parsed date shown beneath. No calendar grid. |
| 12 | The mobile drawer becomes a two-state bottom panel. Tap the handle to toggle. No drag, no animation. |
| 13 | The debugger docks. No dragging, no saved position. Right edge on wide windows is assumed. |
| 14 | Blank-slate styling. One `apply_theme()` call with the kit's stock palette, `--ui-*` tokens only, and our own CSS limited to layout. Web follows the OS, desktop uses stock dark, no toggle. |
| 15 | Three test layers. The rewritten Playwright specs run against both apps and define parity. |
| 16 | Work order as listed above. |

## Still open

I did not get to these in the interview. Each has the default the specs assume.

| Question | Assumed default |
|---|---|
| SvelteKit version for the new app | The upstream demo's versions, Kit 3 and Vite 8. The spike checks `adapter-vercel` against Kit 3 and falls back to Kit 2.70 |
| Desktop distribution | An unsigned macOS build that runs on your machine. No signing, notarising or auto-update |
| Accessibility bar for parity | Every flow works by keyboard on both targets. Screen reader parity is not a gate, because gpuix drops most ARIA state attributes and its dialogs do not trap focus |
| gpuix upgrade policy | Pin `gpuix-svelte` and `gpuix-svelte-ui` to exact versions. Upgrade on purpose, one version at a time, because each release can change the bundled Svelte build |
| CI | None exists today and these specs add none |

## Facts the plan rests on

- gpuix-svelte 0.6.0 bundles a build of an unmerged Svelte pull request. The web build uses the app's own Svelte and must never load the bundled one.
- Shared components cannot use `bind:`. Styling lives in `<style>` blocks with single-class selectors, flexbox, a simple grid and `var(--token)`.
- `IS_GPUIX` branches inside a component. Whole-file platform differences are adapters that each app passes into the shared root.
- The upstream demo keeps apps and components in one package. Splitting them across a Bun workspace is untested upstream, and the spike's Q1 has to prove it.

## Layout

```
apps/web/          SvelteKit on adapter-vercel. Routes, server loads, web adapters.
apps/desktop/      gpuix entry. app.ts, the window root, desktop adapters.
packages/core/     @retirement/core. Shared logic. No Svelte, no browser APIs.
packages/ui/       @retirement/ui. Shared Svelte components, written to gpuix's shared subset.
```
- `onmousemove` exists and carries `e.x`, `e.y` and `e.pressedButton`. The docs do not list it, the source does.
- Vite+ 1.x bundles Vite 8 and Vitest 5 for the whole workspace and supports Bun as the package manager.
- Oxlint lints only the `<script>` block of `.svelte` files. Oxfmt formats `.svelte` through a bundled Prettier.

## References

- Chart comparison, existing against PoC: https://claude.ai/artifact/GV79hgcBZDRZesf1tEU2qX
- PoC geometry source: [reference/chart-geometry.ts](reference/chart-geometry.ts)
- Upstream shared-components demo: https://github.com/khromov/gpuix-svelte-sveltekit-shared-components-demo
- gpuix-svelte source: https://github.com/khromov/gpuix-svelte
- Earlier desktop research: [../retirement-desktop-research.html](../retirement-desktop-research.html)
- Vite+ docs: https://viteplus.dev/guide/
