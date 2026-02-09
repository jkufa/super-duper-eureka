# Custom Variable Growth (Optional) - Implementation Spec

Date: 2026-02-09
Owner: Webapp + Calculator + CLI

## 1. Problem Statement
Custom variables currently support:
- contribution type
- amount
- frequency
- placement
- year range

They do not support per-variable growth/increment over time.

## 2. Current Gap
`RetirementConfig` / `ContributionRule` has no field for per-rule growth.
- Source: `packages/calculator/src/lib/types.ts`
- Impact: UI can collect growth inputs, but calculator cannot apply them.

## 3. Goal
Add an optional per-contribution growth model that adjusts a rule's `amount` over time.

## 4. Proposed Data Model
### 4.1 Calculator Types
Update `ContributionRule` in `packages/calculator/src/lib/types.ts`:

```ts
export interface ContributionGrowth {
  type: 'percent' | 'flat';
  amount: number; // percent points if type='percent'; currency/absolute units if type='flat'
  cadence: 'annual' | 'monthly';
}

export interface ContributionRule {
  // existing fields...
  growth?: ContributionGrowth;
}
```

Validation expectations:
- `growth.amount >= 0`
- no growth if `growth` is omitted

### 4.2 Webapp Form Model
Extend `customVariables[]` and `customVariableDraft` in `apps/webapp/src/lib/forms/retirement-config-form.ts`:
- `growthEnabled: boolean`
- `growthType: 'percent' | 'flat'`
- `growthAmount: number`
- `growthCadence: 'annual' | 'monthly'`

Mapping into `ContributionRule`:
- when `growthEnabled === true`, include `growth` object
- when false, omit `growth`

## 5. Calculator Behavior
### 5.1 Effective Contribution Amount
In `packages/calculator/src/lib/calculator.ts`, compute an effective rule amount for each step.

Given:
- `baseAmount = rule.amount`
- `growth` optional
- `yearIndex` and `monthOffset`

If `growth` missing: effective amount = `baseAmount`

If `growth.cadence === 'annual'`:
- `n = yearIndex`

If `growth.cadence === 'monthly'`:
- `n = yearIndex * 12 + monthIndex`

Then:
- `type='percent'`: `effective = baseAmount * (1 + growth.amount / 100) ^ n`
- `type='flat'`: `effective = baseAmount + growth.amount * n`

Guardrails:
- clamp final effective amount at `>= 0`
- keep existing `salaryBasis` logic; use `effective` in place of `rule.amount`

### 5.2 Interaction with Year Range
- Growth index `n` should be anchored to projection start (not rule start), then rule is still filtered by `yearRange`
- If a different anchor is desired later (rule activation start), add it explicitly as a future option

## 6. UI/UX Requirements
In add custom variable form:
- Add a "Growth (optional)" section
- Controls:
  - toggle: increment type (`percent` / `flat`)
  - numeric input: growth amount
  - toggle: cadence (`annual` / `monthly`)
  - optional enable switch/toggle to reduce accidental growth config

Display behavior:
- if disabled, growth fields hidden/collapsed and no growth saved
- amount adornments should mirror selected growth type (`%` or `$`)

## 7. Implementation Tasks
1. Types
- Add `ContributionGrowth` + optional `growth` field in calculator types.

2. Calculator
- Add helper: `resolveEffectiveRuleAmount(rule, yearIndex, monthIndex)`.
- Replace direct `rule.amount` usage in `resolveContributionAmount` with effective amount.

3. Form schema + mapping
- Extend zod schema defaults and mapping in `retirement-config-form.ts`.
- Include growth in `customVariables` persisted entries.

4. Add custom variable form
- Add Growth section fields using existing `Form.Field`/`ConfigNumericField` patterns.

5. Serialization / examples
- Add at least one CLI example JSON with growth.

## 8. Testing Plan
## 8.1 CLI Testing
Add `packages/cli/examples/custom-growth.json` with:
- one flat custom rule + annual percent growth
- one salaryPercent custom rule + monthly flat growth (absolute amount points)

Run:
- `bun run retirement-calc --config packages/cli/examples/custom-growth.json`
- `bun run retirement-calc --config packages/cli/examples/custom-growth.json --debug --no-interactive --raw`

Assertions:
- projection runs without error
- yearly contribution totals increase according to growth settings
- debug steps show increasing contribution amounts over time

## 8.2 Unit Testing (Calculator)
File: `packages/calculator/src/lib/__testing__/calculator.test.ts`

Add focused tests:
1. no growth: baseline unchanged
2. annual percent growth on flat amount
- expected sequence at year boundaries (e.g., 100, 110, 121)
3. monthly percent growth on flat amount
- expected per-month compounding
4. annual flat growth
- expected arithmetic sequence (e.g., 100, 120, 140)
5. monthly flat growth
- month-over-month increment
6. growth + yearRange
- verify no contributions outside range, growth formula still deterministic
7. growth on salaryPercent rule
- verify effective percent changes and salary-basis computation remains valid
8. invalid values
- negative growth amount rejected by schema

Command:
- `bun run --filter @retirement/calculator test`

## 8.3 E2E Testing (Webapp)
Add new tests in `apps/e2e/tests/add-custom-variable.spec.ts` or separate `custom-variable-growth.spec.ts`:

1. renders Growth section
- verify controls visible when enabled

2. adds variable with growth config
- create custom variable with growth enabled
- verify variable appears in custom variable list

3. projection reacts to growth setting
- compare baseline vs growth-enabled result (final balance / annual contribution should increase)

4. persistence in form state
- modify growth fields, blur/commit, ensure values remain displayed and are used

Run:
- `bun run --filter e2e test -- --project=chromium apps/e2e/tests/custom-variable-growth.spec.ts`

## 9. Backward Compatibility
- Existing configs without `growth` continue to work unchanged.
- `growth` is optional and defaults to absent.

## 10. Acceptance Criteria
- A custom variable can be created with optional growth configuration.
- Calculator applies growth deterministically per step.
- CLI example demonstrates growth behavior.
- Unit tests cover growth math and edge cases.
- E2E validates UI + config integration + projection impact.

## 11. Out of Scope (for this phase)
- Negative growth/decrement UX.
- Distinct growth anchor semantics (e.g., anchor at rule activation year).
- Editing/deleting existing custom variables (unless already implemented separately).
