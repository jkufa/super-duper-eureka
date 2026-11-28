# Spec 2: TS engine rebuild

Date: 2026-11-27
Depends on: spec 1
Blocks: spec 4

## Goal

`@retirement/calculator` implements the new contract: many accounts, calendar dates, per-account as-of dates, day-accurate ranges and an effective rate. Its tests pass, and it can stand as the reference the Rust port is checked against.

Breaking changes are expected. Nothing outside `packages/calculator` and `packages/cli` imports the engine after spec 1.

## Order

Eight parts, one PR each, in this order. Parts B to D must reproduce today's numbers on the baseline from part A. That is how we know the rebuild changed the shape and not the maths.

| Part | What                             |
| ---- | -------------------------------- |
| A    | Capture the baseline             |
| B    | Split the engine into two phases |
| C    | Calendar contract                |
| D    | Day-accurate ranges              |
| E    | Accounts                         |
| F    | Effective rate and weighted rate |
| G    | CLI, examples, logger            |
| H    | Parity corpus generator          |

## Two engines until part G

Parts C to F build the new engine next to the old one. They do not replace it.

- The old entry points, `calculateRetirement`, `calculateProjection` and `calculateProjectionWithSteps`, keep taking today's config and keep passing today's tests and the baseline test. The CLI keeps using them. Nothing in parts C to F changes their results.
- The new engine lives in its own modules and takes a `Scenario`. It shares `compound` and its helpers with the old one. It has its own schedule builder, written on plain dates.
- From part C on, the baseline is checked twice: once against the old engine, as today, and once against the new engine through the adapter.
- Part G switches the CLI to the new engine, then deletes the old entry points, the old schedule builder, the old types, the adapter's use outside the baseline test, and the tests that only the old contract could express.

The old contract accepts inputs the new one rejects, such as a day of 0 or a rule that starts late but grows from an earlier date. Keeping both avoids a compatibility layer that would have to fake them.

## Part A: capture the baseline

Before any engine change, save today's outputs.

- Inputs: the four files in `packages/cli/examples/`, plus 200 configs from `generateRandomRetirementConfig` with seeds 1 to 200.
- The generator sets `startDate` to 1 January of the year it runs in. Overwrite it with a fixed date so the files never change: the 1st of a month in 2026, cycling through the twelve months by seed. Parts C and D reproduce today's numbers only for starts on the 1st.
- The generator never emits `growth`, `yearRange` or a one-time rule. Add at least 20 hand-written configs that cover them: both growth types on both cadences, a `yearRange` with a late start and an early end, one-time rules with and without a day, every `salaryBasis`, and both compounding modes.
- Do not write a rule with both `growth` and a `yearRange.start` above 0. The new contract cannot express that pair. See "Amounts" in part C.
- Store every input as JSON with its fixed `startDate`, so no test depends on the generator or the clock.
- Add raw cases that leave optional fields out, written as plain objects and not through `makeConfig`: no `compounding`, no `annualRaiseRate`, no `variance`, a salary-percent rule with no `salaryBasis`, a recurring rule with neither `day` nor `placement`, and a `yearRange` with only a start.
- Keep the outputs small. Full outputs for every input would run to tens of megabytes. For each input save:
  - the yearly rows of all three bands;
  - `monthlyDigest`, the SHA-256 of the monthly stream;
  - `stepsDigest`, the SHA-256 of the step stream.
- A stream is a fixed order of values written as text and joined with commas. A number is written with `String(n)`, which prints the shortest text that reads back as the same float. Negative zero is written `-0`, because `String` prints it as `0`. Text is written as a JSON string, quotes included, so an id that contains a comma cannot pass for two values. Two streams match only when every value is identical.
- The streams cover every number the engine computes, so no output can change unnoticed.
  - Monthly stream. For each band in the order baseline, positive, negative: `finalBalance`, `totalContributions` and `totalGrowth`, then for each monthly row its `year`, `month`, `balance`, `contributions`, `interest` and `salary`.
  - Step stream. Run at the baseline rate with contribution details on. First the summary: `totalSteps`, `totalContributions`, `totalInterest` and `finalBalance`. Then for each step: `stepIndex`, `yearIndex`, `monthIndex`, `balanceStart`, `balanceEnd`, `interestEarned`, `contributionsThisStep`, `totalContributions`, `totalInterest`, `contributionsStart`, `contributionsEnd`, `salary`, `annualRate`, `daysInMonth`, `daysInYear` and `compounding`. Then its `contributionsByDay` as day and amount pairs in day order. Then each active contribution's `id`, `type` and `amount`, in rule order. A contribution's `timing` is left out. It is a copy of the input.
