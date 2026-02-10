# Visual Consistency Implementation Spec

Date: 2026-02-10  
Source audit: `qa/_findings/2026-02-10-visual-consistency-audit.md`  
Scope: implementation guidance for the 5 prioritized inconsistencies

## 1) Unify custom-variable create/edit form primitives

### Why
- The same logical fields (name, type, amount, timing, year range, growth) render through different component stacks in create vs edit mode.
- This causes visible drift in label treatment, error rendering, and input behavior for identical tasks.

### How
- Introduce shared subcomponents or snippets used by both modes:
  - `VariableNameField`
  - `VariableTypeField`
  - `VariableAmountField`
  - `VariableYearRangeFields`
  - `VariableGrowthSection`
- Use `Form.Field` + `Form.Control` + `Form.Label` + `Form.FieldErrors` for both create and edit flows where schema-backed fields exist.
- For local edit-state fields, wrap with the same visual primitives even if value source is local `$state`.
- Replace direct raw `Input` blocks in edit mode with `ConfigNumericField` (or a shared field wrapper) to match input chrome and prefix/suffix behavior.

### Acceptance Criteria
- Create and edit mode for the same field type are visually indistinguishable except for CTA labels.
- Field-level errors appear with identical placement and style in both modes.
- No duplicated markup blocks remain for equivalent field groups.

## 2) Normalize form label hierarchy across configuration inputs

### Why
- Equivalent inputs currently use mixed label weights/sizes (`default` vs muted `text-xs`), creating false hierarchy.
- Users should perceive all primary config inputs as one coherent tier.

### How
- Define two explicit label tokens for form UI:
  - `label-primary`: default `Form.Label` style for all first-order editable fields.
  - `label-secondary`: muted/xs style reserved for helper metadata only.
- Apply `label-primary` to:
  - all main config inputs,
  - custom-variable create fields,
  - custom-variable edit fields.
- Restrict `label-secondary` to non-input helper lines (parse feedback, optional section subtitles, etc.).

### Acceptance Criteria
- No primary input label in config uses `text-xs text-muted-foreground`.
- Label typography is consistent across basics, growth, salary, contributions, and custom-variable forms.
- Visual scan shows one clear label tier for editable fields.

## 3) Standardize contribution “Edit” action discoverability across breakpoints

Status: Completed (2026-02-10)

### Why
- Desktop hides the edit action until hover/focus while mobile shows it immediately.
- A core action should not change discoverability model by viewport.

### How
- Choose one behavior and apply it globally for `labelActionText` buttons in `ConfigNumericField`.
- Recommended: always visible at low visual weight (`ghost`, muted text), with stronger hover/focus affordance.
- Remove breakpoint-specific opacity toggles (`md:opacity-0 ...`) from the action button class.
- Keep keyboard focus styles unchanged for accessibility.

### Acceptance Criteria
- The contribution “Edit” action is discoverable in the same way on desktop and mobile.
- No breakpoint-specific hide/show class remains for this action pattern.
- Keyboard and pointer interaction behavior is unchanged functionally.

## 4) Align projection section containers (chart/table)

Status: Cancelled (2026-02-10)  
Reason: Chart/table container differences are intentional and should be preserved.

### Why
- Chart content appears in a card shell while table content is plain.
- Peer result modules should share one container language unless intentionally differentiated.

### How
- Apply a common section shell for both chart and table blocks.
- Recommended pattern:
  - `Card.Root` + `Card.Content` for both modules, or
  - a neutral shared wrapper component if card chrome is too heavy.
- Keep width and alignment tokens (`max-w-*`, margins) identical between the two sections.
- Preserve table sticky header behavior after wrapping.

### Acceptance Criteria
- Chart and table sections have matching outer chrome, padding model, and alignment.
- Result modules read as sibling components in one system.
- No regression to table sticky header behavior.

## 5) Normalize projection heading tier and debugger copy-button tokens

Status: Completed (2026-02-10)

### Why
- Projection headings use mixed semantic/typographic tiers (`h2 semibold` vs `h3 medium`) for same-level sections.
- Debugger copy controls use different button heights and visual emphasis for the same interaction family.

### How
- Projection headings:
  - Set one heading level/treatment token for peer result sections (e.g., both `h2` with same type scale).
  - Keep internal subheadings below this tier.
- Debugger copy buttons:
  - Define one shared variant class for copy actions in debugger context (size, padding, text emphasis).
  - Apply this variant to both JSON-block copy and panel-level copy-all.
  - Standardize default labels around one pattern (`Copy`, `Copy all`, `Copied` state only differs by scope).

### Acceptance Criteria
- Projection section headers share semantic level and visual style.
- All debugger copy controls render with one consistent button token set.
- Copy action text pattern is consistent across debug surfaces.

## Rollout Order

1. Unify custom-variable primitives (largest source of drift).
2. Normalize label hierarchy.
3. Standardize contribution edit affordance visibility.
4. Align projection containers.
5. Normalize headings and debugger copy tokens.

## Validation Plan

- Desktop + mobile visual QA on:
  - custom variable create/edit,
  - contribution list edit affordance,
  - projection chart/table section chrome,
  - debugger copy controls.
- Regression check:
  - form submit/edit/delete actions,
  - contribution edit entry flow,
  - projection table sticky header,
  - debugger copy-to-clipboard behavior.
