# Spec 3: Rust groundwork

Date: 2026-11-27
Depends on: spec 1
Blocks: spec 4

## Goal

Before any engine code is ported, the repo has a Cargo workspace, one check command, written Rust rules for agents, and one reviewed module that shows what good code looks like here. Agents copy what is in the repo more reliably than they follow prose, so the first module matters more than its size suggests.

This spec touches no TypeScript. It can run while spec 2 is in progress. The types it writes follow spec 2 part C, so start the exemplar after that part's types are merged.

## Part A: workspace

```
Cargo.toml              workspace root
rust-toolchain.toml
rustfmt.toml
clippy.toml
deny.toml
justfile
crates/core/            retirement-core. The engine. Library only.
crates/cli/             retirement-cli. Binary name: retirement-calc.
```

- Edition 2024. `publish = false` on every crate.
- The compiler is the latest stable Rust from Homebrew. On 2026-11-27 that is 1.100.0, the version Zed pins, and this machine was upgraded to it from 1.93.1. Before starting, run `brew upgrade rust` and use whatever stable it installs.
- `[workspace.package]` sets `rust-version` to that version. Homebrew's `cargo` reads it and refuses an older compiler.
- `rust-toolchain.toml` names the same version with the `clippy` and `rustfmt` components. Homebrew's `cargo` ignores this file. It is there for anyone who builds through `rustup`.
- When Homebrew moves to a newer stable, bump both in one commit and fix whatever new default Clippy rules report.
- This machine also has a `rustup` toolchain called `stable` at 1.75.0 from 2023. `cargo` on the `PATH` is Homebrew's, so it is unused. Leave it alone.
- `crates/core` has no file access, clock, network, environment access or async. It depends on nothing that brings those in.
- `crates/cli` depends on `core`. `core` never depends on another workspace crate.
- The app and SnapTrade crates come later. Do not create them.

## Part B: lints and tools

The setup follows what OpenAI Codex, Zed, Goose and Turso do. The README records what each one uses. No whole Clippy group beyond the defaults is switched on.

### Clippy

`[workspace.lints.clippy]`, every entry at `deny`, and every crate sets `[lints] workspace = true`.

| Source | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex  | `expect_used`, `unwrap_used`, `disallowed_methods`, `identity_op`, `manual_clamp`, `manual_filter`, `manual_find`, `manual_flatten`, `manual_map`, `manual_memcpy`, `manual_non_exhaustive`, `manual_ok_or`, `manual_range_contains`, `manual_retain`, `manual_strip`, `manual_try_fold`, `manual_unwrap_or`, `needless_borrow`, `needless_borrowed_reference`, `needless_collect`, `needless_late_init`, `needless_option_as_deref`, `needless_question_mark`, `needless_update`, `redundant_clone`, `redundant_closure`, `redundant_closure_for_method_calls`, `redundant_static_lifetimes`, `trivially_copy_pass_by_ref`, `uninlined_format_args`, `unnecessary_filter_map`, `unnecessary_lazy_evaluations`, `unnecessary_sort_by`, `unnecessary_to_owned` |
| Zed    | `dbg_macro`, `todo`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Turso  | `assigning_clones`, `large_types_passed_by_value`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Ours   | `disallowed_types`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Codex's two `await_holding_*` rules are left out. Nothing here is async.

Clippy runs as `cargo clippy --workspace --all-targets -- -D warnings`, so its default rules are errors too.

### clippy.toml

Root file:

```toml
allow-expect-in-tests = true
allow-unwrap-in-tests = true
```

`crates/core/clippy.toml` repeats those two lines and adds the bans. Each entry carries a reason, because the reason is what the agent reads when the rule fires.

```toml
disallowed-methods = [
  { path = "std::time::SystemTime::now", reason = "core never reads the clock; the caller passes today" },
  { path = "std::time::Instant::now", reason = "core never reads the clock; the caller passes today" },
  { path = "std::env::var", reason = "core takes its inputs as arguments" }
]
disallowed-types = [
  { path = "std::collections::HashMap", reason = "iteration order changes between runs; use BTreeMap or a Vec" },
  { path = "std::collections::HashSet", reason = "iteration order changes between runs; use BTreeSet or a Vec" }
]
```

Prove the split works. A `SystemTime::now()` call must fail the check in `core` and pass in `cli`. If Clippy does not pick up a per-crate file on the pinned version, find the supported way and record it in the PR.

### Formatting

`rustfmt.toml` holds `edition = "2024"` and `style_edition = "2024"`, as Zed's does. No other options.

### Other tools

