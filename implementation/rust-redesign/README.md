# Rust redesign

Date: 2026-11-27
Status: spec 1 and all of spec 2 are built. The old engine is deleted, and the CLI runs the new one. Spec 3 is built. Spec 4 is in progress
Replaces: the gpuix port plan. Its specs and the chart geometry PoC are in git history at `2f5b79d`, under `implementation/gpuix-port/`.

The retirement calculator becomes a macOS desktop app written in Rust on GPUI. There is no web target. The data model changes from one lump-sum balance to many accounts, each with its own balance, return and contribution rules. SnapTrade sync comes last and uses the owner's own API key.

The contract changes land in the TypeScript calculator first, because that is the code with tests we trust. The engine then moves to Rust and is checked against the TypeScript one. After that, all TypeScript is deleted.

## Specs, in order

1. [Clear the branch](01-clear-the-branch-spec.md)
2. [TS engine rebuild](02-ts-engine-rebuild-spec.md)
3. [Rust groundwork](03-rust-groundwork-spec.md)
4. [Rust port](04-rust-port-spec.md)
5. GPUI app. Not specified. It needs its own interview first. See "For the GPUI interview" below.
6. SnapTrade. Not specified. It comes after the app.

Spec 3 touches no TypeScript, so it can run while spec 2 is in progress. Spec 4 needs both.

## Decisions

| #   | Decision                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Desktop only. The web target is dropped. The live site keeps running from `main` until the Rust app replaces it.                                                                                                     |
| 2   | The UI is GPUI in Rust. gpuix-svelte is dropped, although its spike passed.                                                                                                                                          |
| 3   | Work order: change the contract in TypeScript, port the core and the CLI to Rust, build the app, add SnapTrade.                                                                                                      |
| 4   | Accounts are independent projections. The total is their sum. The output carries one projection per account plus the total, so the UI can drill into an account.                                                     |
| 5   | Contribution rules belong to one account each. Salary is scenario-wide.                                                                                                                                              |
| 6   | The scenario has a default return. An account may override `annualRate` only. Variance and compounding are scenario-wide.                                                                                            |
| 7   | The single return figure is the effective rate: the one rate at which a pooled lump sum ends on the same total as the sum of the accounts. Fixed 60-pass bisection, baseline only.                                   |
| 8   | The yearly rows of the total carry a balance-weighted rate for the tooltip.                                                                                                                                          |
| 9   | The engine has two phases. Build a schedule of dated deposits, then compound it. Step detail is produced on request.                                                                                                 |
| 10  | The legacy app, `apps/web`, `apps/desktop`, `packages/ui` and `apps/e2e` are deleted on this branch before the contract changes.                                                                                     |
| 11  | TypeScript is a temporary oracle. After the port passes, golden files are committed and all TypeScript, Bun and Vite+ tooling is deleted. The CLI is ported with the engine.                                         |
| 12  | TS and Rust agree within a tolerance, not bit for bit. Structure, dates, ids and counts must match exactly. Numbers must agree within one part in a billion. Rust uses its built-in maths.                           |
| 13  | Dates are plain year, month and day with no timezone. Months are 1 to 12. Rules are anchored to calendar dates. The engine never reads the clock. The caller passes today.                                           |
| 14  | Each account has its own as-of date and is projected from it. An account whose as-of date is before today is stale, and the UI flags its figures as estimated.                                                       |
| 15  | A projection starts on the actual day. The first and last months count only the days inside the range.                                                                                                               |
| 16  | The scenario saves an end date. The UI takes a number of years and converts it once to 1 January of that year.                                                                                                       |
| 17  | Ported to Rust: engine, step trace, CLI, and the factories as test helpers. Not ported: the random config generator, the custom-variable helpers and the logger package.                                             |
| 18  | Logging in the app is `tracing` writing JSON to a local file. No OpenTelemetry export. The repo never used OpenTelemetry.                                                                                            |
| 19  | Lints and review agents judge Rust quality. The owner reviews behaviour and the written guide.                                                                                                                       |
| 20  | The lint setup follows OpenAI Codex, Zed, Goose and Turso: Clippy defaults as errors, a picked list as errors, a banned-calls list with reasons, a pinned compiler, `cargo-nextest`, `cargo-deny` and `cargo-shear`. |
| 21  | `crates/core` is pure. It has no file access, clock, network or async. Input is validated once into a type the engine trusts.                                                                                        |
| 22  | Work lands on `rust-redesign`, cut from `gpuix-port`. It merges into `main` once, when the Rust app replaces the live site.                                                                                          |
| 23  | No GPUI spike gates the port. The owner trusts GPUI for this app.                                                                                                                                                    |

