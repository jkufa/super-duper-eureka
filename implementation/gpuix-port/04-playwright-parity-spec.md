# Spec 4: Playwright parity suite

Date: 2026-11-25
Depends on: spec 1. Can run alongside spec 3.
Blocks: the feature stages of spec 5 and the gate in spec 6

## Goal

One set of Playwright specs that describes what a user does and sees, runs against both apps, and decides when the port is done. Rewrite the specs to be better while doing it. Parity is what they are for.

## Starting point

- 8 spec files and about 24 tests in `apps/e2e/tests`, plus two helper files.
- The specs reach into the legacy DOM directly: 63 `getByRole`, 19 `getByText` and 71 `locator` calls. The locators include `data-slot` attributes, element ids, `span.right-3`, `div.group` and `xpath=ancestor::section[1]`.
- Two projects today, desktop Chrome and Pixel 5, against one base URL.

## Design

### Drivers

Specs stop touching selectors. They call drivers that speak in user terms:

```ts
await form.setNumber('Current balance', 50_000);
await editor.open();
await editor.fill({ name: 'Bonus', amount: 5_000, timing: 'next March' });
await editor.save();
await expect(projection.row(2040)).toContainBalance(1_234_567);
```

- Drivers: `ConfigForm`, `CustomVariableEditor`, `Projection`, `Debugger`, `Layout`.
- Each driver has one interface and two selector maps, `legacy` and `app`. A fixture picks the map from the project.
- The legacy map holds the existing `data-slot`, id and role selectors.
- The app map uses roles and labels first, then gpuix's `testid` attribute. In the browser `testid` is a plain attribute, so the app projects set Playwright's `testIdAttribute` to `testid`.

### Projects

| Project | Target | Port |
|---|---|---|
| `legacy-chromium`, `legacy-mobile` | `apps/webapp-legacy` | 4173 |
| `app-chromium`, `app-mobile` | `apps/web` | 4174 |

Each pair starts its own web server. The `E2E_SKIP_WEBSERVER` and `E2E_BASE_URL` overrides keep working per target.

### Tags

- `@parity` runs on all four projects. This is the default and should be most tests.
- `@legacy-only` covers behaviour we chose to drop: picking a date in the calendar grid, dragging the drawer between snap points, dragging the debugger and restoring its position.
- `@app-only` covers what replaces them: the parsed-date line, the bottom panel toggle, the docked debugger, and selecting a chart year by click and by arrow key.

### Parity matrix

Keep `apps/e2e/PARITY.md`, one row per test, with its tag and, for anything not `@parity`, the decision number that explains why. Spec 6 reads this file.

## Work

### Part A, before the build-out

1. Write the drivers and the legacy selector map.
2. Rewrite each spec onto the drivers. While there, fix what makes them weak: replace text and class matching with roles and labels, remove fixed waits, split tests that assert several unrelated things.
3. Add the four projects. The app projects exist and have nothing to run yet.
4. Tag every test and write the matrix.

### Part B, during the build-out

As each stage of spec 5 lands, fill in that feature's entries in the app selector map and turn on its `@parity` tests for the app projects. Write the `@app-only` tests for that stage in the same change.

### The demo video spec

`demo-video.spec.ts` and its two configs record a video of the legacy UI. Treat them as legacy-only. Spec 6 decides whether to re-record against the new app or delete them.

## Acceptance criteria

Part A:

- Every existing test passes on both legacy projects through the drivers.
- No spec file contains a raw selector. A check fails the lint task if a spec calls `locator`, `getByRole`, `getByText` or `getByTestId` directly.
- `PARITY.md` lists every test with a tag.
- `vp run e2e` runs the legacy projects. The app projects are configured and empty.

Part B, checked in spec 6:

- Every `@parity` test passes on all four projects.
- Every `@legacy-only` test has a matching `@app-only` test or a written reason it needs none.

## Out of scope

- Desktop testing. The gpuix headless smoke suite is in spec 5.
- Visual regression screenshots. The styling is deliberately different, per decision 14.
