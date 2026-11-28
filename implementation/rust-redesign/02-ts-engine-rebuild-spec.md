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

## Part A: capture the baseline

Before any engine change, save today's outputs.

- Inputs: the four files in `packages/cli/examples/`, plus 200 configs from `generateRandomRetirementConfig` with seeds 1 to 200.
- The generator sets `startDate` to 1 January of the year it runs in. Overwrite it with a fixed date so the files never change: the 1st of a month in 2026, cycling through the twelve months by seed. Parts C and D reproduce today's numbers only for starts on the 1st.
- The generator never emits `growth`, `yearRange` or a one-time rule. Add at least 20 hand-written configs that cover them: both growth types on both cadences, a `yearRange` with a late start and an early end, one-time rules with and without a day, every `salaryBasis`, and both compounding modes.
- Do not write a rule with both `growth` and a `yearRange.start` above 0. The new contract cannot express that pair. See "Amounts" in part C.
- Store every input as JSON with its fixed `startDate`, so no test depends on the generator or the clock.
- Keep the outputs small. Full outputs for every input would run to tens of megabytes. For each input save:
  - the yearly rows of all three bands;
  - `monthlyDigest`, the SHA-256 of the monthly number stream;
  - `stepsDigest`, the SHA-256 of the step number stream at the baseline rate.
- A number stream is a fixed order of numbers, each written with `String(n)` and joined with commas. `String` prints the shortest text that reads back as the same float, so two streams match only when every number is identical.
  - Monthly stream: for each band in the order baseline, positive, negative, and for each monthly row, the balance, the contributions and the interest.
  - Step stream: for each step, `balanceStart`, `contributionsThisStep`, `interestEarned` and `balanceEnd`.
- Put the two stream builders in one test helper. Parts B to E call the same helper on the new output.
- For the four example files also save the full `calculateRetirement` result and the full step result. They are the readable reference when a digest fails.
- Everything goes under `packages/calculator/src/lib/__testing__/baseline/`. Keep the folder under 5 MB and report its size.
- Add a test that reruns today's engine on every stored input. The yearly numbers must be identical and both digests must match. It passes trivially now. It is the check for part B.

## Part B: split the engine into two phases

Same public contract as today. Only the inside changes.

1. `buildSchedule` takes the rules, salary, dates and compounding mode and returns a flat list of deposits. Each deposit has a rule id, a date, an amount and a bucket: `start`, `end` or a day number. It takes no rate.
2. `compound` takes a starting balance, a schedule and an annual rate, and returns the monthly balances, cumulative contributions and cumulative interest. It makes no decisions about rules.

- `calculateRetirement` builds the schedule once and compounds it three times.
- Step detail comes from a separate function that takes the same schedule. A normal run builds no step records.
- Keep the order of arithmetic. The baseline test still passes unchanged. If an exact match proves impossible, compare within one part in 10^12 and explain why in the PR.
- Add a benchmark script with the reference case from the README: 30 years, five rules. Record the time for 60 `compound` passes in both modes.

## Part C: calendar contract

The engine switches to the new input types, still with one account's worth of maths. Add a test-only adapter, `legacyToScenario`, that maps a baseline config to a new scenario with one account. The baseline test runs through it and still passes exactly.

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

Part C implements these types but reads only `accounts[0]`. Part E adds the rest.

### Dates

- Inside the engine a date is `{ year, month, day }` with months 1 to 12. Write a small `plain-date.ts` with integer maths: days in a month, leap years, compare, add months, parse and format.
- No `Date` object appears in the engine. No function reads the clock or the timezone.

### Validation

`parseScenario(file, options)` checks the file once and returns a `Scenario` the engine trusts. Engine functions take only `Scenario`. On failure it throws a `ScenarioError` with a `code` and the id of the account or rule at fault. Spec 4 gives Rust the same codes, and the parity run compares them.

| Code                           | Raised when                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `unsupported_version`          | `version` is not 1                                                                                                  |
| `invalid_date`                 | A date string is not a real calendar date                                                                           |
| `end_not_after_today`          | `endDate` is on or before `today`                                                                                   |
| `as_of_in_future`              | An account's `balanceAsOf` is after `today`                                                                         |
| `negative_balance`             | An account's `balance` is below 0                                                                                   |
| `invalid_rate`                 | A rate, raise or variance is not finite, or a rate minus the variance is at or below -1                             |
| `negative_amount`              | A rule's `amount`, a growth `amount` or `salary.annualBase` is below 0                                              |
| `duplicate_id`                 | Two accounts share an id, or two rules in the scenario do                                                           |
| `invalid_day`                  | A day is outside 1 to 31, a month is outside 1 to 12, or an annual month and day pair does not exist in a leap year |
| `growth_without_start`         | A recurring rule has `growth` and no `startDate`                                                                    |
| `rule_end_before_start`        | A rule's `endDate` is before its `startDate`                                                                        |
| `per_contribution_on_one_time` | A one-time rule uses `salaryBasis: 'perContribution'`                                                               |

