# Webapp UX Copy Normalization Baseline

Date: 2026-02-09  
Scope: `apps/webapp/src` user-facing copy in core product flows

## 1) Case Style Standard

- Use **Title Case** for:
  - page titles
  - section headings
  - accordion labels
  - panel titles
- Use **Sentence case** for:
  - helper text
  - validation messages
  - empty states
- Use **imperative short labels** for action buttons:
  - `Add Custom Variable`
  - `Copy`
  - `Copy All`
  - success state: `Copied`

## 2) Canonical Domain Terms

Use these terms consistently and avoid synonyms unless meaning is actually different:

- `Current Balance`
  - Definition: current invested principal users start with.
  - Replace: `Current Investments` when referring to this same input.
- `Portfolio Value`
  - Definition: projected value over time shown in outputs.
- `Custom Variable`
  - Definition: user-defined recurring or one-time contribution/adjustment entry in config.
  - Replace generic use of `Contribution Rule` where it refers to the same object.
- `Compounding Frequency`
  - Preferred over `Compound Frequency`.

## 3) Labeling and Formatting Patterns

- Do not abbreviate common labels in forms:
  - Use `Estimated Annual Return`, not `Est. Annual Return`.
- Keep unit labeling explicit and consistent:
  - `Percent (%)`
  - `Amount ($)`
- Use one field label pattern for dynamic amount input:
  - `Value (%)` when type is percent
  - `Value ($)` when type is amount

## 4) Validation Copy Rules

- Validation copy must match schema constraints exactly.
- For `min(0)`, use `must be 0 or greater` or `must be non-negative`.
- Prefer field-specific, plain-language errors over generic validator messages.
- Required field message pattern:
  - `<Field Name> is required.`
- Numeric range message pattern:
  - `<Field Name> must be between <min> and <max>.`

## 5) Action Language Rules

- Same workflow uses same verb phrase everywhere.
- Add-variable workflow standard labels:
  - section title: `Add Custom Variable`
  - primary CTA: `Add Custom Variable`
- Copy workflow standard labels:
  - local copy action: `Copy`
  - aggregate action: `Copy All`
  - transient success: `Copied`

## 6) Brand Voice Guardrail

- Keep product tone concise and utilitarian in workflow UI.
- Avoid promotional adjectives in shell/navigation copy unless part of formal brand strategy.
- If app name remains `Better Retirement Calculator`, treat it as product-name proper noun and keep surrounding workflow labels functional and neutral.

## 7) Findings-to-Rule Traceability

| Finding ID | Issue Summary | Rule(s) That Resolve It |
| --- | --- | --- |
| 1 | Heading capitalization mismatch | 1 |
| 2 | `currentBalance` named 3 ways | 2, 4 |
| 3 | Message conflicts with `min(0)` | 4 |
| 4 | rules vs variables terminology drift | 2, 5 |
| 5 | Abbreviation inconsistency | 3 |
| 6 | `Compound` vs `compounding` grammar | 2 |
| 7 | Adjacent case style shifts | 1 |
| 8 | Add-variable CTA mismatch | 5 |
| 9 | Percent/amount label pattern drift | 3 |
| 10 | Value/balance/investments drift | 2 |
| 11 | Debugger case style mixed | 1 |
| 12 | Copy labels fragmented | 5 |
| 13 | Product naming tone mismatch | 6 |

## 8) Definition of Done for Chunk 1

- A single baseline doc exists with:
  - case style rules
  - canonical term glossary
  - action label patterns
  - validation message rules
  - findings-to-rule trace mapping
- Future chunks must reference this baseline before changing user-facing copy.