- Every list in a stream is preceded by its length: each band's monthly rows, the steps, and each step's day pairs and active contributions. Without the count, a row moved from one band to the next gives the same text.
- Put the stream builders in one test helper. Parts B to E call the same helper on the new output. Part C says how the new output maps back to these fields.
- For the four example files also save the full `calculateRetirement` result and the full step result. They are the readable reference when a digest fails, and the test compares them too.
- Everything goes under `packages/calculator/src/lib/__testing__/baseline/`. Keep the folder under 8 MB and report its size.
- The writer builds and checks every case in memory before it replaces any file, so a rejected input cannot leave half a baseline behind. If putting the new folder in place fails, it puts the old one back. Do not run the tests while the writer runs.
- Stored inputs are checked strictly where they are first parsed: an unknown key, a misplaced key or a number that is not finite is an error that names the field's path.
- Add a test that reruns today's engine on every stored input. The yearly numbers must be identical and both digests must match. It passes trivially now. It is the check for part B.
- Write and test the baseline on Node, which is where Vitest runs. Bun computes whole-number powers differently in the last digit, so a baseline written on Bun fails on Node. The CLI runs on Bun. That is fine as long as each check stays on one runtime.

## Part B: split the engine into two phases

Same public contract as today. Only the inside changes.

1. `buildSchedule` takes the rules, salary, dates and compounding mode and returns a flat list of deposits. Each deposit has a rule id, the rule's position, a date, an amount and a bucket: `start`, `end` or a day number. The date and the bucket are separate facts. In monthly mode a deposit on the 2nd and one on the 15th share the `start` bucket, and parts C and D need the date to decide whether a deposit falls inside a range. It takes no rate. The position is there because today's contract lets two rules share an id. Part C makes that an error.
2. `compound` takes a starting balance, a schedule and an annual rate, and returns the monthly balances, cumulative contributions and cumulative interest. It makes no decisions about rules.

- `calculateRetirement` builds the schedule once and compounds it three times.
- Step detail comes from a separate function that takes the same schedule. A normal run builds no step records.
- Keep the order of arithmetic, as "Grouping and order" below states it. The baseline test still passes unchanged.
- There is no tolerance to fall back on. A digest either matches or it does not. If an exact match proves impossible, stop and report what differs.
- Add a benchmark script with the reference case from the README: 30 years, five rules. Record the time for 60 `compound` passes in both modes.

### Grouping and order

The split must add numbers in the order today's engine does. A different order changes the last digit. Adding a month's deposits to the balance one at a time, where today's engine adds their total once, changed six stored step balances.

- Schedule order. Deposits are ordered by month, then by the rule's position in the config. They are not ordered by day within the month.
- A deposit whose amount is 0 is left out of the schedule.
- Buckets. A deposit is in `start`, in `end`, or on a numbered day.
  - Monthly mode. A recurring rule with a day is in `start` when the day is at or before `Math.ceil(daysInMonth / 2)`, and in `end` otherwise. So day 16 of a 31-day month is in `start`. The day decides even when the rule also has a placement. A recurring rule without a day uses its placement, or `start` when it has none. A one-time rule is in `start` whatever its day. No deposit has a numbered day.
  - Daily mode. A recurring rule with a day is on that day, clamped to the month. A recurring rule without a day keeps its placement bucket, or `start` when it has none. It is not moved to a numbered day. A one-time rule is on its day, or on day 1 when it has none.
