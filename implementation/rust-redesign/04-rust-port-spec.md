# Spec 4: Rust port

Date: 2026-11-27
Depends on: specs 2 and 3
Blocks: the GPUI app

## Goal

`crates/core` and `crates/cli` do everything the TypeScript calculator and CLI do after spec 2, and a parity run shows the two agree on every generated case. Then the TypeScript is deleted and the Rust crate is the only engine.

This is a port. It changes no behaviour. Anything that looks wrong in the TypeScript engine is fixed there first, under spec 2's rules, and then ported.

## Order

One PR per part.

| Part | What                               |
| ---- | ---------------------------------- |
| A    | Schedule builder                   |
| B    | Compounding and account projection |
| C    | Scenario projection                |
| D    | Step trace                         |
| E    | CLI                                |
| F    | Parity harness                     |
| G    | Golden files and property tests    |
| H    | Delete TypeScript                  |

## Part A: schedule builder

Port `buildSchedule` and the deposit and amount rules from spec 2 part C.

- This is the second exemplar. Review it at high effort, then name it in "Rust Guidelines" next to the first.
- The schedule is built per account: a list of months in the range, each cut to its segment, each holding that month's kept deposits in the order of the rules. It is not ordered by day within a month. Bucket totals are summed in that order. Pooling for the effective rate takes each month's deposits account by account in file order. See "Grouping and order" in spec 2 part B, which this part ports line for line. A deposit carries no rule position, because rule ids are unique in a scenario.
- Use the built-in `f64::powi` for whole-number powers and `f64::powf` for the rest. On 200,000 samples `powi` matched Bun's `**` on every whole-number power from 0 to 1000, and `powf` matched it on the fractional roots every time. Do not write a power function of our own. Every whole-number exponent in the engine is 0 or above: a salary in a year before `salary.asOf` divides by a positive power, as spec 2 part C says, so there is no negative exponent to handle. Growth over more than 1,000 periods still differs from Bun in the last bit about one time in five. That is inside the tolerance and the corpus marks those cases.
- Ranges at the edges. An empty or reversed range gives no months. A range that reaches December 9999 ends its last segment at `to`. The TypeScript builder throws there, and the parity corpus stays clear of year 9999.
- Port the TypeScript unit tests for deposits and amounts one for one, with the same inputs and expected values.
- Count growth periods the way spec 2 defines them: the largest `n` for which the rule's start plus `n` months, with the day clamped, is on or before the deposit. Do not read the months from a date library's difference. A reviewer measured this on `jiff`: 31 January plus one month is 28 February, but the month-unit difference between those two dates came back as 28 days and no months, which would undercount. `CalendarDate` exposes no difference for that reason.
- The date type accepts only spec 2's file grammar: ten ASCII characters and years 0001 to 9999. It checks that shape, reads the digits itself, and has `jiff-core` validate the date. `jiff-core` allows years from -9999, so the type rejects year 0000 and earlier itself.

## Part B: compounding and account projection

Port `compound` and `projectAccount` from spec 2 parts B and D, both modes, with the segment rule for partial months.

- Keep the order of arithmetic the same as TypeScript. Where the order matters, a test pins it.
- Do not use `mul_add` or other fused forms. They change the last digit, and plain expressions are easier to compare with the TypeScript. If a Clippy rule in our set asks for one, stop and report it. Do not silence it.
- Port the hand-computed tests from spec 2 part D with the same expected values.
- The daily guards test for "not 0". TypeScript's truthiness also skips `NaN`, and the first Rust version copied that with a helper. Once the schedule builder rejects a deposit amount that is not finite, as spec 2 part C now says, no `NaN` can reach the guards, so the helper goes and the guard is `!= 0.0`.
- Day totals are a fixed array of 31, indexed by the day minus 1.

## Part C: scenario projection

Port `projectScenario` from spec 2 parts E and F: the roll forward, the per-account series, the total, the three bands, `staleAccounts`, the effective rate and the weighted rate.

`Scenario` carries `today`, stored by `Scenario::parse`, and `project_scenario` takes the scenario alone. Part A adds the field.

- The effective rate runs exactly 60 passes, with the same shortcuts in the same order as spec 2.
- Sum accounts in file order.
- The output types serialise to the same JSON field names as TypeScript. An absent optional field is omitted, not `null`. `weightedRate` is the one field that can be `null`.
- Outside the crate, `core` offers `Scenario::parse`, `project_scenario` and `trace_account`, plus the types they take and return. Every function that takes a balance, a rate or a date range it has not checked is `pub(crate)`: `project_account`, `trace_account_range`, `build_account_schedule`, `salary_in_year` and the calendar arithmetic on `CalendarDate`. A caller outside the crate cannot hand the engine a value the parser never saw.

## Part D: step trace

