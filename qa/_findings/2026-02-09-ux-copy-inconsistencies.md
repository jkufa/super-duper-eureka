# UX Copy Consistency Audit (Webapp)

Date: 2026-02-09  
Scope: `apps/webapp/src` user-facing copy in primary app flows (navigation, config form, projection views, debugger UI, validation messages)

## Findings

1. Capitalization mismatch for the same heading
- `Retirement Configuration` in desktop sidebar: `apps/webapp/src/routes/+page.svelte:89`
- `Retirement configuration` in mobile drawer: `apps/webapp/src/routes/+page.svelte:115`
- Impact: Same concept appears as both Title Case and sentence case depending on viewport.

2. Same concept named three different ways (`currentBalance`)
- Accordion section: `Current Investments`: `apps/webapp/src/lib/components/RootForm.svelte:31`
- Field label: `Current Balance`: `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:19`
- Validation message: `Current investments must be positive`: `apps/webapp/src/lib/forms/retirement-config-form.ts:5`
- Impact: Users may think these are different financial values.

3. Validation message conflicts with actual rule
- Rule allows `0` (`min(0)`): `apps/webapp/src/lib/forms/retirement-config-form.ts:5`
- Message says `must be positive`: `apps/webapp/src/lib/forms/retirement-config-form.ts:5`
- Impact: “Positive” implies `> 0`, but `0` is accepted.

4. “Contribution” terminology is inconsistent (`rules` vs `variables`)
- Section name: `Custom Variables`: `apps/webapp/src/lib/components/RootForm.svelte:52`
- Empty state: `No contribution rules configured.`: `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:43`
- Add form heading/CTA: `Add custom variable` / `Add new variable`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:143`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:369`
- Impact: unclear object model (rule vs variable vs contribution).

5. Abbreviation style is inconsistent in field labels
- `Est. Annual Return`: `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:36`
- Nearby labels are fully written (`Variance`, `Base Salary`, `Years to Retirement`): `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:47`, `apps/webapp/src/lib/components/form/ConfigSalarySection.svelte:19`, `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:30`
- Impact: mixed shorthand style in adjacent inputs.

6. Grammar inconsistency in compounding label
- Label uses `Compound Frequency`: `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:59`
- Domain object uses `compounding`: `apps/webapp/src/lib/forms/retirement-config-form.ts:9`
- Impact: minor language mismatch (“Compound” noun/adjective vs “Compounding”).

7. Case style shifts between adjacent controls in same area
- `Custom Variables` (Title Case section): `apps/webapp/src/lib/components/RootForm.svelte:52`
- `Add custom variable` (sentence case subsection): `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:143`
- Impact: heading hierarchy looks stylistically uneven.

8. Action wording for same workflow is not aligned
- Section prompt: `Add custom variable`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:143`
- Button label: `Add new variable`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:369`
- Impact: inconsistent CTA phrasing for one action.