- Bucket totals. For each month, the `start` total, the `end` total and each numbered day's total are each summed from 0 in schedule order.
- Monthly compounding. `monthlyRate = (1 + annualRate) ** (1 / 12) - 1`. `balanceAfterStart = balance + startTotal`. `interest = balanceAfterStart * monthlyRate`. `balance = balanceAfterStart + interest + endTotal`. The month's contributions are `startTotal + endTotal`.
- Daily compounding. `dailyRate = (1 + annualRate) ** (1 / daysInYear) - 1`. Day 1's deposit is its numbered-day total plus `startTotal`, in that order. The last day's deposit is its numbered-day total plus `endTotal`. A placement total of 0 is not added. On each day, add the day's deposit to the balance once if it is not 0, then compute `balance * dailyRate` and add that to the balance. The month's contributions and the month's interest are each summed from 0, day by day.
- Running totals. The month's contributions and the month's interest are each added to the cumulative totals once per month.
- A step reports `contributionsStart` as `startTotal`, `contributionsEnd` as `endTotal`, and `contributionsByDay` as the numbered-day totals before the placement totals are merged in.
- Days outside 1 to 31. Today's contract accepts them, and part B must keep what the engine does with them. A recurring rule's day of 0 counts as no day, so the rule uses its placement in both modes. In daily mode a one-time rule's day is clamped into the month: 0 becomes 1, and a day past the end becomes the last day. Part C rejects these days as `invalid_day`, so none of this reaches the Rust port.
- Values that are not finite. The two guards in daily compounding, on a placement total and on a day's deposit, are truthiness checks, so they skip `NaN` as well as 0. Part B keeps them as they are. Part C rejects input that is not finite, and for finite values adding a total of 0 changes nothing.

## Part C: calendar contract

Build the new engine's input side and its first entry point, still with one account's worth of maths.

- `projectAccount(scenario, account, from, to, openingBalance, annualRate)` returns the account's `Series`, and `traceAccountRange` with the same arguments returns its trace. "Trace" below and part E define both shapes. The caller supplies the opening balance and the rate, because part E calls this twice per account, once to roll forward and once to project. When `from` is on or after `to`, the series has the opening balance and no rows. In part C, `from` and `to` must each be the 1st of a month, and anything else throws. Part D lifts that.
- Neither function is exported from the package. They trust their arguments. Part E's `projectScenario` is the public entry point, and until then the package exports only `parseScenario`, `ScenarioError` and the file and result types.
- Add a test-only adapter, `legacyToScenario`, that maps a baseline config to a new scenario with one account. A second baseline test runs every stored case through the adapter and `projectAccount`, once per band, and must reproduce the stored yearly rows and digests exactly.
- The old engine and its tests are untouched. See "Two engines until part G".

### Types

```ts
/** 'YYYY-MM-DD' in files. A date means the start of that day. */
export type PlainDateString = string;

export interface ScenarioFile {
  version: 1;
  /** Boundary. The last day counted is the day before it. */
  endDate: PlainDateString;
  interest: {
    annualRate: number;
    variance?: number;
    compounding?: 'monthly' | 'daily';
  };
  salary: {
    annualBase: number;
    annualRaiseRate?: number;
    /** The date annualBase was true. Raises apply on each 1 January after it. */
    asOf: PlainDateString;
  };
  accounts: Array<AccountFile>;
}

export interface AccountFile {
  id: string;
  name: string;
  kind: 'pretax' | 'roth' | 'taxable' | 'other';
  included: boolean;
  balance: number;
  /** The balance is true at the start of this day. */
  balanceAsOf: PlainDateString;
  /** Overrides interest.annualRate for this account. */
  annualRate?: number;
  contributions: Array<ContributionRuleFile>;
}

export type RuleTiming =
  | { frequency: 'oneTime'; on: PlainDateString }
  | { frequency: 'monthly'; day?: number; placement?: 'start' | 'end' }
  | { frequency: 'annual'; month: number; day?: number; placement?: 'start' | 'end' };

export interface ContributionRuleFile {
  id: string;
  name?: string;
  /** Default true. */
  enabled?: boolean;
  type: 'flat' | 'salaryPercent';
  /** The amount on startDate when growth is set. */
  amount: number;
  salaryBasis?: 'annual' | 'monthly' | 'biweekly' | 'weekly' | 'daily' | 'perContribution';
  growth?: { type: 'percent' | 'flat'; amount: number; cadence: 'annual' | 'monthly' };
  timing: RuleTiming;
  /** Recurring rules only. First day the rule can deposit. Required when growth is set. */
  startDate?: PlainDateString;
  /** Recurring rules only. Last day the rule can deposit, inclusive. */
  endDate?: PlainDateString;
}

export interface RunOptions {
  /** Results start at the start of this day. The engine never reads the clock. */
  today: PlainDateString;
}
```