Port `traceAccount`. Same records, same field names.

## Part E: CLI

`retirement-calc` with the flags, output and exit codes from spec 2 part G.

- Argument parsing uses `clap`. JSON uses `serde_json` with its `float_roundtrip` feature, so a number read from a file is the nearest float, as it is in JavaScript.
- `--today` defaults to the machine's local date. This is the only place in the workspace that reads the clock.
- `core` takes `today` as a `CalendarDate`, so the CLI owns reading it. A `--today` value that is not a date in the file grammar is `invalid_date`, the code TypeScript gives for a bad `today` in its options.
- The CLI reads the file in two steps: the version on its own through `VersionFile` and `Version::check`, then the whole file into `ScenarioFile`. Any failure to deserialise is `invalid_field`.
- A catch-all error type is fine here. Errors from `core` still print as the JSON error object and exit with status 2.
- Run every example file from spec 2 through both CLIs and compare by eye before part F automates it.
- Match the TypeScript CLI's contract in spec 2 part G: the flags, a two-space indent with a trailing newline, exit status 1 for bad usage or an unreadable file with nothing on stdout, and status 2 with the error object for a `ScenarioError`.
- Call the TypeScript CLI as `bun packages/cli/src/index.ts`. Through `vp run`, Vite+ prints a line of its own before the output.
- `-h` is not an option. It is bad usage and exits with status 1, as in TypeScript. Only `--help` prints the usage text.

## Part F: parity harness

A script that proves the two engines agree.

1. Generate cases with spec 2's generator, seeds 1 to N. The harness calls the generator itself: `vp run parity <workDir> <N>` writes the cases to `<workDir>`, which must be outside the repo, builds the release Rust CLI and runs every case.
2. Run each case through the TypeScript CLI on Bun and the Rust CLI, as `--scenario <seed>.scenario.json --today <today>`, with `today` read from `<seed>.json`. Bun is the reference runtime. Node computes whole-number powers differently in the last digit. On 200,000 samples it matched `powf` on all but 5 and disagreed with `powi` on 163,875.
3. Compare the two JSON documents.

The comparison:

- Keys, array lengths, strings, booleans, `null`s, dates, ids and integers must be identical.
- Two numbers `a` and `b` agree when `|a - b| <= 1e-9 * max(1, |a|, |b|)`. Compare them as floats after parsing. `0` and `-0` agree: a zero-interest segment at a negative rate is `-0`, which JavaScript prints as `0` and Rust as `-0.0`. A large whole number such as `1588767481951509500` and `1.5887674819515095e18` are the same float printed two ways.
- An invalid case must fail in both with the same error `code` and the same account or rule id. For `not_finite`, compare the id only when both report one, since the two may meet different overflowing figures first. For `invalid_field` compare the code alone. Rust's deserialiser reports a shape error without knowing which account it was in.
- For every valid case with at least one account, also compare the trace of its first account in the baseline band.
- `effectiveRate` is compared like any other number. Outside the cases marked `growth_periods_over_1000` the two engines do the same operations and it should match exactly. Inside them, a last-bit difference in a deposit can move a poorly conditioned rate by more than the tolerance. Report those separately, with the pool's sensitivity, and do not fail the run on them alone.

Use the traits in `<seed>.json`:

- A failing case names its expected code and ids. Both CLIs must report them, and the harness checks each against the traits as well as against the other.
- Report results grouped by trait, so a difference that only shows with one edge is visible as such.
- Cases with `growth_periods_over_1000` are where the two languages are known to differ in the last bit. Report the largest relative difference inside those cases and outside them separately. Outside them the expectation is zero, and any numeric difference at all there is a mismatch.
- An engine-error case carries only its fault traits, yet the trace of its first account can succeed and reach more than 1,000 growth periods. The harness reads the valid traits of such a case with `observeTraits`.

Rules for the run:

- N is at least 5,000 for the acceptance run.
- The script prints the largest relative difference it saw across all numbers. Record it. If it is below 1e-12, tighten the tolerance to 100 times the observed maximum and rerun.
- Any mismatch is a bug in the port until shown otherwise. Shrink the case to the smallest scenario that still fails, save it under `parity/regressions/` with a name that says what it exercises, and fix the cause. Regression cases run on every later parity run. Turso does the same with what its fuzzer finds.
- Do not raise the tolerance to make a case pass. If a real last-digit difference is larger than 1e-9, stop and report it.

The acceptance run, on 2026-11-28: seeds 1 to 20,000 and 11 regression cases. 309,071,208 numbers compared, no mismatch. Outside the 529 `growth_periods_over_1000` cases every number was identical. Inside them the largest relative difference was 1.61e-10, so the tolerance stays at 1e-9.

## Part G: golden files and property tests

These keep the engine honest after TypeScript is gone.

