# Repository Guidelines

The repo is mid-redesign. The app is being rebuilt in Rust on GPUI, and the TypeScript code stays only until the Rust port passes. See "Rust Redesign" below.

## Where Things Are

- `implementation/rust-redesign/`: the specs for the redesign. Start with its `README.md`.
- `implementation/`, `qa/`: older specs, audits and rollout tracking docs.
- `.codex/notes/`: working notes from earlier tasks.
- `packages/`: the TypeScript code. Before touching anything there, read [AGENTS.typescript.md](AGENTS.typescript.md). It has the structure, commands, style and testing rules for that code.
- `crates/`: the Rust workspace. `crates/core` (`retirement-core`) is the engine, a pure library. `crates/cli` (`retirement-cli`) builds the `retirement-calc` binary. Read "Rust Guidelines" below before touching it.
- `Cargo.toml`, `clippy.toml`, `crates/core/clippy.toml`, `rustfmt.toml`, `deny.toml`, `rust-toolchain.toml`: Rust lint, format and dependency rules.
- `justfile`: the Rust commands. `just check` runs every Rust check; `just fix` applies formatting and Clippy fixes. Its header says how to install the tools.

## Coding Style

These apply in every language.

- If you're writing a comment to explain why you did something, that means it's not the right way. Stop and find the right way to implement it.

## Commit & Pull Request Guidelines

- Follow concise, imperative commit messages. Current history commonly uses:
  - `refactor(webapp): ...`, `test(e2e): ...`, `docs: ...`
- Keep commits scoped to one concern.
- PRs should include:
  - what changed and why, test evidence, and UI screenshots/videos where relevant.
  - linked/updated docs in `implementation/` or `qa/` when behavior or rollout status changes.

## Rust Redesign

Specs live in `implementation/rust-redesign/`. Read its `README.md` first, then the spec for the step you are on. This plan replaces the gpuix port. The web target is dropped, and the app is being rebuilt in Rust on GPUI.

### Branches

- `rust-redesign` is the long-running integration branch for the redesign. It was cut from `gpuix-port`.
- Open every redesign PR against `rust-redesign`, not `main` or `gpuix-port`. Stacked PRs may target the PR below them, as long as the bottom of the stack targets `rust-redesign`.
- `rust-redesign` merges into `main` once, when the Rust app replaces the live site. Merge `main` into `rust-redesign` when it needs fixes landed on `main`.
- The live site is built from `main`. Do not merge redesign work there early.

### Models

- Orchestration agent: Fable 5.2.
- Implementation agents: Opus 5.5.
- Code review agents: GPT 6.2 Sol when the work under review is low or medium effort, GPT 6.2 Astra when it is high effort. The orchestrator states the effort level when it hands work to review.
- If the GPT reviewer is out of usage, review with Grok 4.7 through Cursor at the same effort level. Go back to GPT 6.2 when its limit resets. Do not switch reviewers for any other reason without asking.
- The effort level for each part of each spec is in the "Orchestration" table of `implementation/rust-redesign/README.md`.

### Code Review Log

- Review agents keep running notes in `implementation/rust-redesign/code-review-log.md`. Record code smells and habits the implementers show, one entry per finding.
- Before adding an entry, search the log for the same problem. If it has happened before, add a guideline under "Lessons From Review" below so later agents stop repeating it, and mark the log entries as promoted.
- Only PR review agents read or write the log. Orchestration and implementation agents do not open it. They get its lessons through this file.

### Lessons From Review

