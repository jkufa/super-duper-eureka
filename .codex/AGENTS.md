# AGENTS

This repo contains a retirement calculator, a CLI wrapper, and a shared logger package. Bun is used for development and testing.

## Setup

- Install dependencies: `bun install`
- Workspace layout:
  - `packages/calculator` (library)
  - `packages/cli` (CLI)
  - `packages/logger` (wide-event logger)

## Tests

- Run all tests: `bun run test`
- Run calculator tests only: `bun run --cwd packages/calculator test`
- Coverage (calculator): `bun run --cwd packages/calculator test --coverage --run`

## Linting

- Always run the linter after making changes.
- Lint all packages: `bun run lint`
- Lint specific package only: `bun run --filter '<package-name>' lint`
  - Example: `bun run --filter '@retirement/calculator' lint`

## Formatting

- Always run the formatter after making changes.
- Format all packages: `bun run format`
- Format specific package only: `bun run --filter '<package-name>' format`

## CLI usage

Examples live in `packages/cli/examples/`.

- Basic run:
  - `bunx retirement-calc --config packages/cli/examples/basic.json`

- Debug run (step-by-step wide events, pretty JSON by default):
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug`

- Non-interactive debug (raw JSON):
  - `bunx retirement-calc --config packages/cli/examples/one-time.json --debug --no-interactive --raw`

Skip steps:

- Skip specific steps and ranges:
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug --skip "1,3-5,12"`
- Skip next N steps (interactive or via flag):
  - `bunx retirement-calc --config packages/cli/examples/daily-debug.json --debug --skip "next:10"`

Notes:

- `--debug` emits wide-event JSON per step plus a final run summary.
- Interactive mode pauses between steps (press Enter to continue, `q` to quit).

## Debug module (UI integration)

The debug utilities are exported directly from `@retirement/calculator`:

- `calculateProjectionWithSteps`
- `buildStepWideEvent`
- `buildRunWideEvent`
- `createWideEventLogger` (from `@retirement/logger`)

The logger is a standalone module for UI reuse:

- Package: `@retirement/logger`
- Entry: `packages/logger/src/index.ts`

## Notes

As you work on the project, always add md files to `.codex/notes/` explaining the problem and your solution. You can reference these notes in your future work.

## Webapp

When using tailwind in the webapp, favor the built in tailwind variables over custom values.
ex:

```html
<!-- Avoid -->
<div class="max-w-[320px]"></div> 
<!-- Prefer -->
 <div class="max-w-80"></div>
 ```

 If you need to use a custom value, create a custom tailwind variant in `src/routes/layout.css`:

 ```css
 @theme inline {
  /* Add a comment to explain the purpose of the variable */
  --max-w-for-arbitrary-thing: 12.4242rem;

  /* or */
  --debugger-panel-width: clamp((var(--spacing-64)), 100vw, var(--spacing-120));
 }
 ```

 Then use the custom variant in your component:

 ```html
 <div class="max-w-for-arbitrary-thing"></div>
 <!-- you don't need to use var() in the custom variant -->
 <div class="w-(--debugger-panel-width)"></div>
 ```

For shadcn components in the webapp, use namespace imports and namespaced components:

```ts
import * as Card from '$lib/components/ui/card';
import * as Button from '$lib/components/ui/button';
import * as Accordion from '$lib/components/ui/accordion';
import * as Tooltip from '$lib/components/ui/tooltip';
```

```svelte
<Card.Root>
  <Card.Header />
  <Card.Content />
  <Card.Footer />
</Card.Root>

<Button.Root>Save</Button.Root>

<Accordion.Root type="multiple">
  <Accordion.Item value="example">
    <Accordion.Trigger>Example</Accordion.Trigger>
    <Accordion.Content>...</Accordion.Content>
  </Accordion.Item>
</Accordion.Root>

<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger>Hover</Tooltip.Trigger>
    <Tooltip.Content>Hint</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```