## Defaults nobody confirmed

The interview did not settle these. The specs assume them. Change them here first if they are wrong.

| Question                                  | Assumed default                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Account `kind`                            | A label with no effect on the maths: `pretax`, `roth`, `taxable` or `other`                                                |
| Money in the saved file                   | Plain dollar numbers. The file has a `version` field                                                                       |
| What the end date includes                | It is a boundary. The last day counted is the day before it                                                                |
| What an as-of date means                  | The balance at the start of that day, so that day earns interest                                                           |
| When salary raises apply                  | Salary has its own `asOf` date. A raise applies on each 1 January after it                                                 |
| What growth on a rule counts from         | Whole years or months elapsed since the rule's `startDate`. A rule with growth must have one                               |
| How a partial month earns in monthly mode | The month's interest times the share of its days inside the range                                                          |
| Negative balances                         | A validation error. The effective rate needs balances and deposits at zero or above                                        |
| Compiler version                          | Settled: latest stable from Homebrew, 1.100.0 on 2026-11-27. This machine was upgraded to it from 1.93.1 that day          |
| Task runner for the Rust checks           | `just`, as Codex and Goose use                                                                                             |
| Rust date type                            | An established crate's timezone-free date, `jiff` first and `time` second. No hand-written leap-year code                  |
| The first exemplar module                 | The date and validated scenario types, in spec 3. The schedule builder is the second exemplar and the first unit of spec 4 |

## Accepted risk

GPUI has not been tested for this app's forms, charts or agent verification, and the engine moves to Rust before it is. If GPUI falls short after spec 4, the fallback is gpuix-svelte on desktop. That would need the Rust engine exposed to it, or the TypeScript engine restored from history.

## Orchestration

The models are set in `AGENTS.md` under "Rust Redesign", "Models". They are unchanged from the gpuix plan: Fable 5.2 orchestrates, Opus 5.5 implements, GPT 6.2 Sol reviews low and medium effort work, GPT 6.2 Astra reviews high effort work. The orchestrator states the effort level when it hands work to review. Use this table.

| Work                                                            | Review effort |
| --------------------------------------------------------------- | ------------- |
| Spec 1, all of it                                               | Low           |
| Spec 2 part A (baseline capture) and part G (CLI and examples)  | Medium        |
| Spec 2 parts B to F (engine)                                    | High          |
| Spec 2 part H (corpus generator)                                | Medium        |
| Spec 3 tooling and `AGENTS.md` text                             | Medium        |
| Spec 3 exemplar module                                          | High          |
| Spec 4 parts A to D (schedule, compounding, scenario, trace)    | High          |
| Spec 4 part E (CLI)                                             | Medium        |
| Spec 4 parts F and G (parity harness, golden files, properties) | High          |
| Spec 4 part H (TypeScript deletion)                             | Low           |

One PR per part. Each PR targets `rust-redesign`, or the PR below it in a stack.

## Facts the plan rests on