- Put new lessons here unless they only apply to TypeScript.
- Include collection lengths or explicit record boundaries when hashing structured output for parity.
- Publish related golden fixtures as a single generation. Readers must keep seeing a complete generation if publication fails.
- When exact arithmetic must survive a refactor, specify grouping, summation order, and the metadata needed to reproduce them.
- Keep a deposit's resolved date and its compounding bucket separately when range checks and interest use different rules.
- Test each specified float reduction and midpoint with inputs that round differently under a plausible reordering or regrouping.
- Specify how each timing variant resolves missing and out-of-month days before porting its calendar logic.
- Validate original fixture JSON at its first parse. Reject misplaced or unknown keys before a parser can discard them.
- Validate run options as strictly as the file they accompany. Reject unknown keys before extracting values from either.
- Translate legacy bounds by checking which dates could actually deposit. Preserve the growth anchor independently and normalize impossible recurring dates before validation.
- In partial ranges, filter deposits by their resolved dates before totalling the retained deposits by bucket.
- Write salary-share formulas with explicit parentheses around the basis division and the percentage conversion.
- Test a comparison at the equal value, not only on the side that fails.
- Ban a dependency's clock and I/O paths from the version in the lockfile, including the sibling that does the work, and show that calling each one fails `just check`.
- Exercise a nonempty projection in the last supported month through the public entry point.
- Compare golden figures to the public output wherever it supplies them. Pin the expected fixture groups as well as their total count.
- If several accounts can overflow, specify which error subjects parity compares or use single-fault inputs.
- Test documented machine-readable commands as subprocesses, including the launcher, stdout, stderr and exit status.
- Check temporal and arithmetic claims at their boundaries, including intermediate overflow before a reciprocal.
- Exercise equivalent ways to read the clock when a source guard promises clock independence.

### Rust Guidelines

These are the rules no linter enforces. Clippy, rustfmt, `cargo-deny` and `cargo-shear` enforce the rest through `just check`.

Commands:

- `just check`: format check, Clippy, tests, `cargo deny check` and `cargo shear`, stopping at the first failure. Run it before handing work to review.
- `just fix`: apply rustfmt and Clippy's automatic fixes.
- While TypeScript exists, `vp check` and `vp test` still cover it. `just check` covers Rust only.

Design:

- Invalid input cannot reach the engine. Deserialise into a raw type, convert it once into a validated type, and have engine functions take only the validated type. Engine functions have no error path for bad input.
- Use an enum where the set of values is closed: account kind, frequency, compounding, band, bucket. Never match on strings.
- Give ids and dates their own types, so a function that takes an account id cannot be passed a rule id.
- `core` returns an error enum with one variant per failure, carrying the id of the account or rule at fault. `anyhow` and other catch-all error types belong only in binaries.
- `core` has no file access, clock, network, environment access, process spawning or async, and depends on nothing that brings those in. `crates/core/clippy.toml` bans the calls by path. When you add a dependency to `core`, ban its clock and I/O calls in the same commit. `unsafe` is forbidden in every crate.
- No trait or generic parameter until two real callers need it.
- No `.clone()` to satisfy the borrow checker. Restructure ownership instead.
- Take `&[T]` and `&str`, not `&Vec<T>` and `&String`. Return owned values or iterators.
- Sum floats in a fixed, documented order. Parity with TypeScript depends on it.

Process:

- A new dependency needs a sentence in the PR: what it is for, and why the standard library or an existing dependency does not cover it.
- The comment rule under "Coding Style" applies, and so does silencing a lint with `#[expect]` and a reason. Find the way that needs neither.
- A doc comment that states a field's unit or invariant is a fact about the data, not a justification. Write those. A field that needs neither gets none.
- A bug fix comes with a test that fails without the fix.
- Before writing a new module, read the exemplar and match it: `crates/core/src/date.rs` and `crates/core/src/scenario/` (`raw.rs`, `mod.rs`, `account.rs`, `rule.rs`, `error.rs`, `tests.rs`). Imitate how the raw file types become validated types with private fields and accessors, how each validator returns an error that names the account or rule at fault without cloning ids, and how the tests build input from JSON text and edit one field per case.
- Review agents check each of these rules on every Rust PR and log repeats in the code review log.

### Finishing Work

- When work is finished, end the report with 1 to 3 next steps.

## Agent Notes

- Add brief working notes in `.codex/notes/` for substantial problems/solutions.
- Use the btca CLI to ask questions about external codebases.
