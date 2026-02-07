# Projection Components Audit

Scope:

- `apps/webapp/src/lib/components/projection/ProjectionChart.svelte`
- `apps/webapp/src/lib/components/projection/ProjectionTable.svelte`
- `apps/webapp/src/lib/components/projection/ProjectionKpiMetric.svelte`
- `apps/webapp/src/lib/components/projection/index.ts`

## 0) Lint errors

- Ran: `bunx eslint src/lib/components/form src/lib/components/projection` (from `apps/webapp`)
- Result for this folder: no ESLint errors.

## 1) Svelte best-practices analysis

- Good:
  - Strong use of `$derived` for computed chart/table data (`ProjectionChart.svelte:40`, `ProjectionTable.svelte:9`).
  - Clean separation between chart and table concerns.
- Improvement opportunities:
  - KPI section in `ProjectionChart.svelte` is hand-written despite having `ProjectionKpiMetric.svelte` available (`ProjectionChart.svelte:53`, `ProjectionKpiMetric.svelte:1`).
  - Some template objects are inline in markup (for `AreaChart` props/series), which can make future diffs noisier and reduce reuse (`ProjectionChart.svelte:105`, `ProjectionChart.svelte:112`).
  - Formatting policy differs between chart KPI values and reusable metric component (`ProjectionChart.svelte:62` sets `respectMotionPreference={false}` for one KPI, while `ProjectionKpiMetric.svelte:25` defaults to `true`).

## 2) Duplicate code / code smells

- Duplicate rendering pattern:
  - Three KPI blocks in `ProjectionChart.svelte` have near-identical structure and NumberFlow settings (`ProjectionChart.svelte:55`, `ProjectionChart.svelte:70`, `ProjectionChart.svelte:84`).
  - This duplicates logic that `ProjectionKpiMetric.svelte` already encapsulates.
- Minor smell:
  - Repeated currency format object literals in each KPI block (`ProjectionChart.svelte:64`, `ProjectionChart.svelte:78`, `ProjectionChart.svelte:92`) instead of shared formatter config.

## 3) Refactor / cleanup / consolidation recommendations

1. Use `ProjectionKpiMetric.svelte` inside `ProjectionChart.svelte`.
   - Define a small metrics config array and `#each` render metrics.
   - Benefits: less duplication, consistent animation/format behavior.
2. Extract chart `series` and `props` into top-level constants.
   - Keeps template compact and improves readability when chart options grow.
3. Standardize NumberFlow behavior across metrics.
   - Pick one `respectMotionPreference` policy and apply consistently.
4. Keep derived transforms pure and reusable.
   - If table/other views need `yearContribution`, move transformation to a shared util (e.g., `projection-view-model.ts`) to avoid recomputing logic in multiple components later.