Part C implements and validates all of these types. Its `projectAccount` works on one account at a time, and part E adds the scenario-level result.

### Dates

- Inside the engine a date is `{ year, month, day }` with months 1 to 12. Write a small `plain-date.ts` with integer maths: days in a month, leap years, compare, add months, parse and format.
- A date in a file is exactly ten ASCII characters, `YYYY-MM-DD`, with zero padding. The year is 0001 to 9999. Anything else is `invalid_date`: a missing zero, a time or zone suffix, surrounding space, year 0000, or a day the month does not have. A value that is not a string is `invalid_field`.
- Adding months clamps the day to the end of the month. A result outside years 0001 to 9999 is an error, not a date.
- No `Date` object appears in the new engine. No function in it reads the clock or the timezone. The old engine keeps its `Date` code until part G deletes it.
- Validation guarantees a day is a whole number from 1 to 31. The shared compounding helpers key day totals by the day's string form, because the old engine must keep accepting a quoted day. For validated days that gives the same result as number keys. Part G switches the helpers to number keys when it deletes the old engine.

### Validation

`parseScenario(file, options)` checks the file once and returns a `Scenario` the engine trusts. Engine functions take only `Scenario`. On failure it throws a `ScenarioError` with a `code`, the path of the field and the id of the account or rule at fault. Spec 4 gives Rust the same codes, and the parity run compares them.

- The returned `Scenario` is deeply read-only in its types and shares no object with the input.
- `options` is checked as strictly as the file. Its only key is `today`. An error in it names a path under `options`, such as `options.today`.
- `not_finite` comes from the engine, so it carries the account's id and no path.
- An error on or inside an account carries that account's id, and one on or inside a rule carries the rule's id too, whenever the id itself is a readable string. That includes an unknown key directly on the account or rule.
- Every element of `accounts` and `contributions` is checked, including a hole in an array.
- Filled defaults: `variance` 0, `annualRaiseRate` 0, `compounding` `monthly`, a rule's `enabled` true, `placement` `start`, `salaryBasis` `annual`.
- Which code a single fault raises. `version` is read before anything else. A whole number other than 1 is `unsupported_version`, even when the rest of the file is in a shape this version does not know. A missing `version`, or one that is not a whole number, is `invalid_field`. A rate, raise or variance that is a number but breaks a rule below is `invalid_rate`, and one that is not a number is `invalid_field`.
- Several faults at once. The parser reports one of them. Which one is not part of the contract, and the parity run compares errors on single-fault inputs only.
- `invalid_field` is about the file's shape, and the two languages find shape errors differently. Rust's deserialiser stops at the first one without knowing which account it was in. So for `invalid_field` the parity run compares the code alone, not the path or the ids. Every other code is compared with its ids.
- A number literal too large for a float, such as `1e400`, reads as infinity in JavaScript and is a read error in Rust. The parity corpus never contains one.