9. Labeling pattern for percent/amount controls is inconsistent
- Type options: `Percent %` and `Amount $`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:176`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:177`
- Amount field label flips between `Amount %` and `Amount $`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:188`
- Impact: symbol placement and wording are functional but uneven; feels improvised.

10. “Value / balance / investments” terms vary across projection and config
- Chart/table use `Portfolio Value`: `apps/webapp/src/lib/components/projection/ProjectionChart.svelte:15`, `apps/webapp/src/lib/components/projection/ProjectionTable.svelte:32`
- Input uses `Current Balance`: `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:19`
- Section uses `Current Investments`: `apps/webapp/src/lib/components/RootForm.svelte:31`
- Impact: same financial idea is framed with three terms.

11. Debugger copy style is mixed (title case vs sentence case)
- Panel title: `Debugger`: `apps/webapp/src/lib/components/debug/DebuggerPanel.svelte:220`
- Accordion item: `Event details` (sentence case) next to `Configuration` (title-ish): `apps/webapp/src/lib/components/debug/DebuggerPanel.svelte:247`, `apps/webapp/src/lib/components/debug/DebuggerPanel.svelte:254`
- Impact: inconsistent section naming style in one compact UI.

12. Copy verb labels are fragmented in debugger controls
- `Copy` (JSON block): `apps/webapp/src/lib/components/debug/DebugJsonBlock.svelte:30`
- `Copy all` (panel): `apps/webapp/src/lib/components/debug/DebuggerPanel.svelte:226`
- Default component label `Copy JSON`: `apps/webapp/src/lib/components/debug/DebugCopyButton.svelte:7`
- Impact: same interaction family has three labels without a defined pattern.

13. Product naming and tone mismatch at top level
- App name: `Better Retirement Calculator`: `apps/webapp/src/lib/components/Nav.svelte:6`
- Functional headings elsewhere are plain (`Projection Summary`, `Retirement Configuration`, `Table View`): `apps/webapp/src/lib/components/projection/ProjectionChart.svelte:128`, `apps/webapp/src/routes/+page.svelte:89`, `apps/webapp/src/lib/components/projection/ProjectionTable.svelte:23`
- Impact: brand voice (“Better…”) feels inconsistent with otherwise utilitarian copy.

## Suggested Normalization Baseline

1. Pick one case style for section headings and apply everywhere (recommended: Title Case).
2. Standardize primary financial nouns:
- `Current Balance`
- `Portfolio Value`
- `Contribution` or `Variable` (choose one model term and keep it consistent)
3. Standardize action labels:
- `Add Variable` (or `Add Custom Variable`) everywhere
- `Copy` + scope suffix pattern (for example: `Copy`, `Copy All`, `Copied`)
4. Use full words in form labels unless abbreviation is universally used (replace `Est.`).
5. Update validation language to match actual constraints (for `min(0)`, use “0 or greater” / “non-negative”).

## Form UX Copy Deep-Dive (Placeholders, Errors, Missing Guidance)

1. Numeric placeholders are missing across core config fields
- Shared numeric input component does not provide a placeholder prop or default placeholder: `apps/webapp/src/lib/components/form/ConfigNumericField.svelte:151`
- Affects:
`Current Balance`, `Years to Retirement`: `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:19`, `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:30`
`Est. Annual Return`, `Variance`: `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:36`, `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:47`
`Base Salary`, `Raise by`: `apps/webapp/src/lib/components/form/ConfigSalarySection.svelte:19`, `apps/webapp/src/lib/components/form/ConfigSalarySection.svelte:30`
dynamic contribution amount fields: `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:46`
- Risk: empty fields have no example format, unit expectation, or realistic input cue.

2. Only one field has custom validation copy; others rely generic defaults
- Custom message exists only for `currentBalance`: `apps/webapp/src/lib/forms/retirement-config-form.ts:5`
- Fields with numeric constraints but no custom copy:
`annualReturnPct`, `variancePct`, `yearsToRetirement`, `baseSalary`, `annualRaisePct`, contribution amounts: `apps/webapp/src/lib/forms/retirement-config-form.ts:6`, `apps/webapp/src/lib/forms/retirement-config-form.ts:7`, `apps/webapp/src/lib/forms/retirement-config-form.ts:8`, `apps/webapp/src/lib/forms/retirement-config-form.ts:10`, `apps/webapp/src/lib/forms/retirement-config-form.ts:11`, `apps/webapp/src/lib/forms/retirement-config-form.ts:15`
- Risk: users get uneven quality in errors (one plain-English message, many generic validator strings).

3. One custom validation message is semantically wrong for the actual rule
- Rule is `min(0)` but message says `must be positive`: `apps/webapp/src/lib/forms/retirement-config-form.ts:5`
- Risk: “positive” contradicts accepted value `0`, reducing trust in form feedback.

4. Draft variable name field is effectively missing schema-level required error copy
- Schema currently allows empty string (`z.string()` only): `apps/webapp/src/lib/forms/retirement-config-form.ts:27`
- UI still renders field-level errors for that field: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:162`
- Required behavior is implemented only in custom submit logic (`Variable name is required.`): `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:72`
- Risk: error behavior is split between schema and custom branch logic; field-level UX can be inconsistent.

5. Add-variable errors are not anchored to specific inputs
- Errors render as one generic block under the form: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:362`
- Messages (`Variable name is required.`, `Amount must be 0 or greater.`) are not attached to the specific invalid field instance: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:72`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:73`
- Risk: users must infer which input failed, especially on mobile when fields may be partially out of view.

6. Placeholder quality is uneven where placeholders do exist
- Variable name placeholder is specific (`Annual Bonus`) and implies one contribution pattern only: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:154`
- No equivalent examples exist for other form sections, so affordance quality differs by section.

7. Missing helper/error guidance for bounded percentage fields
- Percent fields are range-limited to 0-50 in schema: `apps/webapp/src/lib/forms/retirement-config-form.ts:6`, `apps/webapp/src/lib/forms/retirement-config-form.ts:7`, `apps/webapp/src/lib/forms/retirement-config-form.ts:11`
- Labels/placeholders/helper copy do not communicate this limit before error state.
- Risk: preventable trial-and-error for out-of-range entries.

## Form Copy Recommendations

