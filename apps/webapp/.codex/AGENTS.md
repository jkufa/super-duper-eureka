# AGENTS

Webapp-specific guidance for agents.

## Style

Prefer `` `${}` `` template literal syntax over the `String()` constructor when coercing values to string (e.g. `` `${x}` `` instead of `String(x)`).

## Tailwind

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

## shadcn components

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
