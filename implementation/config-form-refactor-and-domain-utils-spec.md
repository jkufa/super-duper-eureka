# Config Form Refactor + Domain Utils Spec

Status: In Progress
Owner: Webapp / Calculator
Date: 2026-02-10

Progress:
- Completed (2026-02-10): Track 2 step 1-3 slice for shared custom-variable validation and normalization utilities, including webapp integration into `ConfigCustomVariableForm.svelte`.
- Completed (2026-02-10): Track 1 partial UI parity slice in `ConfigCustomVariableForm.svelte`:
  - unified edit amount + growth amount with shared numeric-field rendering snippet,
  - normalized primary label treatment in create/edit blocks,
  - added timing parse fallback to structured values when natural text is blank.
  - Validation:
    - `bun run --filter @retirement/calculator test` passed.
    - `bun run --filter e2e test tests/add-custom-variable.spec.ts --project=chromium` passed.
    - `bun run --filter e2e test tests/custom-variable-hybrid-mode.spec.ts` passed on chromium (mobile cases skipped in current run config).
    - `bun run --filter e2e test tests/update-custom-variable.spec.ts` currently fails in this branch because selectors expect controls no longer present in the in-flight hybrid edit UI (`Annual`, `At start`, explicit year-range inputs).
- Completed (2026-02-10): Track 1 component extraction slice:
  - extracted `CustomVariableCoreFields.svelte`,
  - extracted `CustomVariableTimingFields.svelte`,
  - extracted `CustomVariableGrowthFields.svelte`,
  - rewired `ConfigCustomVariableForm.svelte` to compose these pieces while keeping IDs and interaction behavior stable.
  - Validation:
    - `bun run --filter @retirement/calculator test` passed.
    - `bun run --filter e2e test tests/add-custom-variable.spec.ts --project=chromium` passed.
    - `bun run --filter e2e test tests/custom-variable-hybrid-mode.spec.ts` passed on chromium (mobile cases skipped in current run config).
- Completed (2026-02-10): Track 1 editor-model extraction slice:
  - extracted `custom-variable-editor-model.ts` for id generation, timing fallback resolution, and validate/normalize composition,
  - rewired `ConfigCustomVariableForm.svelte` submit paths to use model helpers,
  - reduced container size from 568 lines to 501 lines.
  - Validation:
    - `bun run --filter @retirement/calculator test` passed.
    - `bun run --filter e2e test tests/add-custom-variable.spec.ts --project=chromium` passed.
    - `bun run --filter e2e test tests/custom-variable-hybrid-mode.spec.ts` passed on chromium (mobile cases skipped in current run config).
- Completed (2026-02-10): Track 1 state/controller extraction slice:
  - extracted `custom-variable-editor-state.ts` for edit-state hydration, draft-reset defaults, date formatting, parsed calendar dates, and calendar bounds,
  - extracted `custom-variable-timing-controller.ts` for debounced parse scheduling/flush/cleanup logic,
  - rewired `ConfigCustomVariableForm.svelte` to use these modules while preserving behavior and selectors.
  - Validation:
    - `bun run --filter @retirement/calculator test` passed.
    - `bun run --filter e2e test tests/add-custom-variable.spec.ts --project=chromium` passed.
    - `bun run --filter e2e test tests/custom-variable-hybrid-mode.spec.ts` passed on chromium (mobile cases skipped in current run config).
- Completed (2026-02-10): Track 1 discriminated props contract slice:
  - refactored `ConfigCustomVariableForm.svelte` props to a create/edit discriminated union,
  - edit-only callbacks (`onSaveVariable`, `onDeleteVariable`, `onCancel`) are now required in edit mode and no longer optional at runtime call sites.
  - Validation:
    - `bun run --filter @retirement/calculator test` passed.
    - `bun run --filter e2e test tests/add-custom-variable.spec.ts --project=chromium` passed.
    - `bun run --filter e2e test tests/custom-variable-hybrid-mode.spec.ts` passed on chromium (mobile cases skipped in current run config).
    - `bun run --filter webapp check` passed (0 errors, warnings unchanged).

## Scope
This spec covers two implementation tracks:
1. Unify custom variable create/edit into a single composable form architecture.
2. Extract custom variable parsing/validation/normalization into shared utilities exposed by calculator for reuse beyond Svelte UI.

This spec does **not** change calculator math semantics, contribution timing semantics, or projection rendering.

## Goals
- Remove create/edit divergence in `ConfigCustomVariableForm.svelte`.
- Reduce component size and improve composability and testability.
- Eliminate validation/normalization drift between UI and schema/domain logic.
- Make core custom-variable rules reusable from CLI and future services.

## Non-goals
- Reworking entire `RootForm` accordion structure.
- Replacing `sveltekit-superforms`.
- Shipping new end-user features beyond parity.

---

## Track 1: Unified Create/Edit Form

### Why
Current implementation has two parallel code paths in one 900+ line component:
- create mode: superforms-backed fields
- edit mode: local state + manual inputs

This causes:
- duplicated timing and growth UI blocks
- duplicated save pipeline (parse -> validate -> normalize -> persist)
- inconsistent field wrappers and error behavior
- higher bug surface when adding fields/rules

### Desired architecture
Create one field-composition system used by both modes with mode-specific adapters only where necessary.

### Proposed component boundaries

1. `ConfigCustomVariableEditor.svelte` (container/orchestrator)
- Receives current draft or editable variable model.
- Owns submit/cancel/delete actions.
- Wires callbacks to parent (`onSaveVariable`, `onDeleteVariable`, `onCancel`).

