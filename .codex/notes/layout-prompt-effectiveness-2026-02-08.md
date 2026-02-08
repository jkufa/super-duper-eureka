# Prompt Effectiveness: Layout + Breakpoint Tuning

Date: 2026-02-08

## Prompts Used

1. `help me fix the layout in +page.svelte. I want two columns that are independently scrollable`
2. `Looks good; I made some tweaks to get it closer to what I want. Next step is determining the breakpoint that the columns stack. when the chart/table column is around 668px the table stops shrinking.

1. Use e2e to find the exact size the table stops shrinking, get the viewport, and extrapolate that into a --breakpoint-* tailwindcss variable`
3. `tailwind docs on theme variables: https://tailwindcss.com/docs/theme`

## Why These Prompts Worked Well

- Clear file target and behavior target: `+page.svelte` and “independently scrollable columns” removed ambiguity.
- Iterative direction: you validated the first pass, then narrowed scope to one measurable next step (stack breakpoint).
- Quantitative hint: “around 668px” gave a strong initial hypothesis while still asking for exact measurement.
- Method constraint: “Use e2e” forced objective validation instead of visual guessing.
- Implementation constraint: “--breakpoint-* tailwindcss variable” made the final output format explicit.
- Source alignment: linking Tailwind theme docs reduced interpretation drift on syntax.

## What This Enabled Technically

- Fast structural fix first (independent scroll containers).
- Measurement pass via Playwright viewport sweep to find the precise clamp point.
- Direct conversion to Tailwind token (`--breakpoint-table-fit`) and immediate class usage (`table-fit:*`).

## Reusable Prompt Pattern

Use this pattern when you want high-precision UI changes in one pass:

1. Scope + file:
   `Fix [behavior] in [file/path].`
2. Acceptance criteria:
   `I want [specific UX behavior].`
3. Measurement method:
   `Use e2e to measure [threshold], report exact viewport, then implement it.`
4. Output format constraint:
   `Encode result as [design token/config variable/class].`
5. Spec reference (optional but strong):
   `Use this doc: [URL].`

## Example Copy/Paste Prompt

`Fix layout in apps/webapp/src/routes/+page.svelte. I need two columns that scroll independently. Then use e2e to find the exact viewport where the left table stops shrinking, and convert that into a Tailwind --breakpoint-* theme variable used by the stacking class. Use https://tailwindcss.com/docs/theme for syntax.`
