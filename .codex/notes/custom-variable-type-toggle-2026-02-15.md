# Custom Variable Type Toggle Regression (2026-02-15)

## Problem
In the custom variable editor, clicking the currently selected `Type` toggle option (`Amount $` or `Percent %`) could clear the selection (`aria-checked=false` for both options).

## Root Cause
`ToggleGroup.Root` (single mode) can emit an invalid/empty value when re-clicking an active item. That value propagated into `customVariableDraft.type` / `customVariableEditDraft.type`, leaving no selected option.

## Fix
Updated `CustomVariableCoreFields.svelte` to keep a `lastValidType` and restore it whenever the toggle emits an invalid value. This protects both create and edit custom variable forms.

## Test Coverage
Added e2e regressions for:
- create form: active type click keeps selection
- edit form: active type click keeps selection

Mobile project skips were added for these two regressions due existing viewport/actionability constraints in custom variable controls.