2. `CustomVariableCoreFields.svelte`
- Name, type, amount.
- Uses shared numeric and toggle controls.

3. `CustomVariableTimingFields.svelte`
- Natural language timing input, parse feedback, structured day/month/year fields, placement.

4. `CustomVariableGrowthFields.svelte`
- Growth enable toggle, growth type, amount, cadence.

5. `CustomVariableYearRangeFields.svelte`
- Start year / end year.

6. `custom-variable-editor-model.ts`
- Converts between form state and domain input/output shape.
- Defines `EditorMode = 'create' | 'edit'` and discriminated props.

### Data flow
- Parent provides initial model and mode.
- Shared fields update one `editorState` shape.
- Submit calls shared domain pipeline:
  1) parse timing text
  2) validate
  3) normalize/clamp
  4) emit variable

### Type contract changes
Replace optional callback props with discriminated prop union:

- `CreateEditorProps`
  - `mode: 'create'`
  - `onCreate(variable)` required

- `EditEditorProps`
  - `mode: 'edit'`
  - `variable` required
  - `onSave(variable)` required
  - `onDelete()` required
  - `onCancel()` required

This prevents invalid combinations at compile time.

### Migration plan
1. Extract shared timing/growth/year-range snippets into separate components without behavior changes.
2. Introduce `editorState` model used by both modes.
3. Route create and edit submit actions through shared domain utilities (Track 2).
4. Replace old mode-specific inline markup with shared components.
5. Remove dead state, duplicate parse/validate functions.

### Acceptance criteria
- No duplicated create/edit markup for timing/growth/year range.
- Single save pipeline used by both modes.
- Type system rejects invalid prop combinations.
- Existing e2e tests for add/update variable still pass.

### Risks
- UI regression in field-level error rendering.
- Event timing changes around debounce parse.

### Mitigations
- Add focused component tests for submit + parse error flows.
- Keep old CSS classnames where possible during extraction.

---

## Track 2: Shared Domain Utilities (Calculator-exposed)

### Why
Rules currently exist inside a Svelte component, making them hard to test and impossible to reuse cleanly from CLI.

Shared utilities ensure one canonical implementation for:
- timing phrase parsing
- validation
- normalization/clamping
- id generation strategy hooks

### Proposed package location
- `packages/calculator/src/lib/utils/custom-variable.ts`

Export from:
- `packages/calculator/src/index.ts`

### Proposed API

```ts
export type CustomVariableDraftInput = {
  name: string;
  type: 'flat' | 'salaryPercent';
  amount: number;
  timingNaturalText: string;
  placement: 'start' | 'end';
  yearStart: number;
  yearEnd: number;
  growthEnabled: boolean;
  growthType: 'percent' | 'flat';
  growthAmount: number;
  growthCadence: 'annual' | 'monthly';
};

export type ParsedTiming = {
  frequency: 'monthly' | 'annual' | 'oneTime';
  day: number;
  month: number;
  year: number;
  summary: string;
};

export function parseCustomVariableTiming(
  input: string,
  now?: Date,
): ParsedTiming | null;

export function validateCustomVariableInput(
  input: CustomVariableDraftInput,
  parsedTiming: ParsedTiming,
): string | null;

export function normalizeCustomVariableInput(
  input: CustomVariableDraftInput,
  parsedTiming: ParsedTiming,
): {
  name: string;
  type: 'flat' | 'salaryPercent';
  amount: number;
  frequency: 'monthly' | 'annual' | 'oneTime';
  placement: 'start' | 'end';
  timingNaturalText: string;
  timingDay: number;
  timingMonth: number;
  timingYear: number;
  yearStart: number;
  yearEnd: number;
  growthEnabled: boolean;
  growthType: 'percent' | 'flat';
  growthAmount: number;
  growthCadence: 'annual' | 'monthly';
};
```

### CLI use cases
1. Config lint/check command can reuse validator when users provide custom variables.
2. Future `retirement add-custom-variable` command can parse natural-language timing exactly like UI.
3. Test fixtures can be generated and normalized consistently across app + cli.

### Implementation details
- Move month token map and regex parser logic into utility module.
- Keep parser deterministic (pass `now` for tests).
- Keep error strings centralized as exported constants.
- UI wraps utility errors into field/form errors as needed.

### Backward compatibility
- Preserve current accepted timing phrase patterns.
- Preserve clamping bounds (day 1..31, month 1..12, year 2000..2200, etc.).

### Testing plan
- Unit tests in calculator package:
  - monthly parse cases
  - annual parse cases
  - one-time parse cases
  - invalid parse cases
  - validation boundaries
  - normalization clamping behavior
- Webapp tests:
  - ensure add/edit flows still produce expected `customVariables` form state.

### Rollout plan
1. Add utility module + tests in calculator.
2. Export from calculator index.
3. Replace local functions in `ConfigCustomVariableForm.svelte` with utility calls.
4. Run webapp + e2e tests.
5. Remove dead local parser/validator code.

### Acceptance criteria
- `ConfigCustomVariableForm.svelte` no longer contains parser/validator/clamp business logic.
- Parser/validator utilities are imported from calculator package.
- Calculator tests cover all parsing/validation branches.

---

## Base Variable Note (Testing Fixture)
Built-in/base contribution variables are currently test fixtures. Product copy should state this explicitly in the contribution section until production data replaces fixture rules.
