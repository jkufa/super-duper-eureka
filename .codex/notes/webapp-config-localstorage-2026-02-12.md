# Webapp config localStorage module (2026-02-12)

## Summary
- Added `apps/webapp/src/lib/client/config/config-context.svelte.ts` with Svelte context + guarded localStorage get/set/clear for `RetirementConfig`.
- Added `apps/webapp/src/lib/client/config/config-store.svelte.ts` as a wrapper around live config derivation + persistence.
- Updated `apps/webapp/src/routes/+page.svelte` to derive `liveConfig` through the new store and hydrate form state from localStorage.

## Root cause + fix
- Initial implementation persisted server config immediately during first render, which overwrote existing localStorage before hydration could read it.
- Fixed by:
  - Adding a `persist` gate to `createRetirementConfigStore`.
  - Deferring persistence until localStorage hydration attempt completes.
  - Applying stored config to both `activeBaseConfig` and form state (`$formData` + `committedValues`) when present.

## Validation
- Added focused e2e: `apps/e2e/tests/localstorage-config.spec.ts`.
- Verified flow:
  1. Update form value.
  2. Confirm updated `RetirementConfig` is written to localStorage.
  3. Reload page.
  4. Confirm form is repopulated from localStorage, not server defaults.
