# Debugger Panel Spec (Svelte + shadcn-svelte)

![Debugger Panel POC](./image.png)

## Goal

Build a draggable debugger panel for simulation playback with accordion-based data sections and bounded viewport height.

## UX Review Notes (from mock)

- Keep payload sections collapsed by default except `Step` to reduce scan fatigue.
- Use an explicit drag handle in the header; do not make the whole panel draggable.
- Split panel into: header, scrollable body, sticky footer.
- Add copy affordances and readable JSON formatting for each section.
- Include clear disabled states at step bounds and keyboard stepping.

## Functional Requirements

1. The panel is draggable and droppable anywhere in viewport.
2. Max height is `calc(100vh - 128px)`.
3. Body content scrolls independently; footer controls remain visible.
4. `Event details`, `Configuration`, and `Step` are collapsible accordion items.
5. Position persists per browser session/local storage key.
6. Step controls support buttons and keyboard arrows.

## Component Contract

### `DebuggerPanel.svelte` props

- `open: boolean`
- `stepIndex: number`
- `stepCount: number`
- `eventDetails: unknown`
- `configuration: unknown`
- `stepPayload: unknown`
- `initialPosition?: { x: number; y: number }`
- `storageKey?: string` (default: `debugger-panel:position`)
- `onClose?: () => void`
- `onStepChange?: (nextIndex: number) => void`

### Internal state

- `position: { x: number; y: number }`
- `isDragging: boolean`
- `openItems: string[]` (default: `["step"]`)
- `isWrapEnabled: boolean` (optional)
- `panelWidth: number` (optional if resize enabled)

### Derived state

- `canStepBack = stepIndex > 0`
- `canStepForward = stepIndex < stepCount - 1`
- `stepLabel = "Step: ${stepIndex + 1}/${stepCount}"`

## Layout + Sizing

- Root container:
  - `position: fixed`
  - `z-index`: above app UI (e.g., `z-50`)
  - `width`: `360px` default
  - `min-width`: `320px`
  - `max-width`: `min(70vw, 520px)`
  - `max-height`: `calc(100vh - 128px)`
- Card layout:
  - Header: fixed height, contains title, drag handle, close button.
  - Body: `overflow: auto`, contains accordion sections.
  - Footer: sticky to card bottom with previous/next controls.

## Interaction Spec

### Drag behavior

- Drag starts only from header drag handle.
- On `pointerdown` on handle:
  - capture pointer
  - store cursor-to-panel offset
  - set `isDragging = true`
- On `pointermove`:
  - compute next `x/y`
  - clamp within viewport bounds:
    - `x in [8, viewportWidth - panelWidth - 8]`
    - `y in [8, viewportHeight - panelHeight - 8]`
  - apply using transform: `translate3d(x, y, 0)`
- On `pointerup/cancel`:
  - release capture
  - `isDragging = false`
  - persist clamped position to local storage

### Accordion behavior

- Use `Accordion` (`type="multiple"`).
- Items:
  - `event-details`
  - `configuration`
  - `step`
- Default open: `step`.
- Preserve expansion state while open.

### Step controls

- Footer buttons:
  - `Step backward` -> `stepIndex - 1`
  - `Step forward` -> `stepIndex + 1`
- Disable at bounds.
- Keyboard shortcuts when panel focused:
  - `ArrowLeft` => backward
  - `ArrowRight` => forward
- Optional enhancement: numeric jump input with Enter-to-apply.

## Data Display Spec

### JSON blocks

- Pretty print each payload with `JSON.stringify(data, null, 2)`.
- Monospace type scale at small size for density.
- Keep line height >= 1.45 for readability.
- Optional toggles:
  - `Wrap lines`
  - `Copy`
- For very large payloads, allow future virtualization/collapsed depth.

## Accessibility

- Panel root: `role="dialog"`, `aria-label="Debugger"`.
- Close button has descriptive `aria-label`.
- Drag handle should be keyboard reachable and announce draggable behavior.
- Accordion triggers are semantic buttons with `aria-expanded`.
- Focus-visible ring for all interactive controls.
- Hit targets >= `40px` height for touch comfort.

## shadcn-svelte Primitives

- `Card`
- `Button`
- `Accordion`
- `ScrollArea`
- `Separator`
- `Tooltip` (for disabled reasons and shortcuts)
- `Input` (optional jump-to-step)

## Suggested File Structure

- `libs/components/debug/DebuggerPanel.svelte`
- `libs/components/debug/DebugJsonBlock.svelte`
- `libs/components/debug/types.ts`
- `libs/components/debug/debugger-panel.spec.md`

## Implementation Notes (Svelte)

- Use `onMount` to load persisted position.
- Re-clamp on window resize.
- Avoid heavy recomputation by memoizing stringified JSON per section and step index.
- Keep document-level listeners only during active drag.
- Ensure text selection inside JSON content still works when not dragging.

## Acceptance Criteria

1. Panel can be dragged and always remains visible in viewport.
2. Panel max height always equals `100vh - 128px`.
3. Header and footer remain visible while JSON content scrolls.
4. All three data groups are collapsible accordions.
5. Step controls work by click and arrow keys with correct disabled behavior.
6. Position persists after refresh.
7. Basic a11y semantics and focus behavior are implemented.
