# Form Components Audit

Scope:

- `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte`
- `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte`
- `apps/webapp/src/lib/components/form/ConfigSalarySection.svelte`
- `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte`

## 0) Lint errors

- Ran: `bunx eslint src/lib/components/form src/lib/components/projection` (from `apps/webapp`)
- Result for this folder: no ESLint errors.

## 1) Svelte best-practices analysis

- Good:
  - Clear section boundaries and good use of `sveltekit-superforms` proxies.
  - Form controls consistently pipe through `Form.Field`/`Form.Control`/`Form.FieldErrors`.
- Improvement opportunities:
  - Repeated inline `onblur` callbacks in templates make behavior harder to test and reason about (`ConfigBasicsSection.svelte:41`, `ConfigBasicsSection.svelte:63`, `ConfigGrowthSection.svelte:40`, `ConfigGrowthSection.svelte:69`, `ConfigSalarySection.svelte:40`, `ConfigSalarySection.svelte:64`, `ConfigContributionSection.svelte:36`).
  - Numeric inputs are all `type="text"` with manual blur coercion. This is valid, but currently spreads parsing/defaulting logic across many components (`ConfigBasicsSection.svelte:39`, `ConfigBasicsSection.svelte:61`, `ConfigGrowthSection.svelte:38`, `ConfigGrowthSection.svelte:67`, `ConfigSalarySection.svelte:38`, `ConfigSalarySection.svelte:62`, `ConfigContributionSection.svelte:34`).
  - `compounding` change handling is manually guarded inline (`ConfigGrowthSection.svelte:94`), which is easy to drift if options expand.

## 2) Duplicate code / code smells

- High duplication:
  - Same `numberProxy(..., { empty: 'undefined', initiallyEmptyIfZero: false })` pattern repeated in every file.
  - Same currency/percent adornment layout and class strings repeated.
  - Same empty-to-zero blur normalization repeated.
- Structural smell:
  - Each section manually repeats similar field scaffolding; behavior changes will require many edits.

## 3) Refactor / cleanup / consolidation recommendations

1. Introduce a reusable numeric field component.
   - Suggested API:
     - `name`, `label`, `form`, `kind` (`int` | `number`), `prefix`, `suffix`, `emptyFallback`.
   - Centralize:
     - proxy creation
     - blur normalization
     - shared markup (`Form.Field`, `Input`, adornments, `FieldErrors`)
2. Move normalization handlers out of inline markup.
   - Example: `normalizeEmptyTo(valueStore, '0')` helper to avoid repeated closures.
3. Use a typed union helper for compounding updates.
   - Example: `isCompounding(value): value is 'monthly' | 'daily'`.
4. Consider config-driven rendering for similar sections.
   - A field descriptor list can reduce repetitive component code and make new fields cheaper to add.
5. Optional semantic cleanup:
   - Wrap each logical section in `Form.Fieldset`/legend UI primitives for stronger form semantics if that matches design intent.