| Tool            | Job                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------- |
| `cargo-nextest` | Test runner                                                                                   |
| `cargo-deny`    | Fails on known vulnerabilities, licences off the allow list, and sources other than crates.io |
| `cargo-shear`   | Fails on declared dependencies nothing uses                                                   |

`deny.toml` allows the licences Codex allows that our dependencies need, and no more. Start from MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unicode-3.0 and Zlib, and add one only when a dependency requires it. `multiple-versions` is a warning.

### The check command

`just check` runs these in order and stops at the first failure:

1. `cargo fmt --all --check`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `cargo nextest run --workspace`
4. `cargo deny check`
5. `cargo shear`

`just fix` runs `cargo fmt --all` and `cargo clippy --fix --workspace --all-targets --allow-dirty`.

The justfile lists how to install each tool. While TypeScript still exists, `vp check` and `vp test` stay as they are, and `just check` covers Rust only.

## Part C: Rust rules in AGENTS.md

Add a "Rust Guidelines" section under "Rust Redesign". Keep it short. These are the rules no linter can enforce.

Design:

- Invalid input cannot reach the engine. Deserialise the file into a raw type, convert it once into a validated type, and write engine functions that take only the validated type. Engine functions have no error path for bad input.
- Use an enum where the set of values is closed: account kind, frequency, compounding, band, bucket. Never match on strings.
- Give ids and dates their own types. A function that takes an account id cannot be passed a rule id.
- `core` returns an error enum with one variant per failure, carrying the id of the account or rule at fault. `anyhow` and other catch-all error types belong only in binaries.
- No `unsafe` in `core`.
- No trait or generic parameter until two real callers need it.
- No `.clone()` to satisfy the borrow checker. Restructure ownership so the clone is not needed.
- Take `&[T]` and `&str`, not `&Vec<T>` and `&String`. Return owned values or iterators.
- Sum floats in a fixed, documented order. Parity with TypeScript depends on it.

Process:

- A new dependency needs a sentence in the PR: what it is for, and why the standard library or an existing dependency does not cover it.
- The comment rule under "Coding Style" in `AGENTS.md` applies. Code that needs a comment to justify itself is written the wrong way, so find the right way. The same goes for silencing a lint with `#[expect]` and a reason.
- A doc comment that states a field's unit or invariant is a fact about the data, not a justification. Write those. A field that needs neither gets none.
- A bug fix comes with a test that fails without the fix.
- Run `just check` before handing work to review.
- Before writing a new module, read the exemplar named below and match it.

Review agents check each of these rules on every Rust PR and log repeats in the code review log, as the existing process says.

## Part D: the exemplar module

Write the smallest slice of `core` that exercises every design rule, and review it at high effort. It is real code that spec 4 builds on.

- `CalendarDate`. A timezone-free date. Use an established crate's date type inside it, `jiff` first and `time` if `jiff` does not fit. No hand-written leap-year code. It parses and prints `YYYY-MM-DD`, compares, reports the days in its month and year, and adds months.
- The raw file types, matching spec 2 part C field for field, with `serde`.
- The validated `Scenario`, `Account` and `ContributionRule` types, with enums and id types.
- `Scenario::parse(raw, today)`, returning the validated scenario or a `ScenarioError`.
- `ScenarioError`, one variant per code in spec 2's validation table. Each variant exposes the same `code` string as TypeScript.
- Unit tests: one per error code, the leap-year and month-end cases, and a round trip of each spec 2 example file through parse and serialise.

When it merges, name its files in "Rust Guidelines" as the pattern to follow.

## Acceptance criteria

- `just check` passes on a clean checkout with Homebrew's stable Rust, `just` and the three tools installed.
- Each of these, added in turn, fails `just check` with the expected rule and is then removed: an `.unwrap()` in `core` outside tests, a `dbg!`, a `todo!()`, a `HashMap` in `core`, a `SystemTime::now()` in `core`, an unused dependency, a dependency under a licence off the allow list. Record the seven outputs in the PR.
- The same `SystemTime::now()` in `cli` passes.
- The exemplar's tests cover every validation code.
- `AGENTS.md` has the "Rust Guidelines" section and names the exemplar files.
- `vp check` and `vp test` still pass. No TypeScript file changed.

## Out of scope

- The schedule builder, compounding and everything else in the engine. That is spec 4.
- The `pedantic`, `nursery`, `restriction` and `cargo` Clippy groups, required docs on public items, function-size limits and `cargo-mutants`. All four were considered and dropped in favour of what the reference repos do.
- Custom lints.
- CI. None exists and this spec adds none.
- Any GPUI or SnapTrade dependency.
