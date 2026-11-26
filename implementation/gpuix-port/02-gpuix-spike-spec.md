# Spec 2: gpuix spike

Date: 2026-11-25
Depends on: spec 1
Blocks: specs 3, 4 and 5

## Goal

Answer six questions with running code, then decide go or no-go on the port. The code can be rough. If the answer is go, it becomes the start of the new app.

## Setup

Create two apps and one component package. The [upstream demo](https://github.com/khromov/gpuix-svelte-sveltekit-shared-components-demo) keeps all of this in one package, so this split is the first thing under test.

```
apps/web/
  src/routes/               +layout.svelte, +page.svelte, +page.server.ts
  vite.config.ts
  tsconfig.json             web type check, includes packages/ui/src
apps/desktop/
  app.ts                    calls render_hot
  src/DesktopRoot.svelte    the window's root component
  tsconfig.json             gpuix type check, includes packages/ui/src
packages/ui/
  src/                      shared Svelte components
```

- Pin `gpuix-svelte` 0.6.0 and `gpuix-svelte-ui` to exact versions.
- `apps/web` lists its own `svelte` dependency. `apps/desktop` lists none and uses the build gpuix bundles.
- `packages/ui` depends on `gpuix-svelte` and `gpuix-svelte-ui`, and takes `svelte` as a peer.
- Use `adapter-vercel`, not the demo's `adapter-static`.
- Copy the demo's `one-svelte` Vite plugin into `apps/web`. It fails the web build if gpuix's bundled Svelte gets in.
- Each app passes its platform adapters into the shared root as a prop. No `imports` conditions.

## Questions and pass criteria

### Q1. Workspace wiring

The demo is a single package. This repo is a Bun workspace with the shared components in their own package, and the demo's desktop tsconfig hardcodes `./node_modules/gpuix-svelte/node_modules/svelte`.

Pass when all of these hold:

- The desktop window opens from `apps/desktop` through gpuix's dev command, started with `vp run`.
- The desktop tsconfig resolves the bundled Svelte wherever Bun installed `gpuix-svelte`, hoisted or not.
- A component in `packages/ui` compiles with the bundled Svelte for the desktop and with the app's Svelte for the web.
- The web build contains one Svelte runtime, and the guard plugin stays quiet.
- Both type checks pass over the shared components.
- Editing a shared component hot-reloads in both targets.
- A shared component imports `@retirement/calculator` and shows a computed balance on both targets.

If the split fails and a single package works, fall back to the demo's layout in `apps/web` with `app.ts` beside the routes, and drop `apps/desktop`. Record that in the README.

### Q2. Server rendering

The demo proves prerendering only. Decision 6 keeps a real server.

Pass when all of these hold:

- A route with a `+page.server.ts` load renders a shared component that uses the kit's `Button`, `TextField` and `Card`.
- The server HTML contains the rendered component and the `--ui-*` tokens, using the kit's `theme_rule` in `<svelte:head>`.
- The page hydrates with no mismatch warning.
- A local `adapter-vercel` production build serves it (`vp run web#build`, then `vp preview` in `apps/web`).
- The same load also returns a streamed promise holding a `Date`, and the page renders its value. A
  `devalue` mismatch broke exactly that path during Q1.

Amended 2026-11-26 (owner decision): the spike deploys nothing to Vercel. The local production build
stands in for the preview deployment, and the real Vercel preview moves to spec 5.

Record which SvelteKit major this worked on. Try Kit 3 first, as in the demo. Fall back to Kit 2.70 if `adapter-vercel` does not support Kit 3. Result: Kit 3.4.1 with `adapter-vercel` 7.0.5.

### Q3. Text input

Build one numeric field that both targets share.

Pass when all of these hold:

- Typing edits a draft string and does not change the committed value.
- Blur commits the parsed number. Enter commits too.
- Up and Down arrows step the value and commit.
- An empty field commits its fallback value.

Record which event gpuix fires on blur. The docs list focus helpers but I have not confirmed an `onblur`.

### Q4. Chart

Start from [reference/chart-geometry.ts](reference/chart-geometry.ts), which already matches LayerChart's path data.

| Check                                 | Pass                                                                                                            | If it fails                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Runtime-generated SVG mask per colour | Three series render                                                                                             | Stop. The 2026-11-21 probe says this works |
| Dashed strokes inside a mask          | Dashes render                                                                                                   | Use solid lines                            |
| Translucent fills                     | A 16% alpha fill tints correctly                                                                                | Precompute solid colours                   |
| Plot size                             | `onlayout` reports width and height in px                                                                       | Fixed-size plot                            |
| Pointer to year                       | `onmousemove` gives a position we can convert to a year, which needs the plot's left edge in window coordinates | Click and drag selection only              |
| Hover tooltip                         | A box follows the selected year using absolute `left` and `top`, or the `Popover` position prop                 | Fixed readout panel                        |
| Keyboard                              | Left and Right step the selected year                                                                           | Stop. The probe says this works            |

### Q5. Desktop plumbing

- Copy a string to the system clipboard from the desktop app.
- Write a JSON file to the OS app-data directory, restart the app, read it back.

If the clipboard has no route, the desktop debugger loses its copy button and nothing else changes.

### Q6. Packaged build

Run gpuix's build with Bun 1.4. Pass when it produces a macOS `.app` that launches unsigned on your machine. Record its size. The docs quote 110 to 155 MB.

## Go or no-go

- Q1, Q2 or Q3 failing with no workaround means stop. The Vite+ migration stands either way.
- Q4 failures degrade the chart as the table says. None of them stops the port except the two marked stop.
- Q5 failures drop a feature on desktop only.
- Q6 failing means the desktop app runs from source only. Decide then whether that is enough.

## Deliverables

- A note in `.codex/notes/` with the answer to each question, the versions used and every gpuix warning the spike triggered.
- An update to the "Still open" table in [README.md](README.md) for the SvelteKit version.
- The spike code, kept on a branch.

## Out of scope

- Real form sections, the custom-variable editor, the table, the debugger.
- Visual polish of any kind.
- Windows and Linux.
