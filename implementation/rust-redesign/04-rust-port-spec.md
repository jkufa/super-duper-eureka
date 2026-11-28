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
- The schedule is a `Vec` of deposits in a fixed order: by date, then by the rule's position in the file. Compounding and the effective rate depend on that order.
- Use the built-in `f64::powi` for whole-number powers and `f64::powf` for the rest. Do not write a power function to match TypeScript. Decision 12 accepts the last-digit difference.
- Port the TypeScript unit tests for deposits and amounts one for one, with the same inputs and expected values.

## Part B: compounding and account projection

Port `compound` and `projectAccount` from spec 2 parts B and D, both modes, with the segment rule for partial months.

- Keep the order of arithmetic the same as TypeScript. Where the order matters, a test pins it.
- Do not use `mul_add` or other fused forms. They change the last digit, and plain expressions are easier to compare with the TypeScript. If a Clippy rule in our set asks for one, stop and report it. Do not silence it.
- Port the hand-computed tests from spec 2 part D with the same expected values.

## Part C: scenario projection

Port `projectScenario` from spec 2 parts E and F: the roll forward, the per-account series, the total, the three bands, `staleAccounts`, the effective rate and the weighted rate.

- The effective rate runs exactly 60 passes, with the same shortcuts in the same order as spec 2.
- Sum accounts in file order.
- The output types serialise to the same JSON field names as TypeScript. An absent optional field is omitted, not `null`. `weightedRate` is the one field that can be `null`.

## Part D: step trace

Port `traceAccount`. Same records, same field names.

## Part E: CLI

`retirement-calc` with the flags, output and exit codes from spec 2 part G.

- Argument parsing uses `clap`. JSON uses `serde_json` with its `float_roundtrip` feature, so a number read from a file is the nearest float, as it is in JavaScript.
- `--today` defaults to the machine's local date. This is the only place in the workspace that reads the clock.
- A catch-all error type is fine here. Errors from `core` still print as the JSON error object and exit with status 2.
- Run every example file from spec 2 through both CLIs and compare by eye before part F automates it.

## Part F: parity harness

A script that proves the two engines agree.

1. Generate cases with spec 2's generator, seeds 1 to N.
2. Run each case through the TypeScript CLI and the Rust CLI, with `--today` set from the case.
3. Compare the two JSON documents.

The comparison:

- Keys, array lengths, strings, booleans, `null`s, dates, ids and integers must be identical.
- Two numbers `a` and `b` agree when `|a - b| <= 1e-9 * max(1, |a|, |b|)`.
- An invalid case must fail in both with the same error `code` and the same account or rule id.
- For every valid case also compare the trace of its first account in the baseline band.

Rules for the run:

- N is at least 5,000 for the acceptance run.
- The script prints the largest relative difference it saw across all numbers. Record it. If it is below 1e-12, tighten the tolerance to 100 times the observed maximum and rerun.
- Any mismatch is a bug in the port until shown otherwise. Shrink the case to the smallest scenario that still fails, save it under `parity/regressions/` with a name that says what it exercises, and fix the cause. Regression cases run on every later parity run. Turso does the same with what its fuzzer finds.
- Do not raise the tolerance to make a case pass. If a real last-digit difference is larger than 1e-9, stop and report it.

## Part G: golden files and property tests

These keep the engine honest after TypeScript is gone.

Golden files:

- Take the outputs of the TypeScript CLI for the example files, every regression case, the hand-computed cases and 200 generated cases.
- Commit each as an input and an expected output under `crates/core/tests/golden/`.
- A Rust test runs every input and compares with the same rule as the parity harness.
- A second command regenerates the expected files from the Rust engine. After part H it is the only way they change, and a PR that regenerates them must explain every number that moved.

Property tests, with `proptest`:

- A scenario with one fresh account equals `projectAccount` on that account.
- The total equals the sum of the included accounts on every row.
- Raising any account's rate never lowers the total's final balance.
- The effective rate is at or between the lowest and highest included rate.
- Compounding the pool at the effective rate gives the total's final balance within tolerance.
- An account that is not stale has zero `rolledForward`.
- Moving `today` forward one day never changes a deposit's date or amount.
- Parsing a serialised valid scenario gives back the same scenario.

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