| Code                           | Raised when                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unsupported_version`          | `version` is not 1                                                                                                                                                                            |
| `invalid_field`                | A key is unknown or misplaced, a required field is missing, or a value has the wrong type or is not finite. Rates raise `invalid_rate`. The message names the field's path                    |
| `invalid_date`                 | A date string is not a real calendar date                                                                                                                                                     |
| `end_not_after_today`          | `endDate` is on or before `today`                                                                                                                                                             |
| `as_of_in_future`              | An account's `balanceAsOf` is after `today`                                                                                                                                                   |
| `negative_balance`             | An account's `balance` is below 0                                                                                                                                                             |
| `invalid_rate`                 | A rate, raise or variance is not finite. The variance is below 0. A rate minus the variance is at or below -1, or a rate plus the variance is not finite. `annualRaiseRate` is at or below -1 |
| `negative_amount`              | A rule's `amount`, a growth `amount` or `salary.annualBase` is below 0                                                                                                                        |
| `duplicate_id`                 | Two accounts share an id, or two rules in the scenario do                                                                                                                                     |
| `invalid_day`                  | A day is outside 1 to 31, a month is outside 1 to 12, or an annual month and day pair does not exist in a leap year                                                                           |
| `growth_without_start`         | A recurring rule has `growth` and no `startDate`                                                                                                                                              |
| `growth_on_one_time`           | A one-time rule has `growth`. A one-time amount is what it says                                                                                                                               |
| `rule_end_before_start`        | A rule's `endDate` is before its `startDate`                                                                                                                                                  |
| `per_contribution_on_one_time` | A one-time rule uses `salaryBasis: 'perContribution'`                                                                                                                                         |
| `not_finite`                   | Raised by the engine, not the parser. A balance, contribution or interest figure it computed is not finite. Carries the account's id                                                          |

### Deposits

- A monthly rule deposits once a month, an annual rule once a year in its `month`, and a one-time rule on its `on` date.
- A day past the end of the month clamps to the last day, as today.
- A recurring rule deposits only on dates from its `startDate` to its `endDate`, both inclusive. A missing bound is open.
- A deposit is in range when its date is on or after the range start and before the range end.
- Every deposit has a resolved date. A rule with `placement: 'start'` and no day is dated day 1, and `placement: 'end'` is dated the last day of the month. Rule bounds, range membership, growth and the trace all use the resolved date. This differs from today, where a start-placed rule in the first month always deposits. It only shows when a range starts after the 1st.
- Compounding uses the bucket, not the date. Buckets, bucket totals and the order of arithmetic are unchanged from part B's "Grouping and order". In daily mode a rule with a placement and no day keeps its `start` or `end` bucket. In monthly mode a one-time deposit dated the 28th is still in `start`.

### Amounts

- Growth. Periods are the whole years, or whole months for a monthly cadence, from the rule's `startDate` to the deposit date. Whole months are the largest `n` for which `startDate` plus `n` months is on or before the deposit date, where adding months clamps the day to the end of the month. Whole years are that count divided by 12, rounded down. So a rule that starts on 31 January completes its first month on 28 February, and one that starts on 29 February 2024 completes its first year on 28 February 2025. Percent growth multiplies `amount` by `(1 + g/100)` to the power of the periods. Flat growth adds `g` times the periods. Today's engine counts periods from January of the projection's start year, which is why a rule can no longer start late and grow from an earlier date.
- Salary. The salary on a deposit date is `annualBase` times `(1 + annualRaiseRate)` to the power of the deposit's year minus the year of `salary.asOf`. The difference can be negative, when `asOf` is in a later year than the deposit. Write this once as `salaryInYear(scenario, year)`. The adapter uses it for the monthly rows, and part E uses it for `salaryByYear`.
- Salary share. Grow the rule's amount first. A divided basis is `(salary / divisor) * (grownAmount / 100)`, with both pairs of parentheses. The divisors are 12 for monthly, 26 for biweekly, 52 for weekly and 365 for daily, and `perContribution` on a monthly rule uses 12. The annual basis, and `perContribution` on an annual rule, is `salary * (grownAmount / 100)` with no division. The order matters: a salary of 100 on a monthly basis at 7 percent gives `0.5833333333333335` this way and `0.5833333333333334` with the percentage applied first.
- Results that are not finite. After compounding an account, if any balance, cumulative contribution or cumulative interest in its series is not finite, the engine throws `not_finite` with the account's id. Inputs are finite, but a large rate, raise or growth over a long horizon can still overflow.

### Trace

`traceAccountRange` returns one segment per calendar month in the range. Spec 4 serialises these names as they are.

```ts
export interface TraceSegment {
  from: PlainDateString;
  /** Not included. */
  to: PlainDateString;
  days: number;
  daysInMonth: number;
  daysInYear: number;
  balanceStart: number;
  balanceEnd: number;
  /** The segment's contributions as compounded. */
  contributions: number;
  interest: number;
  annualRate: number;
  /** In schedule order. */
  deposits: Array<TraceDeposit>;
}

