## Custom variable draft unification

- Added `customVariableEditDraft` to form schema/defaults so create and edit share the same draft shape.
- Refactored custom variable form components to consume a draft path (`customVariableDraft` or `customVariableEditDraft`) instead of mode-specific templates.
- Replaced local edit state in `ConfigCustomVariableForm.svelte` with superforms-backed `customVariableEditDraft`.
- Kept a shared parse/validate/normalize submit pipeline; persistence still branches only at append vs save callback.
- Removed growth enabled/disabled toggle from UI; growth is now optional via input values, and submit computes `growth.enabled` from `growthAmount > 0`.
- Updated related unit/e2e tests for growth UI changes.
- Validation status:
  - `bun run --filter webapp check` passes (warnings only).
  - `bun test apps/webapp/src/lib/components/form/custom-variable-editor-actions.test.ts` passes.
  - E2E desktop (`chromium`) passes for add/update custom variable specs.
  - E2E mobile still fails due create-form controls being outside viewport in current layout/test interaction.