Golden files:

- The cases are the CLI examples, every regression case, the hand-computed cases in `scripts/golden/hand-computed.ts` (which also hold a rate of `-0.9999999999999999` in both modes and a scenario with no accounts) and 200 generated cases. `crates/cli/tests/golden/manifest` lists them as `group/name`, one per line, sorted.
- Each case folder holds `scenario.json`, `today` and `projection.json`. It also holds `trace`, the first account's id, and `trace.json` exactly when the scenario has an account and its projection succeeds or fails with `not_finite`, the only error a parsed scenario's projection gives. An invalid scenario has no trace. A `not_finite` case does, and its trace may succeed or fail.
- The set was captured once from the TypeScript CLI (`vp run golden-capture 20000`, printed as the Rust CLI prints) and then regenerated with `just golden`, so the committed files are the Rust CLI's output. That regeneration moved only the numbers of the 18 `growth_periods_over_1000` cases, by at most 8.9e-14 relative, and dropped the ids of 5 `invalid_field` errors.
- `crates/cli/tests/golden.rs` runs the CLI on every case and requires stdout to equal the stored file byte for byte, with exit status 0 for a projection and 2 for an error document. On a mismatch it names the case, the file and the first differing JSON path. It checks the case folders against the manifest and the group counts, and each folder's files against the trace rule. The files sit beside it because `core` may not read files, in its tests either.
- `just golden` regenerates the expected files, the trace files and the manifest from the release Rust CLI and swaps the new set in whole. After part H it is the only way they change, and a PR that regenerates them must explain every number that moved.
- The comparison is exact, so a Rust toolchain or a platform maths library that changes a last digit moves golden numbers. Such a regeneration PR says that is the cause and names the toolchain or platform change.

Property tests, with `proptest`:

- Proptest is built without `std` (features `alloc` and `no_std`), so it reads no OS random source, `PROPTEST_*` variable, clock or file. Every property runs through `crate::arbitrary::check`: 256 cases from a fixed ChaCha seed, no failure file, panics shrunk like failures, and the shrunk input in the failure message. `deny.toml` bans the features that bring those reads back, and `crates/core/clippy.toml` bans the runner entry points that bypass the seed.
- A scenario with one fresh account equals `projectAccount` on that account.
- The total equals the sum of the included accounts on every row.
- Raising the rate of an included account that has a positive balance or a deposit from its balance's date to the end never lowers the total's final balance. Cases with no such account are filtered out in the generator.
- The effective rate has the default rate's bits when no account is included. When every included account has the same rate, it has that rate's bits, whatever the pool. Otherwise it has the default rate's bits when the pool is empty, with no balance at today and no deposits, and lies at or between the lowest and highest included rate when it is not.
- Compounding the pool at the effective rate gives the total's final balance within tolerance, for rates in a realistic range. Sixty halvings of a very wide bracket do not get that close.
- An account that is not stale has zero `rolledForward`.
- Moving `today` forward one day never changes a deposit's date or amount.
- Writing a parsed scenario back to a file with every field stated, and parsing that, gives back the same scenario. The writer is test-only.

## Part H: delete TypeScript

Only after parts A to G are merged and the acceptance run has passed.

- Delete `packages/`, the root `package.json`, `bun.lock`, `vite.config.ts`, the tsconfig files and any `node_modules`.
- Delete the parity harness and `parity/`. It cannot run without the TypeScript CLI, and part G already copied its regression cases into the golden set. Check that before deleting.
- Delete `AGENTS.typescript.md` and every pointer to it in `AGENTS.md`.
- Add the Cargo structure, commands and testing notes to `AGENTS.md`. Keep "Coding Style" and "Rust Redesign" with its branches, models, review log, lessons and guidelines.
- Move the example scenarios to `crates/cli/examples/`.
- Record in the README's decision table that the port is done and what the largest observed difference was.

## Acceptance criteria

- `just check` passes.
- The parity run over at least 5,000 cases reports no mismatch, and the largest relative difference is written in the PR and the README.
- Every invalid generated case fails in both CLIs with the same code and id.
- The golden test and all eight property tests pass.
- The effective-rate solve on spec 2's reference case is no slower in Rust than the TypeScript figure recorded in spec 2. Measure on a release build.
- `crates/core` has no dependency that reaches the file system, the clock or the network. `cargo tree -p retirement-core` is in the PR.
- After part H, the working tree has no `.ts` file, `package.json`, `bun.lock` or `node_modules`, and `just check` still passes.

## Out of scope

- Any behaviour change. Fix it in TypeScript under spec 2 first.
- The random config generator, the custom-variable helpers and the logger. They are not ported.
- `tracing` and log files. Those arrive with the app.
- Any UI, GPUI or SnapTrade work.
- A power function written to match JavaScript bit for bit.