- The engine is deterministic. Variance is three runs, at the rate, the rate plus the variance and the rate minus it. There is no Monte Carlo.
- Measured on this machine with Bun 1.4.5, a 30-year projection and five rules. Rerunning today's engine 60 times takes 37.6 ms with monthly compounding and 62.3 ms with daily. A compound-only loop over a prebuilt schedule takes 0.07 ms and 1.5 ms for the same 60 passes. The second pair is a stripped-down prototype loop.
- Power results were compared on 200,000 random inputs across Bun 1.4.5, Node 24.13 and Rust 1.100. The fractional roots `(1+r)^(1/12)`, `^(1/365)` and `^(1/366)` were identical in all three. For `(1+r)^n` with a whole-number `n`, Bun's `**` matched Rust's `powi` every time, and Node's `**` matched Rust's `powf` on all but 5. Bun and Node differed from each other on 163,875. So the TypeScript engine gives different last digits on Bun and on Node. The unit tests and the baseline run on Node. The CLI and the parity run use Bun. That agreement holds for exponents from 0 to 1000. Above 1000, which takes more than 83 years of monthly growth, the two differ in the last bit on about one input in five: `1.5` to the 1008th power is the smallest case found. That too falls under the tolerance. For a negative whole-number exponent, Bun's `**` matched `powf` on 100,000 of 100,000 samples and `powi` on 12,695. The engine had one negative exponent, a salary in a year before `salary.asOf`. A review then showed the two could differ entirely there with large values, since one overflows before taking the reciprocal, and that a last-bit difference in a deposit could flip an ill-conditioned effective rate from one end of its bracket to the other. So the salary formula now divides by a positive power for earlier years, and no exponent in the engine is negative. Decision 12's tolerance stays as the rule.
- Today's engine credits a full first month of interest whatever the start day. On $250,000 at 6% starting on the 27th, that is about $1,200 where about $160 is due.
- Today's monthly growth counts from January of the start year, even when the projection starts in July.
- The legacy form already works in calendar years and months 1 to 12 and converts to offsets before it calls the engine.
- `main` last moved on 2026-11-21, at `ddbb779`. `rust-redesign` contains every commit on it.
- The live site builds from `main`. GitHub's deployment records show every Production deployment came from a commit on `main`, the latest from `ddbb779`. Pushes to the gpuix and redesign branches produce Preview deployments only, and those fail once spec 1 deletes the app.
- Lint research, read on 2026-11-27 from the repos' own files. Codex lists 36 Clippy rules as errors and enables no whole group. Zed lists 5 and switches the `style` group off. Turso lists 10. Goose uses the defaults. Codex and Zed pin the compiler and use `cargo-shear`. Codex uses `cargo-nextest` and `cargo-deny`.

## For the GPUI interview

Open questions for step 5, with the facts found so far.

- How GPUI is pinned. The published `gpui` crate is 0.2.2 from October 2025. Its README says it is pre-1.0 with frequent breaking changes. GPUI Kit from Longbridge pins a matching GPUI itself.
- The component library. `gpui-component` is at 0.11.0, published 2026-11-23, with a release most weeks. Its README names data tables, virtual lists and built-in charts. It does not name text inputs, selects or date pickers, so check its docs before relying on them.
- How agents verify the UI. This machine denies Screen Recording to agent sessions. GPUI has a `gpui::test` macro and `TestAppContext`. Zed's screenshot tests use Zed's own runner and need Screen Recording.
- Screen scope: the account list, the stacked chart, the drill-down, whether a debugger screen exists, and how rule timing is entered.
- Where scenarios are saved, and whether there is more than one.
- Lint tier for the app crate. Decision 20 applies. Zed does not apply strict style rules to GPUI code.
- Working rules worth copying from gpuix's `AGENTS.md`: read GPUI's source before writing against it, search Zed's issues before working around anything, give elements stable name ids and never list indexes, keep one scroll container, judge performance on release builds only.
- Build needs Xcode and `cmake`, and may need `xcodebuild -downloadComponent MetalToolchain` once.

## SnapTrade facts for step 6

- There is no Rust SDK and no `snaptrade` crate. Official SDKs are Python, TypeScript, Java, Ruby, C#, PHP and Go.
- A direct call is signed. Add `clientId` and a Unix `timestamp` to the query string. Build a JSON object with `content`, `path` and `query`, sort its keys, strip whitespace, compute HMAC-SHA256 with the consumer key, Base64 the digest and send it in the `Signature` header. The docs have a worked example to use as a test vector.
- A "Personal API Key" mode exists, which is the bring-your-own-key case.
- Reads cover positions, balances and typed transactions. Nothing exposes a recurring deposit schedule. The account type is free text from the brokerage, which is why `kind` is set by the user.
- Fidelity is read-only and needs approval before the first connection. Whether a Fidelity employer 401k comes through is unknown.
- A sync replaces balances and sets each synced account's as-of date to today. Decisions 13, 14 and 16 exist so that this moves nothing else.

## References

- gpuix spike results: [../../.codex/notes/2026-11-26-gpuix-spike.md](../../.codex/notes/2026-11-26-gpuix-spike.md)
- Earlier desktop research: [../retirement-desktop-research.html](../retirement-desktop-research.html)
- Codex lint config: https://github.com/openai/codex/blob/main/codex-rs/Cargo.toml
- Zed lint config: https://github.com/zed-industries/zed/blob/main/Cargo.toml
- gpuix agent rules: https://github.com/remorses/gpuix/blob/main/AGENTS.md
- GPUI: https://github.com/zed-industries/zed/tree/main/crates/gpui
- GPUI Kit: https://github.com/longbridge/gpui-kit
- SnapTrade request signatures: https://docs.snaptrade.com/docs/request-signatures
