# Spec 5: Build-out

Date: 2026-11-25
Depends on: specs 2, 3 and part A of spec 4
Blocks: spec 6

## Goal

`apps/web` and `apps/desktop` together do everything the legacy app does, apart from the behaviours decisions 9 to 14 changed, from one set of components in `packages/ui`.

## Rules for shared code

These apply to everything in `packages/ui`.

- No `bind:`. A field takes `value` and calls `onchange(value)`.
- No raw `<input>` events in shared components. Use the kit's `TextField`, or branch on `IS_GPUIX`.
- No DOM-only library. No `window`, `document` or web storage.
- Styling goes in `<style>` blocks with single-class selectors. No Tailwind, no `:global`, no combinators.
- Platform differences go in one of two places: an `IS_GPUIX` branch inside a component, or the `platform` object each app passes to `<App>`. Shared code never imports from an app.
- Every interactive element carries a `testid`.
- Icons come from the kit's `Icon`.

## Styling rule

From decision 14.

- One `apply_theme()` call at the root with the kit's stock palette. Web follows the OS through gpuix's `media_query` helper. Desktop uses stock dark.
- Colours come only from `--ui-*` tokens, and only where something would otherwise be invisible.
- Dividers and surfaces use the kit's `Separator` and `Card`. We write no borders or backgrounds ourselves.
- Our CSS covers flex and grid, gap, padding, sizes, overflow and positioning. Nothing for fonts, radii, shadows or type scale.
- Chart series use `accent`, `success` and `muted`.

## Structure

```
apps/web/
  src/hooks.server.ts               request id
  src/routes/+page.server.ts        calls createBoot with private env
  src/routes/+page.svelte           renders App with the web platform
  src/lib/platform.ts               localStorage stores, navigator clipboard, sessionStorage id
apps/desktop/
  app.ts
  src/DesktopRoot.svelte            calls createBoot with process.env, renders App with the desktop platform
  src/platform.ts                   JSON file stores, desktop clipboard, per-launch id
packages/core/                      from spec 3
packages/ui/
  src/App.svelte                    shared root, takes boot and platform
  src/form/                         form store and fields
  src/editor/                       custom-variable editor
  src/projection/                   table, KPIs, plot
  src/debug/
  src/base/                         our own base components
```

The `platform` prop has one type, defined in `@retirement/core`:

```ts
export interface Platform {
  configStore: ConfigStore;
  prefStore: PrefStore;
  copyText?(text: string): Promise<void>;
  sessionId(): string;
}
```

`App.svelte` puts it in Svelte context so components read it without prop drilling.

## Stages

Each stage ends the same way. `vp check` and both type checks pass, unit tests pass, the stage's `@parity` and `@app-only` Playwright tests pass on the app projects, and the stage's desktop smoke test passes.

### Stage 1: shell, boot and persistence

- `App.svelte` takes `boot` and `platform`, applies the theme and lays out a form column beside a results column.
- The web store adapter keeps the existing key, `retirement_webapp_retirement_config`, so a browser with saved legacy data loads it in the new app.
- The desktop store adapter reads and writes one JSON file in the OS app-data directory. The file is a plain `RetirementConfig`, so `retirement-calc --config` can read it.
- The app loads the stored config once at start, then runs `calculateProjectionWithSteps` and `calculateRetirement` as derived values, as `+page.svelte` does today.
- The log session id comes from `sessionStorage` on web and is made once per launch on desktop.

Done when a hand-edited stored config changes the numbers shown on both targets.

### Stage 2: form store and base fields

- A runes form store in a `.svelte.ts` module. It holds `values`, `committed` and `errors`, and exposes typed accessors per field. It calls the validation helper from `@retirement/core`.
- `NumericField` built from the spike's field: draft string, commit on blur and Enter, arrow-key stepping, prefix and suffix, optional label action and tooltip. No wheel or spinner stepping.
- The four sections: basics, growth, salary and contributions. Growth uses the kit's `Select`.
- Two base components the kit lacks. `Accordion` is a header button and an `{#if}` block. `SegmentedControl` replaces the toggle group.
- Every commit saves through the config store.

Done when the `form-behavior` and `localstorage-config` specs pass on the app projects.

### Stage 3: custom-variable editor

- Add, edit and delete flows, driven by the editor model, state and actions already in `@retirement/core`.
- The dialog is the kit's `Dialog`. It does not move focus into itself, so the editor focuses its first field on open and closes on Escape.
- The timing field is a text input parsed by the frequency parser, with the parsed date shown on a line beneath. No calendar.
- Core, growth and timing field groups, shared between add and edit.

Done when the `add-custom-variable`, `update-custom-variable`, `custom-variable-hybrid-mode` and the text half of `custom-variable-start-date` specs pass on the app projects.

### Stage 4: projection table and KPIs

- The yearly table is rows in a simple grid inside the kit's `Scroller`. No `<table>` element, since gpuix renders unknown tags as plain boxes.
- KPI values are plain text that updates at once.

### Stage 5: chart

- `ProjectionPlot` takes its geometry from `@retirement/core`.
- The paint layer has two branches. The web draws inline SVG paths. The desktop draws one SVG mask per colour.
- Axis labels, legend and readout are text elements.
- Hover shows a tooltip for the year under the pointer. Click and drag select a year. Left and Right step it.
- Apply whatever fallbacks the spike's Q4 table settled on.

Done when the `@app-only` chart tests pass and the plot renders the same series as the legacy chart for the same config.

### Stage 6: debugger

- A panel docked to the right edge, shown when `boot.debugEnabled` or the stored flag is set.
- Step controls with keyboard shortcuts through `on_window_key`. Shortcuts do nothing while a text field has focus, which the event's `editing` flag reports.
- The step details use our `Accordion` and a JSON block.
- The copy button calls `platform.copyText`. If the spike found no desktop clipboard, the desktop platform leaves it undefined and the button does not render.
- A debugger action loads a random scenario, replacing the `MOCK_REAL_DATA` page behaviour for manual use. The env flag still works at boot.

Done when the `debugger` spec's `@parity` tests pass on the app projects.

### Stage 7: narrow layout

- Below 1264px wide, a media query moves the form into a panel pinned to the bottom.
- The panel has two heights, about 28% and full. Tapping its handle switches between them at once.
- The debugger becomes a full-width section above the panel.
- This applies to a narrow desktop window too.

Done when every `@parity` test passes on `app-mobile`.

## Desktop smoke suite

Written with `gpuix-svelte/test`, which runs headless on macOS. One test per stage:

1. The window opens and shows a balance computed from the default config.
2. Editing the current balance changes the final balance.
3. Adding a custom variable adds its row.
4. The table shows one row per projected year.
5. Clicking the plot and pressing Right changes the selected year.
6. The debugger panel opens and steps.
7. At a narrow window size the bottom panel toggles.

Also run the config file check from the spike: save, restart, load.

## Acceptance criteria

- All seven stages are done by their own criteria.
- The shared-code rules hold. A check fails the lint task on `bind:`, a Tailwind class or a DOM global in `packages/ui`.
- The desktop smoke suite passes on macOS.
- The packaged macOS build launches and runs the smoke flows by hand.

## Out of scope

- Any design direction beyond the blank-slate rule.
- The calendar grid, a theme toggle, multiple scenarios, file open and save, SQLite.
- Windows and Linux builds.
