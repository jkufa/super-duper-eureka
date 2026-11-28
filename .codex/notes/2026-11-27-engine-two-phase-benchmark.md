# Engine two-phase split: benchmark

Spec 2 part B, 2026-11-27.

Command: `vp run @retirement/calculator#bench`. It runs `packages/calculator/scripts/bench.ts` on Node, then on Bun.

Reference case: 30 years from 2026-01-01, $250,000 at 6%, five rules (two salary-percent monthly rules, one with a day; an annual flat rule with flat growth; a monthly flat rule on day 28 with percent growth; an annual salary-percent rule). The schedule has 1,140 deposits.

Each figure is the median of 25 trials of 60 passes, on this machine, from three runs of the command.

| Runtime    | Mode    | 60 `compound` passes | 60 `calculateProjection` runs | 60 runs of the engine before the split |
| ---------- | ------- | -------------------- | ----------------------------- | -------------------------------------- |
| Node 24.13 | monthly | 2.0 to 2.1 ms        | 27 ms                         | 45 ms                                  |
| Node 24.13 | daily   | 13.7 to 13.8 ms      | 38 to 39 ms                   | 55 ms                                  |
| Bun 1.4.5  | monthly | 0.9 to 1.1 ms        | 27 ms                         | 33 ms                                  |
| Bun 1.4.5  | daily   | 5.1 to 5.5 ms        | 31 to 32 ms                   | 60 ms                                  |

The last column ran the engine from `test/engine-baseline` through the same script, once per runtime.

- `calculateProjection` time is almost all `buildSchedule`, which still uses `Date` objects for every month and rule.
- Bun was 10 ms slower on daily `compound` while the per-month day totals were a plain object keyed by day number. JavaScriptCore is slow to look up missing integer keys on such an object. A `Map` keyed by day number brought it from about 15 ms to about 4 ms, with Node at about 8 ms.
- The `Map` is now keyed by the day's string form, on insertion and on lookup. A plain object coerces its keys that way, and a config read from JSON can carry a day written as `"2"`, which a number-keyed `Map` stored under `"2"` and then missed when it looked up `2`. The string keys cost about 1 ms on Bun and 5 ms on Node for the 60 daily passes.
- The README's prototype loop (0.07 ms monthly, 1.5 ms daily on Bun) builds no output rows and groups no deposits. `compound` groups the flat schedule by month, totals each bucket and returns a row per month on every pass.
- Part F asks for one effective-rate solve under 1 ms monthly and under 5 ms daily. On Bun, monthly is at the limit and daily is just over.

## Effective-rate solve (spec 2 part F, 2026-11-28)

The same command now also times one `effectiveRate` solve: pooling the schedules, totalling each month's buckets once, then 60 final-balance-only passes. The case is the reference case as a scenario: 30 years from 2026-01-01, $250,000 split across three accounts at 7%, 6% and 4.5%, the same five rules spread over them (the annual months moved to 1-based, growth rules given a `startDate` of 2026-01-01). Each figure is the median of 201 solves, from three runs of the command.

| Runtime    | Mode    | One solve       | Target | 60 `compound` passes, same runs |
| ---------- | ------- | --------------- | ------ | ------------------------------- |
| Node 24.13 | monthly | 0.47 to 0.48 ms | 1 ms   | 2.3 ms                          |
| Node 24.13 | daily   | 10.6 to 10.7 ms | 5 ms   | 13.5 ms                         |
| Bun 1.4.5  | monthly | 0.37 to 0.38 ms | 1 ms   | 1.3 to 1.5 ms                   |
| Bun 1.4.5  | daily   | 3.48 to 3.49 ms | 5 ms   | 5.8 to 6.0 ms                   |

- Node daily misses its target by about 5.7 ms. Replacing the day-total lookup `totals.byDay.get(String(day))` with a constant 0, as a timing experiment only, brought it to 2.4 ms, so about 8.3 ms of the 10.7 is that string-keyed `Map` lookup, once per day per pass. Replacing the daily rate's power with a division saved about 0.3 ms.
- Part G switches the day totals to number keys when it deletes the old engine. That should remove most of the gap. The solver shares `compoundSegment` with the series, so it was not given its own lookup.
- The CLI and the parity run use Bun, where both modes meet their targets.

## Number keys and the old engine deleted (spec 2 part G, 2026-11-28)

Part G keyed the day totals by number, then deleted the old engine. `bench.ts` no longer times `compound` or `calculateProjection`, which are gone. It times one `effectiveRate` solve (median of 201) and one full `projectScenario` (median of 51) on the same three-account reference case. Figures from three runs of the command each.

| Runtime    | Mode    | Solve, string keys (part F) | Solve, number keys | Solve, old engine deleted | Target | One `projectScenario` |
| ---------- | ------- | --------------------------- | ------------------ | ------------------------- | ------ | --------------------- |
| Node 24.13 | monthly | 0.47 to 0.49 ms             | 0.47 to 0.48 ms    | 0.45 ms                   | 1 ms   | 1.9 to 2.0 ms         |
| Node 24.13 | daily   | 10.65 to 10.68 ms           | 4.46 to 4.48 ms    | 3.87 to 3.88 ms           | 5 ms   | 5.9 ms                |
| Bun 1.4.5  | monthly | 0.37 ms                     | 0.37 ms            | 0.36 to 0.37 ms           | 1 ms   | 1.9 ms                |
| Bun 1.4.5  | daily   | 3.47 to 3.54 ms             | 2.45 to 2.48 ms    | 2.40 to 2.42 ms           | 5 ms   | 4.2 ms                |

- Both runtimes now meet both targets. The number keys removed most of Node's daily gap, as part F predicted.
- Deleting the old engine saved a further 0.6 ms on Node daily. The "number keys" column was measured with the old engine still loaded in the same script.