1. Add per-field placeholder examples for all numeric inputs (or add short helper text where placeholders are avoided).
2. Define explicit, plain-language messages for every schema constraint (min/max/int/enum), not just one field.
3. Align wording with rules (`0 or greater` instead of `positive` where `0` is valid).
4. Move add-variable validation messaging into field-level errors so each message appears under its own input.
5. Add pre-emptive guidance for bounded fields (for example, “0 to 50%”) to reduce avoidable errors.

## Form Spacing Consistency Audit

1. Vertical rhythm differs between standard sections and custom-variable card
- Standard sections use `space-y-4`: `apps/webapp/src/lib/components/form/ConfigBasicsSection.svelte:15`, `apps/webapp/src/lib/components/form/ConfigGrowthSection.svelte:31`, `apps/webapp/src/lib/components/form/ConfigSalarySection.svelte:15`, `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:73`
- Custom variable form root uses tighter `space-y-3`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:142`
- Impact: one section feels visually denser than the others even though it belongs to the same accordion system.

2. Large jump before custom-variable block breaks flow
- Root form places custom-variable form with `mt-8` and `-mx-4`: `apps/webapp/src/lib/components/RootForm.svelte:59`
- Accordion content itself already has `py-4`: `apps/webapp/src/lib/components/RootForm.svelte:53`
- Impact: larger-than-normal separation below the accordion compared with internal section spacing.

3. Nested spacing stacks compound unevenly
- Outer wrappers: `section space-y-5` + `form space-y-4`: `apps/webapp/src/lib/components/RootForm.svelte:27`, `apps/webapp/src/lib/components/RootForm.svelte:28`
- Each accordion panel adds `py-4`: `apps/webapp/src/lib/components/RootForm.svelte:32`, `apps/webapp/src/lib/components/RootForm.svelte:39`, `apps/webapp/src/lib/components/RootForm.svelte:46`, `apps/webapp/src/lib/components/RootForm.svelte:53`
- Inner sections add their own `space-y-*`.
- Impact: spacing is controlled by multiple layers, making section-to-section distance hard to reason about and easy to drift.

4. Contribution rows have extra per-item spacing not present in other sections
- Each contribution row wraps field + action row in `space-y-2`: `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:129`
- Action row adds `mt-1`: `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:143`
- Impact: contribution fields carry additional vertical padding vs comparable numeric fields in other sections.

5. Breakpoint-dependent spacing/position behavior is inconsistent for row actions
- Mobile: action row is in normal flow (`mt-1 flex ...`): `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:143`
- Desktop: action row becomes `absolute` (`md:absolute md:top-7 md:left-full md:mt-0`): `apps/webapp/src/lib/components/form/ConfigContributionSection.svelte:143`
- Impact: action spacing appears/disappears by viewport and can feel detached from the associated input on desktop.

6. Create vs edit mode in custom-variable form uses different spacing systems
- Create mode relies on `Form.Field` + `Form.Control` wrappers: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:146`
- Edit mode uses manual blocks with `div.space-y-1.5`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:253`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:267`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:275`
- Impact: same form surface has two different vertical rhythms and label/input spacing behavior depending on mode.

7. Error spacing is inconsistent between field-level and form-level errors
- Field errors render directly after controls (no explicit top margin class): `apps/webapp/src/lib/components/form/ConfigNumericField.svelte:184`, `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:162`, `apps/webapp/src/lib/components/ui/form/form-field-errors.svelte:18`
- Form-level submit error is a standalone paragraph after all fields: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:362`
- Impact: error spacing varies by validation path and can create irregular gaps.

8. Footer/action spacing differs by mode without a shared pattern
- Create mode uses one full-width CTA with `mt-2`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:367`
- Edit mode uses a 3-button row with `mt-2 flex flex-wrap gap-2`: `apps/webapp/src/lib/components/form/ConfigCustomVariableForm.svelte:372`
- Impact: action area height and whitespace footprint changes significantly between modes.

## Form Spacing Recommendations

1. Define one vertical spacing scale for form internals (for example: section gap, field gap, label-control gap, error gap, action gap) and apply it uniformly.
2. Normalize section internals to a single baseline (`space-y-4` or `space-y-3`) across all form sections, including custom-variable forms.
3. Replace ad hoc margin stacking (`mt-8`, nested `py-4` + `space-y-*`) with one owner of vertical rhythm per layer.
4. Standardize action-row placement for contribution fields so the controls remain consistently aligned across breakpoints.
5. Unify create/edit mode layout primitives so both modes use the same spacing system and error spacing behavior.
