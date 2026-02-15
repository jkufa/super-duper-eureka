# Custom Variable Percent Basis (2026-02-15)

## Problem
- Custom variable `salaryPercent` rules from the webapp did not set `salaryBasis`.
- Calculator defaulted missing `salaryBasis` to `annual`, so monthly frequency + percent behaved like `amount% of annual salary each month`.

## Changes
- In `applyRetirementConfigFormValues`, map percent variable salary basis by frequency:
  - `monthly` -> `salaryBasis: "monthly"`
  - `annual` and `oneTime` -> `salaryBasis: "annual"`
- Added tooltip support to `ConfigNumericField` labels using shadcn tooltip primitives.
- Added dotted underline + tooltip on custom variable amount label when type is `salaryPercent`.
- Added regression test in `retirement-config-form.test.ts` asserting the frequency-to-basis mapping.

## Validation
- `bun test apps/webapp/src/lib/forms/retirement-config-form.test.ts`
- `bun test apps/webapp/src/lib/forms/retirement-config-form.test.ts apps/webapp/src/lib/components/form/custom-variable-editor-actions.test.ts`
- `bun run --filter webapp check` (passes; existing warnings remain)
- `bun run --filter webapp lint` fails due pre-existing repo-wide Prettier drift unrelated to this change.
