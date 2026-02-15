# Frequency NLP

This folder owns custom-variable timing natural language parsing.

Current scope (v1):

- Monthly cadence (`every 15th`, `monthly on 3rd`)
- Annual cadence (`every feb 13`, `annually on september 30`)
- One-time date parsing via `chrono-node` (`on 1/2/2027`)
- Range modifiers (`for N years`, `starting in YYYY`, `beginning in YYYY`, `from YYYY`, `until YYYY`)
- Annual month/day validity is checked via shared calculator utility (`@retirement/calculator`).

## Future v2 (not implemented)

If we choose to support additional NLP patterns later, the minimum changes should be:

1. Extend `parseRecurringTiming` in `index.ts`:

- Add patterns for:
  - `every other month`
  - `every quarter`
  - `every 2 months`
- Keep returning canonical timing fields (`frequency`, `day`, `month`, `year`).

2. Extend range resolution in `resolveYearRange`:

- Add handling for quarter/every-N-month cadence conversion into calculator-compatible scheduling.
- Continue clamping all range output to projection horizon.

3. Keep parser deterministic:

- Prefer explicit regex parses before chrono fallback.
- Reject ambiguous phrases instead of guessing.

4. Add tests in `index.test.ts`:

- Positive and negative cases for each new phrase.
- Horizon clamping and off-by-one checks for computed `yearStart`/`yearEnd`.
- Regression checks for existing v1 phrases.

5. Keep UI/API unchanged:

- `ConfigCustomVariableForm.svelte` should continue consuming only parser output.
- Do not reintroduce manual year-range inputs.