export interface TraceDeposit {
  ruleId: string;
  date: PlainDateString;
  amount: number;
  bucket: 'start' | 'end' | number;
}
```

### The adapter

`legacyToScenario` lives in the test folder only. It sets `balanceAsOf`, `today` and `salary.asOf` to the old start date, and `endDate` to the old start date plus the horizon. A recurring rule's bounds come from the calendar years in which it could deposit. The first is the start year plus `yearRange.start` rounded up, and never before the start year. The last is the start year plus `yearRange.end` rounded down. The defaults are 0 and the horizon. `startDate` is 1 January of the first year and `endDate` is 31 December of the last. A rule with no such year is left out of the scenario. Today's engine grows every rule from 1 January of the start year. So a rule with growth whose first year is the start year gets that as its `startDate`, and a rule with growth whose first year is later cannot be expressed: the adapter throws on it, and does not guess. An annual rule's day is clamped to the longest that month can be, so 31 April becomes the 30th and 29 February stays. An annual rule's month is the old month plus 1, since the old contract counts months from 0. A one-time rule's `on` uses day 1 when the old rule had no day. An explicit day past the end of its month is clamped to the last day before the date is written, so 31 April becomes the 30th. Today's engine ignores `yearRange` on a one-time rule, and the new contract gives one-time rules no bounds, so the adapter drops it.

The adapter has a second half, `toLegacyRows`. It takes the legacy config along with the new output and trace, and maps them back to the rows and steps the stream builders take.

- `yearIndex` is the calendar year minus the start year, and `monthIndex` is the month minus 1.
- `compounding` comes from the config. The order of a step's active contributions comes from the trace. Each one's `type` and original `timing` come from the config, matched by rule id.
- The trace's rate is the annual rate.
- The start, end and by-day figures are the trace's deposits totalled by bucket, as part B groups them.
- The adapter does no arithmetic on money beyond totalling a step's deposits by bucket with the shared helper.
- Equivalence is claimed for start years from 100 on. Below that, the old engine's `Date` constructor moves the year into the 1900s.
- `contributionsThisStep` is the segment's contributions as compounded, which the trace reports. It is not a difference of two cumulative figures, which can lose a small deposit, and it is not a fresh sum of the bucket totals, which in daily mode can differ from the day-by-day sum in the last digit.

## Part D: day-accurate ranges

`projectAccount` now projects over the days from `from` up to, and not including, `to`, for any two dates. Each calendar month contributes one segment: the days of that month inside the range.

- Daily mode. For each day in the segment, add that day's deposit as part B builds it, then add the day's interest. The deposit is the day's numbered-day total, plus the start total on day 1 of the month and the end total on the month's last day. The daily rate is unchanged, `(1 + r)^(1 / daysInYear) - 1`, with the day count of the segment's own calendar year.
- Monthly mode. Interest for a segment is `(balance + startDeposits) * monthlyRate * (segmentDays / daysInMonth)`, evaluated as written: the product first, then times the fraction, with the division done inside its own parentheses. Then add the `end` deposits. A full month multiplies by exactly 1, so full months match today. Multiplying by the days and then dividing does not: it changes the last digit.
- A segment's contributions are the kept start and end totals in monthly mode, and the sum of the days' deposits in daily mode.
- Splitting a range. In daily mode, projecting from `a` to `c` equals projecting from `a` to `b` and then from `b` to `c` with the first result as the opening balance, for any `b`, exactly. In monthly mode that holds only when `b` is the 1st of a month. A month split in two earns interest as two products, which compounds it. At a monthly rate of 1, a whole November takes 1,000 to 2,000, and the same November split on the 16th takes it to 2,250. Part E's roll forward ends at `today`, so a stale account in monthly mode gets this small extra within the month of `today`.
- The old engine shares the compounding helper. Its full months now multiply by `daysInMonth / daysInMonth`, which is exactly 1, so its results do not change.
- Filter by date first, then total by bucket. Keep the month's deposits whose resolved date is inside the segment, in schedule order. Total the kept deposits by bucket and compound them as part B says. In monthly mode a one-time deposit dated 28 January is in `start`, and a segment from 27 January to 1 February keeps it and adds it before that segment's interest. In daily mode a start placement is dated day 1, so a segment that starts later has already dropped it.

The baseline test still passes exactly, because every baseline range starts on the 1st and ends on a 1st.

New tests, each with a hand-computed expected value:

- A range that starts on the 27th of a 30-day month, in both modes.
- A range that ends mid-month.
- A range that starts and ends inside one month.
- A deposit dated before the range start, on the start, on the end and after the end. Use a range that ends mid-month, such as the 15th to the 20th with a deposit on the 20th, so the test fails if the end is treated as included.
- 29 February as a range start, and a day-31 rule in a 30-day month.

## Part E: accounts

`projectScenario(scenario, options)` returns the full result.

- Roll forward. An account with `balanceAsOf` before `today` is first projected from `balanceAsOf` to `today`. Its balance at `today` is the result. This is the same `projectAccount`, called on an earlier range.
- Projection. Each included account is then projected from `today` to `endDate`.
- Total. The total series is the sum of the included accounts, row by row. Sum in the order the accounts appear in the file.
- Bands. `baseline` uses each account's own rate, or the scenario default. `positive` adds the variance to every account's rate, and `negative` subtracts it. With no variance, all three are the baseline.
- An account with `included: false` is projected and returned, flagged, and left out of the total.

```ts
export interface ScenarioProjection {
  today: PlainDateString;
  endDate: PlainDateString;
  /** Baseline only. See part F. */
  effectiveRate: number;
  /** Included accounts whose balanceAsOf is before today. */
  staleAccounts: Array<{ accountId: string; balanceAsOf: PlainDateString }>;
  salaryByYear: Array<{ year: number; salary: number }>;
  bands: Record<'baseline' | 'positive' | 'negative', BandProjection>;
}

