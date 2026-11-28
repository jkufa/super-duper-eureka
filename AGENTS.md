# Repository Guidelines

The repo is mid-redesign. The app is being rebuilt in Rust on GPUI, and the TypeScript code stays only until the Rust port passes. See "Rust Redesign" below.

## Where Things Are

- `implementation/rust-redesign/`: the specs for the redesign. Start with its `README.md`.
- `implementation/`, `qa/`: older specs, audits and rollout tracking docs.
- `.codex/notes/`: working notes from earlier tasks.
- `packages/`: the TypeScript code. Before touching anything there, read [AGENTS.typescript.md](AGENTS.typescript.md). It has the structure, commands, style and testing rules for that code.
- `crates/`: the Rust workspace. It does not exist until spec 3 creates it.

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
- Test summation order with values that round differently when reordered within a bucket.
- Specify how each timing variant resolves missing and out-of-month days before porting its calendar logic.
- Validate original fixture JSON at its first parse. Reject misplaced or unknown keys before a parser can discard them.
- Validate run options as strictly as the file they accompany. Reject unknown keys before extracting values from either.
- Translate legacy bounds by checking which dates could actually deposit. Preserve the growth anchor independently and normalize impossible recurring dates before validation.
- In partial ranges, filter deposits by their resolved dates before totalling the retained deposits by bucket.
- Write salary-share formulas with explicit parentheses around the basis division and the percentage conversion.

### Finishing Work

- When work is finished, end the report with 1 to 3 next steps.

## Agent Notes

- Add brief working notes in `.codex/notes/` for substantial problems/solutions.
- Use the btca CLI to ask questions about external codebases.
