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