export interface BandProjection {
  total: Series;
  accounts: Array<AccountProjection>;
}

export interface AccountProjection {
  accountId: string;
  included: boolean;
  annualRate: number;
  /** What the roll forward added between balanceAsOf and today. Zero when not stale. */
  rolledForward: { contributions: number; interest: number };
  series: Series;
}

export interface Series {
  /** Balance at the start of today. */
  startBalance: number;
  finalBalance: number;
  /** From today to the end. The roll forward is not counted here. */
  totalContributions: number;
  totalInterest: number;
  monthly: Array<Row>;
  /** One row per calendar year, at its last counted day. */
  yearly: Array<Row>;
}

export interface Row {
  /** Calendar year. */
  year: number;
  /** 1 to 12. Omitted on yearly rows. */
  month?: number;
  balance: number;
  /** Cumulative since today. */
  contributions: number;
  /** Cumulative since today. */
  interest: number;
  /** Total series, yearly rows only. See part F. */
  weightedRate?: number | null;
}
```

`traceAccount(scenario, options, accountId, band)` returns the account's `TraceSegment`s from part C, covering the roll forward and then the projection.

Tests:

- A scenario with one account, not stale, matches the baseline through the adapter. This is the baseline test again, now through `projectScenario`.
- One account split into three with the same rate and its rules divided among them. The total matches the single account within one part in 10^9.
- Two accounts with different rates. Each account's series matches a single-account run of the same account exactly.
- A stale account. Its `startBalance` equals `balance` plus both `rolledForward` figures, and it appears in `staleAccounts`.
- An account with `included: false` is absent from the total and present in `accounts`.
- Every validation code has a test that raises it.

## Part F: effective rate and weighted rate

### Effective rate

Computed for the baseline band, over `today` to `endDate`, across included accounts.

1. If there are no included accounts, return the scenario's default rate.
2. Let `lo` be the lowest included account rate and `hi` the highest. If they are equal, return that rate.
3. Pool the accounts: add up their balances at `today`, and merge their schedules from `today`. The pooled schedule is ordered by month, then by the account's position in the file, then by the rule's position in the account.
4. If the pooled balance is 0 and the pooled schedule is empty, return the default rate.
5. The target is the baseline total's `finalBalance`.
6. Repeat exactly 60 times: take the midpoint of `lo` and `hi`, compound the pool at it, and move `lo` up if the result is below the target, else move `hi` down.
7. Return the midpoint of `lo` and `hi`.

There is no "close enough" test. The fixed count is what lets TS and Rust follow the same steps. The answer lies between `lo` and `hi` because balances and deposits are never negative, so the final balance only rises with the rate.

### Weighted rate

On each yearly row of the baseline total: the sum of each included account's rate times its balance on that row, divided by the total balance. `null` when the total balance is 0. The other bands leave it out.

Tests:

- Accounts that share one rate return it exactly.
- The effective rate is at or between the lowest and highest account rate.
- Compounding the pool at the effective rate gives the total's `finalBalance` within one part in 10^9.
- The README's example: $180,000 at 6% and $20,000 at 10%, no contributions, 30 years. The effective rate rounds to 6.66% and the last yearly weighted rate rounds to 7.0%.
- The benchmark from part B, extended: one effective-rate solve on the reference case takes under 1 ms in monthly mode and under 5 ms in daily mode on this machine. After part B, 60 full `compound` passes take 1.1 to 2.1 ms in monthly mode, because each pass also builds the monthly rows. The solver needs only the final balance, so give it a pass that returns only that.

## Part G: CLI, examples, logger

- `retirement-calc --scenario <file> [--today YYYY-MM-DD] [--trace <accountId>] [--band baseline|positive|negative]`.
- It prints one JSON document to stdout: the `ScenarioProjection`, or the trace when `--trace` is given. Nothing else goes to stdout.
- `--today` defaults to the machine's local date. The CLI may read the clock. The engine may not.
- On a `ScenarioError` it prints `{ "error": { "code": "...", "accountId": "...", "ruleId": "..." } }` and exits with status 2.
- Rewrite the four example files to the new shape, each with at least two accounts. Add one with a stale account.
- Switch the shared compounding helpers to number keys for day totals.
- Delete the old engine once the CLI no longer uses it: the old entry points, the old schedule builder, `debug.ts` and the old config types in `src`.
- Port each test in `calculator.test.ts` that the new contract can express to the new engine, with the same expected numbers where the start is on the 1st. List the ones it cannot express in the PR, with the reason for each.
- The baseline stays, checked through the adapter only. Its stored inputs are old configs, so the old config type and `legacyToScenario` move into the test folder. Delete the baseline writer. Nothing can regenerate the baseline once the old engine is gone, which is the point.
- Delete `packages/logger` and the `build*WideEvent` functions. The trace is plain data now.
- Delete `custom-variable.ts`, `custom-variable-timing.ts` and their tests. They were form logic for the deleted app.
- Rewrite `makeConfig` and `makeContribution` for the new types. Keep them as test helpers. Do not export them from the package.
- Update the CLI lines, the structure list and the testing notes in `AGENTS.typescript.md`.

## Part H: parity corpus generator

Replace `random.ts` with a seeded generator of new-contract cases. Each case is `{ scenario, today }`. Spec 4 runs both CLIs over its output.

- Keep `createSeededRandom`. The same seed must always give the same case.
- 1 to 6 accounts per case, with mixed rates, kinds and `included` flags.
- Push hard on edges. At least one case in ten has each of these: a stale account, an as-of date on 29 February, a rule on day 31, an end date mid-month, `today` equal to an as-of date, a zero balance, a disabled rule, an excluded account, zero variance.
- Both compounding modes, split evenly.
- One case in twenty is invalid on purpose, one per validation code in turn.
- A script writes cases for seeds 1 to N into a folder given on the command line. Nothing generated is committed in this spec.

## Acceptance criteria

- `vp check` and `vp test` pass.
- The baseline test passes exactly through `projectScenario` and the adapter.
- Every test listed under parts D, E and F exists and passes.
- No file in `packages/calculator/src` outside tests contains `new Date`, `Date.now` or `Math.random`. A test enforces it.
- The CLI runs every example file and prints valid JSON.
- The generator script writes 5,000 cases, and the CLI processes all of them without crashing. Invalid cases exit with status 2 and the expected code.
- The benchmark figures are recorded in a note under `.codex/notes/`.

## Out of scope

- Tax treatment, contribution caps, transfers between accounts and withdrawals.
- Per-account variance or compounding.
- An effective rate for the positive and negative bands.
- Any UI.
- Any Rust.
