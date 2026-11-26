# Spec 3: Shared core extraction

Date: 2026-11-25
Depends on: spec 2 returning go
Blocks: spec 5

## Goal

All framework-free app logic lives in one workspace package that the legacy app and the new apps import. That logic has no Svelte and no browser APIs.

## Package

`packages/core`, named `@retirement/core`. The spike created it with `src/ui` for shared Svelte components. This spec adds `src/logic`, and everything below goes there. The logic depends on `@retirement/calculator`, `zod`, `chrono-node`, `d3-scale` and `d3-shape`.

The package exports the two folders separately, as `@retirement/core/logic` and `@retirement/core/ui`. The legacy app imports only `logic`, so it never compiles a gpuix component.

## Part A: move existing code

Move these from `apps/webapp-legacy/src/lib`, with their tests. The legacy app then imports them from the package, and nothing else in legacy changes.

| From | Lines |
|---|---|
| `forms/retirement-config-form.ts` and its test | 249 |
| `forms/frequency-nlp/` and its test | 259 |
| `components/form/custom-variable-editor-actions.ts` and its test | 192 |
| `components/form/custom-variable-editor-model.ts` | 111 |
| `components/form/custom-variable-editor-state.ts` | 101 |
| `components/form/custom-variable-timing-controller.ts` | 69 |
| `formatters.ts` | 26 |

`custom-variable-editor-state.ts` imports `@internationalized/date` for the calendar. The new app has no calendar. Replace its `DateValue` use with a plain `{ year, month, day }` type inside the package, and convert at the edge in the legacy calendar component.

## Part B: fix the lossy round trip

Today a config that passes through the form mapping loses data. With the 401k rule disabled in `packages/cli/examples/basic.json`, the trip drops `enabled: false` and converts the rule's `salaryBasis`. Decision 8 makes the desktop's config file double as CLI input, so this bug becomes visible to users.

- The mapping from form values back to a config starts from the base config and matches rules by id. It writes only fields the form edits.
- Add a test that runs every file in `packages/cli/examples/` through config, form values, config. Every field the form does not expose must come back unchanged.
- Add a specific test for the disabled 401k case.

## Part C: boot contract

```ts
export interface AppBoot {
  config: RetirementConfig;
  debugEnabled: boolean;
  mock: boolean;
  logContext: LogContext;
}

export function createBoot(env: BootEnv, request?: { requestId: string }): AppBoot;
```

- `createBoot` holds the logic now in `+page.server.ts` and `+layout.server.ts`. It returns the default config, or `generateRandomRetirementConfig(seed)` when `MOCK_REAL_DATA` is set, and reads `DEBUG`.
- On the web the hook supplies `requestId`. On desktop there is no request, so `createBoot` makes one id per launch.
- It returns a plain config. No superforms object.
- Switch the legacy server loads to call `createBoot` for the config. Legacy still wraps the result in `superValidate`. That keeps one definition of boot data while both apps exist.

## Part D: store interfaces

```ts
export type ScenarioId = string;
export const DEFAULT_SCENARIO: ScenarioId = 'default';

export interface ConfigStore {
  load(id: ScenarioId): Promise<RetirementConfig | null>;
  save(id: ScenarioId, config: RetirementConfig): Promise<void>;
}

export interface PrefStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
```

- Both are async so a file or SQLite adapter fits without changing callers.
- The config store is keyed by scenario id from the start. The port uses only `DEFAULT_SCENARIO`.
- The shape check that runs on read today moves here from `config-context.svelte.ts`, so every adapter gets it.
- The package ships an in-memory adapter for tests. The real adapters touch platform APIs and live in `apps/web` and `apps/desktop`. Spec 5 covers them.
- `PrefStore` holds the debugger's enabled flag.

## Part E: validation helper

A function that runs the zod schema's `safeParse` on form values and returns errors keyed by field path. The runes form store in spec 5 calls it. It replaces what the superforms client validator did.

## Part F: chart geometry

Move [reference/chart-geometry.ts](reference/chart-geometry.ts) into the package, adjusted for whatever the spike learned. Test it against fixed input with a stored snapshot of the path strings.

## Acceptance criteria

- The legacy app builds, and all 24 Playwright tests pass, with the moved files imported from `@retirement/core/logic`.
- `vp test` runs the moved tests and the new ones, all green.
- The round-trip test passes for every example config.
- A test fails if any file under `src/logic` references `svelte`, `window`, `document`, `localStorage`, `sessionStorage` or `navigator`, or imports from `src/ui`.
- The legacy server loads call `createBoot`.

## Out of scope

- The runes form store. It uses Svelte and goes in `src/ui` during spec 5.
- The `localStorage` and file adapters.
- Multiple scenarios, revisions and SQLite.