### Deposits

- A monthly rule deposits once a month, an annual rule once a year in its `month`, and a one-time rule on its `on` date.
- A day past the end of the month clamps to the last day, as today.
- A recurring rule deposits only on dates from its `startDate` to its `endDate`, both inclusive. A missing bound is open.
- A deposit is in range when its date is on or after the range start and before the range end.
- For that test, a rule with `placement: 'start'` and no day counts as day 1, and `placement: 'end'` counts as the last day. This differs from today, where a start-placed rule in the first month always deposits. It only shows when a range starts after the 1st.
- Buckets are unchanged. Daily mode uses the day. Monthly mode puts a day at or before the midpoint in `start` and a later day in `end`.

### Amounts

- Growth. Periods are the whole years, or whole months for a monthly cadence, from the rule's `startDate` to the deposit date. Percent growth multiplies `amount` by `(1 + g/100)` to the power of the periods. Flat growth adds `g` times the periods. Today's engine counts periods from January of the projection's start year, which is why a rule can no longer start late and grow from an earlier date.
- Salary. The salary on a deposit date is `annualBase` times `(1 + annualRaiseRate)` to the power of the deposit's year minus the year of `salary.asOf`.
- Salary basis divides as today: 12 for monthly, 26 for biweekly, 52 for weekly, 365 for daily. `perContribution` divides by 12 on a monthly rule and by 1 on an annual one.

### The adapter

`legacyToScenario` lives in the test folder only. It sets `balanceAsOf`, `today` and `salary.asOf` to the old start date, and `endDate` to the old start date plus the horizon. A rule's `startDate` is 1 January of the start year plus `yearRange.start`. Its `endDate` is 31 December of the start year plus `yearRange.end`. A one-time rule's `on` uses day 1 when the old rule had no day.

## Part D: day-accurate ranges

`projectAccount(account, from, to, rate)` projects over the days from `from` up to, and not including, `to`. Each calendar month contributes one segment: the days of that month inside the range.

- Daily mode. For each day in the segment, add that day's deposits, then add the day's interest. The daily rate is unchanged: `(1 + r)^(1 / daysInYear) - 1`.
- Monthly mode. Interest for a segment is the balance plus the `start` deposits, times the monthly rate, times the segment's days divided by the days in the month. Then add the `end` deposits. A full month multiplies by exactly 1, so full months match today.

The baseline test still passes exactly, because every baseline range starts on the 1st and ends on a 1st.

New tests, each with a hand-computed expected value:

- A range that starts on the 27th of a 30-day month, in both modes.
- A range that ends mid-month.
- A range that starts and ends inside one month.
- A deposit dated before the range start, on the start, on the end and after the end.
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

`traceAccount(scenario, options, accountId, band)` returns one record per segment, covering the roll forward and the projection: the segment's dates, its days, the days in its month and year, the balance before and after, the interest, the rate, and each deposit with its rule id, date, amount and bucket.

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
3. Pool the accounts: add up their balances at `today`, and concatenate their schedules from `today`.
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
- The benchmark from part B, extended: one effective-rate solve on the reference case takes under 1 ms in monthly mode and under 5 ms in daily mode on this machine.

## Part G: CLI, examples, logger

- `retirement-calc --scenario <file> [--today YYYY-MM-DD] [--trace <accountId>] [--band baseline|positive|negative]`.
- It prints one JSON document to stdout: the `ScenarioProjection`, or the trace when `--trace` is given. Nothing else goes to stdout.
- `--today` defaults to the machine's local date. The CLI may read the clock. The engine may not.
- On a `ScenarioError` it prints `{ "error": { "code": "...", "accountId": "...", "ruleId": "..." } }` and exits with status 2.
- Rewrite the four example files to the new shape, each with at least two accounts. Add one with a stale account.
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
- The baseline test passes exactly through `projectScenario` and the adapter, or within the tolerance a PR justified in part B.
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
