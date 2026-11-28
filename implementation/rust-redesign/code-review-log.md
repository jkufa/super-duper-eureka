# Code review log

For PR review agents only. Orchestration and implementation agents do not read this file.

## How to use it

1. After each review, add one entry per code smell or implementer habit you found. Skip one-off typos and anything the lint task already catches.
2. Before adding an entry, search this file for the same problem.
3. If it has happened before, add a guideline to "Lessons From Review" in `AGENTS.md`, phrased as an instruction, and set `Promoted` to yes on every matching entry here.

## Entry format

```
### YYYY-MM-DD, spec N, short name of the problem
- Where: file paths or PR
- What: what the implementer did
- Better: what they should do
- Seen before: no, or the dates of earlier entries
- Promoted: no, or yes with the AGENTS.md bullet
```

## Entries

### 2026-11-26, spec 1, build cache omits a build-time environment variable

- Where: `apps/webapp-legacy/vite.config.ts` (431835c)
- What: The legacy build substitutes `MOCK_REAL_DATA` at compile time, but changes to the variable leave the Vite Task cache warm.
- Better: Declare compile-time environment variables as cache inputs and verify that changing a value triggers a fresh build.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 1, cached generator omits required artifacts

- Where: `apps/webapp-legacy/vite.config.ts` (b2a73a2)
- What: A cached SvelteKit sync can replay success without restoring the generated tsconfig that the next command requires.
- Better: Restore the generator's outputs on a hit or execute the generator uncached.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 1, task migration leaves app setup instructions behind

- Where: `apps/webapp-legacy/README.md` (431835c)
- What: Removing the package scripts broke the app README's development and build commands. Its recreation command also installs the retired tools.
- Better: Check workspace-level setup instructions when removing scripts or replacing tooling.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, generated servers resolve another package's dependency major

- Where: `bun.lock`, PR #6
- What: Adding Kit 3 hoisted `cookie@2` and `devalue@6`. The legacy production server loads them from its output directory. Prerendering fails on the missing `cookie.parse` export. Fixing cookie alone still leaves Kit 2's streamed page data using an incompatible serializer.
- Better: Make compatible runtime dependencies resolvable from each generated app. Build both production targets from the lockfile and exercise the emitted servers when introducing another framework major.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, desktop type resolution falls through on Svelte subpaths

- Where: `apps/desktop/tsconfig.json`, PR #6
- What: The resolution probe checked the package root. Subpaths such as `svelte/reactivity` lack a matching file at the wildcard target, so TypeScript loads the registry declarations alongside the bundled declarations.
- Better: Resolve public subpaths to the type entries in the bundled package's exports. Verify both install layouts with a shared importer and an API that differs between versions.
- Seen before: no
- Promoted: yes, the desktop Svelte path mapping guideline in AGENTS.md

### 2026-11-26, spec 2, runtime guard checks import spelling

- Where: `apps/web/vite.config.ts`, PR #6
- What: The guard checks bare Svelte imports. A build probe imported the resolved gpuix runtime path and both the SSR and client bundles included two runtimes without an error.
- Better: Check the emitted chunks' module IDs against the app's Svelte package directory in both build environments.
- Seen before: no
- Promoted: yes, the emitted chunks and bundled runtime identity guidelines in AGENTS.md

### 2026-11-26, spec 2, desktop markup checks depend on a TypeScript script tag

- Where: `apps/desktop/tsconfig.json`, PR #6
- What: A shared component containing only a div with a DOM-only `title` attribute passed the GPUI check. The negative test in the spike used a component with a TypeScript script block.
- Better: Enable `checkJs` for the desktop check and test a markup-only component alongside a TypeScript component.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, shared module edits get no desktop restart notice

- Where: `apps/desktop/app.ts` and `AGENTS.md`, PR #6
- What: The shared watcher ignores TypeScript changes. Editing a shared helper leaves the running window on the old code, although the development instructions say the directory hot-reloads.
- Better: Document the file extensions that remount and give the same restart notice for shared module changes that gpuix gives for app-local ones.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, directory equality stands in for Kit version compatibility

- Where: `scripts/check-kit-deps.ts:117`, PR #6 second pass
- What: With a workspace override for `devalue@6.0.4`, the checker exits zero for both apps. The Kit 3 build succeeds and its streamed HTML request returns HTTP 500. A separate copy of the exact same compatible `devalue@5.9.4` produces the opposite result and tells the developer to add a dependency already declared.
- Reproduce in separate scratch copies at `5a8081e`. Add `"devalue": "6.0.4"` to the root `overrides`, run `bun install --linker hoisted` and `bun scripts/check-kit-deps.ts` (exit 0). Give a Kit 3 page a server load returning `{ slow: new Promise(resolve => setTimeout(() => resolve({ label: "ok", when: new Date(0) }), 80)) }` and render `slow` in an await block. Run `vp run --no-cache web#build`, serve with `vp preview` from `apps/web`, and GET the route as HTML. The build succeeds and the request returns 500. With the unmodified hoisted lockfile, `cp -R node_modules/devalue apps/web/node_modules/devalue` makes the checker reject 5.9.4 versus 5.9.4 (exit 1). Separately, renaming the root `node_modules/devalue` out of the way on the clean install makes both lookups return `undefined` and the checker passes (exit 0).
- Better: Require an installed version satisfying the owning Kit's declared range. Exercise both an incompatible shared copy and compatible separate copies.
- Seen before: no
- Promoted: yes, the dependency diagnostic guideline in AGENTS.md covers the redundant install advice

### 2026-11-26, spec 2, Kit source imports stand in for server externals

- Where: `scripts/check-kit-deps.ts:68`, PR #6 second pass
- What: On an isolated install the checker fails for `esm-env` in the new web app. The emitted server has no bare import of it. The production route builds, streams and hydrates without an app-level installation.
- Reproduce with a fresh `bun install --frozen-lockfile --linker isolated`, then `bun scripts/check-kit-deps.ts`. It reports three mismatches: `esm-env` for both apps and `set-cookie-parser` for legacy. Neither emitted server imports `esm-env`. Legacy's isolated `chunks/utils.js` includes the parser implementation, whereas the hoisted output imports it by name. For the isolated legacy chunks, run `MOCK_REAL_DATA=true vp build` from `apps/webapp-legacy`; it emits the chunks before failing to resolve `zod`. The full isolated legacy build task stops earlier in the logger package on missing Node types.
- Better: Scope a fast pre-build check to known external dependencies such as `cookie` and `devalue`. Use emitted server imports if the check needs to discover more dependencies automatically.
- Seen before: 2026-11-26, spec 2, runtime guard checks import spelling
- Promoted: yes, the emitted chunks guideline in AGENTS.md

### 2026-11-26, spec 2, desktop Svelte wildcard maps a JSON export to declarations

- Where: `apps/desktop/tsconfig.json:50`, PR #6 second pass
- What: A shared default import of `svelte/package.json` passes the web check and runs through the gpuix launcher. Desktop reports TS2306 because the wildcard maps the manifest to a file of ambient module declarations. The previous desktop config accepted the import.
- With a shared module that prints the imported manifest's version, `gpuix-svelte --bun` prints `5.59.2` in both layouts. Its runtime plugin skips string-valued exports, including the manifest, and normal resolution from the shared importer selects the registry manifest.
- Better: Limit the ambient declaration mapping to exports that use it. Let the manifest resolve as JSON and verify which manifest the launcher reads from the shared importer.
- Seen before: 2026-11-26, spec 2, desktop type resolution falls through on Svelte subpaths
- Promoted: yes, the desktop Svelte path mapping guideline in AGENTS.md

### 2026-11-26, spec 2, desktop checker adds browser globals to shared code

- Where: `apps/desktop/vite.config.ts`, PR #6 second pass
- What: In both install layouts, a shared helper reading `document.title` passes the desktop Svelte check. Plain TypeScript with the desktop config reports TS2584. The spike notes already document the checker loading Svelte's browser declarations.
- Better: Track this separately from Q1's GPUI markup check. Before relying on a check for browser globals, exercise a shared TypeScript helper and a shared component script.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, runtime guard infers package identity from the install directory name

- Where: `apps/web/vite.config.ts:19`, PR #6 second pass
- What: In a scratch copy, run `bun add svelte-compat@npm:svelte@5.50.0` in `apps/web`, then call `tick` from both `svelte-compat` and `svelte` in a page click handler. The uncached web build succeeds. Client chunk module IDs include both packages' `src/internal/client/runtime.js`. The alias directory fails the regex for a directory literally named `svelte`.
- Better: For the general one-runtime assertion, identify Svelte by its owning manifest's name and compare its real package directory with the app's resolved Svelte. Cache owner lookups during the build.
- Seen before: 2026-11-26, spec 2, runtime guard checks import spelling
- Promoted: yes, the emitted chunks and bundled runtime identity guidelines in AGENTS.md

### 2026-11-26, spec 2, Kit checker recommends an existing declaration

- Where: `scripts/check-kit-deps.ts:84`, PR #6 third pass at `df167f8`
- What: Set the root `overrides.devalue` to `6.0.4`, run `bun install --linker hoisted`, then `bun scripts/check-kit-deps.ts`. The check correctly exits 1, but tells both apps to add the exact ranges they already declare. Following the advice keeps the incompatible override in effect.
- Better: When the app already declares the requested range, point to the override or installed copy. Keep the add-dependency hint for an absent declaration.
- Seen before: 2026-11-26, spec 2, directory equality stands in for Kit version compatibility
- Promoted: yes, the dependency diagnostic guideline in AGENTS.md

### 2026-11-26, spec 2, hover tooltip extends below the plot

- Where: `packages/ui/src/ProjectionChart.svelte:51`, PR #7
- What: Q4's hover evidence uses the default rate. At 1200 × 800, commit 10% and hover over 2026. The tooltip ends at y=787.73 and the plot clips it at y=776. Headless GPUI reports the same bounds overrun, 883 versus 876.
- Better: Measure the tooltip and constrain its entire box to the plot, or record the clipping as a limit in the go/no-go inputs. Probe the first and last columns after changing the rate.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, chart sits beyond a narrow viewport

- Where: `packages/ui/src/App.svelte:70`, PR #7
- What: On the production web build at 390 × 844, the fixed-width sidebar places the entire chart to the right of the initial viewport. Its left edge is x=404.
- Better: State the viewport used for Q4 and document the narrow-width limit until the app gives the chart space at small widths.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 2, console claim exceeds hydration evidence

- Where: `.codex/notes/2026-11-26-gpuix-spike.md`, Q2 criterion 3, PR #7
- What: Chromium reports a 404 for `/favicon.ico` on dev and preview in the review. Hydration produces no mismatch warning or page error.
- Second pass at `57c5f12`: The note now names the 404 and narrows the capture to hydration warnings and page errors. The old dev sentence still says "the only console lines" were Vite and spike traces. Chromium reproduced the favicon error on both dev and preview.
- Better: Report hydration warnings and page errors separately from incidental HTTP errors.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 1, removed caller leaves a source lookup configured

- Where: `btca.config.jsonc` and `AGENTS.typescript.md`, PR #8
- What: The last chrono caller was deleted, but the source lookup and the agent guidance still point to chrono.
- Better: When deleting a dependency's last caller, check source lookup configuration and examples as well as package manifests.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part A, shared digest omits outputs under contract

- Where: `packages/calculator/src/lib/__testing__/baseline.ts` and `number-streams.ts`, PR #9
- What: The comparison omits monthly salary and date fields, projection and trace summaries, and the numeric metadata and deposit details of each step. The trace call disables contribution details. Adding one dollar to the reported start bucket leaves all 507 tests passing. The four full reference files are also outside the comparison.
- Better: Compare or hash all output fields that the rebuild promises to preserve, with record boundaries. Keep the trace details enabled for the comparison and state how replaced fields map to the new contract.
- Seen before: no
- Promoted: yes, the collection boundary guideline in AGENTS.md

### 2026-11-27, spec 2 part A, numeric encoding loses signed zero

- Where: `packages/calculator/src/lib/__testing__/number-streams.ts` and `implementation/rust-redesign/02-ts-engine-rebuild-spec.md`, PR #9
- What: String conversion produces the same token for 0 and -0. The writer rejects -0 during capture, but changing zero step interest to -0 on replay leaves all 507 tests passing.
- Better: Encode signed zero explicitly or enforce the same canonical-number check during replay.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part A, digest cannot enforce a numeric tolerance

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md`, parts A and B, PR #9
- What: The spec allows a relative tolerance, but the saved monthly and step values are only hashes for 227 inputs. A mismatched hash gives no expected value to use in that comparison.
- Better: Keep exact comparison mandatory or arrange to replay a frozen legacy oracle for any explicitly approved tolerance.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part A, adapter maps legacy offsets to invalid dates

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md`, part C, and `packages/calculator/scripts/hand-written-configs.ts`, PR #9
- What: The adapter says to substitute day 1 for a missing one-time day but has no rule for impossible explicit dates. A fixture specifies April 31, which is accepted by the legacy engine and would fail civil-date validation when copied literally.
- Better: Clamp the legacy day in the target year and month before formatting the adapter's one-time date.
- Seen before: no
- Promoted: yes, the timing variant guideline in AGENTS.md

### 2026-11-27, spec 2 part A, exact parity depends on unstated rounding and evaluation order

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md`, parts C and D, PR #9
- What: The recurring monthly bucket description leaves odd-month midpoint rounding implicit. The partial-month formula also reads as multiply by days then divide, which changes stored full-month interest in the last digit.
- Better: Specify the ceiling midpoint and compute the day fraction before multiplying. Keep the legacy grouping and addition order when moving deposits into the schedule.
- Seen before: no
- Promoted: yes, the exact arithmetic guideline in AGENTS.md

### 2026-11-27, spec 2 part A, fixture writer removes the oracle before validating replacements

- Where: `packages/calculator/scripts/write-baseline.ts`, PR #9
- What: The writer deletes both live directories before validating the first input. Readers can see a partial corpus during regeneration, and a validation failure can leave that corpus in place.
- Better: Validate and serialize the replacement corpus before touching the existing files. Stage regeneration if concurrent readers need a complete view.
- Seen before: no
- Promoted: yes, the fixture publication guideline in AGENTS.md

### 2026-11-27, spec 2 part A, type predicates promise unvalidated fixture fields

- Where: `packages/calculator/src/lib/__testing__/baseline.ts`, PR #9
- What: The guards narrow arbitrary JSON to RetirementConfig and BaselineCase while leaving array elements and optional fields unchecked.
- Better: Validate the shapes the predicates claim, or make the trusted fixture deserialization boundary explicit.
- Seen before: no
- Promoted: yes, the original fixture validation guideline in AGENTS.md

### 2026-11-27, spec 2 part A, fixtures normalize away defaults before testing

- Where: `packages/calculator/scripts/hand-written-configs.ts` and the saved corpus, PR #9
- What: All 231 inputs supply compounding and a salary raise, and every enabled salary-percentage rule supplies its salary basis. Every enabled recurring rule supplies a day or placement. The baseline will pass if a rebuild mishandles these defaults.
- Better: Save a small raw config with optional fields omitted so the engine and legacy adapter resolve the defaults during the test.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part A, monthly digest loses band boundaries

- Where: `packages/calculator/src/lib/__testing__/number-streams.ts:75`, PR #9 second pass
- What: Moving a monthly row from baseline to positive while keeping all encoded values at 1 produces identical stream text. Neither a row count nor a band delimiter is encoded.
- Better: Include each band's row count and test that moving a row to another band changes the stream.
- Seen before: 2026-11-27, spec 2 part A, shared digest omits outputs under contract
- Promoted: yes, the collection boundary guideline in AGENTS.md

### 2026-11-27, spec 2 part A, staged fixture publication still drops the live path

- Where: `packages/calculator/scripts/write-baseline.ts:113`, PR #9 second pass
- What: Injecting a failure on the second rename leaves the live baseline missing. Both the previous and the staged generations remain, and the next run deletes both before attempting publication.
- Better: Publish the new generation atomically and retain the old generation until the new one is reachable.
- Seen before: 2026-11-27, spec 2 part A, fixture writer removes the oracle before validating replacements
- Promoted: yes, the fixture publication guideline in AGENTS.md

### 2026-11-27, spec 2 part A, schedule order and grouping underspecified for exact parity

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:168` and `04-rust-port-spec.md:33`, PR #9 second pass
- What: Daily rules without an explicit day still contribute to legacy start and end buckets. Flattening to day buckets loses that provenance. Adding deposits individually on a day gives six different legacy balances in the baseline corpus. Date order also does not imply rule order inside a monthly bucket.
- Better: Specify legacy bucket identity, group amounts in file order, merge the day bucket with placement totals before touching the balance, and preserve enough metadata to recover that grouping in the trace.
- Seen before: 2026-11-27, spec 2 part A, exact parity depends on unstated rounding and evaluation order
- Promoted: yes, the exact arithmetic guideline in AGENTS.md

### 2026-11-27, spec 2 part A, trace adapter assumes fields and defaults its input cannot supply

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:178`, PR #9 second pass
- What: The adapter has no rule for the baseline's 19 growth rules with no legacy start bound, although the new validator requires a growth start. A trace deposit has no contribution type, and the stream needs the compounding mode and the active rule sequence.
- Better: Make the adapter take the input along with the outputs, state which fields it joins or derives, and specify January 1 of the projection's start year as the growth anchor when the legacy start is absent.
- Seen before: no
- Promoted: yes, the legacy bounds guideline in AGENTS.md

### 2026-11-27, spec 2 part A, parser equality guard runs after source data has been dropped

- Where: `packages/calculator/scripts/write-baseline.ts:32` and `packages/calculator/src/lib/__testing__/baseline.ts:100`, PR #9 second pass
- What: An example with a misspelled salary field passes ingestion because the first parse drops the field before the writer compares the parsed input to JSON. Fixture replay has no equality check either.
- Better: Apply the strict schema or equality check directly to the original parsed JSON at every entry point.
- Seen before: 2026-11-27, spec 2 part A, type predicates promise unvalidated fixture fields
- Promoted: yes, the original fixture validation guideline in AGENTS.md

### 2026-11-27, spec 2 part B, the schedule loses the resolved deposit date

- Where: `packages/calculator/src/lib/schedule.ts:20`, PR #10 at `9ddcef8`
- What: With a one-month horizon starting on January 1, changing a monthly rule from day 2 to day 15 produces an identical schedule in monthly mode. Both deposits carry offset 0 and the start bucket. Part C needs the actual day to filter a range and part E promises it in the trace.
- Better: Resolve the calendar date once in the builder and retain it alongside the bucket. Test two distinct dates in the same bucket.
- Seen before: 2026-11-27, spec 2 part A, schedule order and grouping underspecified for exact parity
- Promoted: yes, the resolved date and compounding bucket guideline in AGENTS.md

### 2026-11-27, spec 2 part B, day lookup changes behavior for existing CLI input

- Where: `packages/calculator/src/lib/compound.ts:76` and `:132`, PR #10
- What: The CLI reads JSON without checking day types. A daily projection with a seven-dollar monthly contribution on `"2"` used to credit seven dollars. The map stores the string key and looks up a number. The new balance stays zero while the trace reports seven on day 2.
- Better: Preserve the old property-key semantics on both insertion and lookup. Pin the CLI case while it accepts these files.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part B, the trace rereads caller-owned state

- Where: `packages/calculator/src/lib/calculator.ts:157` and `:186`, PR #10
- What: With one month, zero interest, no deposits and a balance getter returning 1 then 2, the projection and summary end at 1 while the last step ends at 2. A rule whose amount getter removes itself from the caller's array produces a missing-rule exception where the old engine returned its deposit.
- Better: Give projection and trace the same captured opening balance. Capture the contributing rule or its trace fields when resolving the deposit.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part B, sorting by deposit date survives the full suite

- Where: `packages/calculator/src/lib/__testing__/compound.test.ts:51`, PR #10
- What: Sorting by actual day immediately before summing buckets leaves all 536 tests passing. In January, in monthly mode at zero interest and zero opening balance, amounts of 1e16, 1 and 1 on days 15, 3 and 2 produce 10000000000000000 in file order and 10000000000000002 in date order.
- Better: Pin that balance in a test the Rust port will copy. Add a direct daily start-placement schedule case alongside the existing end-placement case.
- Seen before: 2026-11-27, spec 2 part A, schedule order and grouping underspecified for exact parity
- Promoted: yes, the summation order test guideline in AGENTS.md

### 2026-11-27, spec 2 part B, bucket wording omits legacy day resolution

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:75`, PR #10
- What: Both engines treat a recurring day of zero as missing even when placement is end. The daily one-time branch instead clamps an explicit zero to day 1 and a day past month end to the last day. The daily grouping paragraph specifies clamping only for recurring rules.
- Better: State the recurring-day presence test and both one-time clamp bounds. Distinguish legacy inputs from the stricter validation planned for part C.
- Seen before: 2026-11-27, spec 2 part A, adapter maps legacy offsets to invalid dates
- Promoted: yes, the timing variant guideline in AGENTS.md

### 2026-11-27, spec 2 part B, a daily guard also skips NaN

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:79`, PR #10
- What: Both engines use a truthiness test for a placement total and for the merged day's deposit. A NaN start total alongside a day-1 deposit of seven produces a balance of seven at zero interest. Replacing the placement guard with unconditional addition gives zero. All 536 tests pass with that mutation.
- Better: Specify which non-finite values the legacy guard skips, or explicitly scope the arithmetic description to finite intermediates. Use the seven-dollar case to test the guard if preserving that behavior.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, a validated raise can create a withdrawal

- Where: `packages/calculator/src/lib/parse-scenario.ts:391`, PR #11
- What: A base salary of 100, a raise of -2 and a 100% rule one calendar year later produce a deposit of -100. At a raise of -1, projecting before the salary anchor gives infinite salary and can produce a NaN balance.
- Better: Require the raise factor to be positive when projecting across calendar years in either direction. Specify the rate error and test both directions.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, finite operands overflow the projection

- Where: `packages/calculator/src/lib/parse-scenario.ts:205` and `implementation/rust-redesign/02-ts-engine-rebuild-spec.md`, PR #11
- What: A rate and variance both equal to 1e308 pass and produce an infinite positive-band rate. Even at zero interest, a balance and start deposit of 1e308 each give a NaN balance. JSON converts that balance to null.
- Better: Validate both band endpoints. Define an input domain that bounds monetary intermediates or specify how both engines signal arithmetic overflow.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, key checks lose available error subjects

- Where: `packages/calculator/src/lib/parse-scenario.ts:252` and `:319`, PR #11
- What: An extra key on account a produces no account id. An extra key directly on its rule r produces only the account id. The original objects contain both string ids.
- Better: Capture available string ids before checking the object's keys. Assert the ids on structural errors at the account and rule levels.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, run options bypass strict key checks

- Where: `packages/calculator/src/lib/parse-scenario.ts:377`, PR #11
- What: Options with today and a misplaced endDate pass. The parser checks the keys on the file and reads only today from the second input.
- Better: Check options against their one allowed key at the same boundary as the scenario.
- Seen before: 2026-11-27, spec 2 part A, parser equality guard runs after source data has been dropped
- Promoted: yes, the run options guideline in AGENTS.md

### 2026-11-27, spec 2 part C, sparse arrays bypass element parsing

- Where: `packages/calculator/src/lib/parse-scenario.ts:331` and `:401`, PR #11
- What: An array containing a hole for an account or rule bypasses the map callback. The id scan dereferences undefined and throws TypeError. This is reachable through the JS entry point that accepts unknown input.
- Better: Visit every index during parsing and report the missing element at its path.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, the validated type admits unchecked changes

- Where: `packages/calculator/src/lib/scenario.ts:81`, PR #11
- What: Ordinary typed code can assign -1 to a parsed account balance and project a final balance of -1 at zero interest. Callers can also construct the same structural type without parsing.
- Better: Make validated values opaque and deeply readonly. Keep engine arguments that require validation inside that boundary.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, the adapter invents conflicting year bounds

- Where: `packages/calculator/src/lib/__testing__/legacy-scenario.ts:92`, PR #11
- What: In a one-year projection a monthly rule with just start offset 2 throws rule_end_before_start. Just end offset -1 has the same failure. Legacy deposits nothing in both. Fractional bounds are accepted by the legacy comparison but produce invalid date strings in the adapter.
- Better: Intersect the old integer year indices with the projection's covered years before encoding bounds. Omit inactive rules and use ceiling for a lower bound and floor for an upper bound.
- Seen before: 2026-11-27, spec 2 part A, adapter maps legacy offsets to invalid dates
- Promoted: yes, the legacy bounds guideline in AGENTS.md

### 2026-11-27, spec 2 part C, a legacy lower bound changes the growth anchor

- Where: `packages/calculator/src/lib/__testing__/legacy-scenario.ts:92`, PR #11
- What: A monthly rule with base 0, annual flat growth of 1 and start offset -1 gives 12 instead of 0 over the first year. The old engine always counts growth from January of the projection's start year.
- Better: Keep the legacy growth anchor at January 1 of the first year when the rule is already active then.
- Seen before: 2026-11-27, spec 2 part A, trace adapter assumes fields and defaults its input cannot supply
- Promoted: yes, the legacy bounds guideline in AGENTS.md

### 2026-11-27, spec 2 part C, impossible annual days survive adaptation

- Where: `packages/calculator/src/lib/__testing__/legacy-scenario.ts:87`, PR #11
- What: An annual April 31 rule is rejected as invalid_day. Legacy credits April 30 every year. An annual April 30 rule represents the same schedule in the new engine.
- Better: Clamp an explicit annual day to the month length in a leap year before parsing the translated file.
- Seen before: 2026-11-27, spec 2 part A, adapter maps legacy offsets to invalid dates
- Promoted: yes, the legacy bounds guideline in AGENTS.md

### 2026-11-27, spec 2 part C, date helpers have different year domains

- Where: `packages/calculator/src/lib/plain-date.ts:36`, `:43` and `:61`, PR #11
- What: Parsing accepts 0000 and coerces a one-element array holding a date string. Adding one month to December 9999 formats as a five-digit year that the same parser rejects. Jiff accepts year zero and timestamp strings by default and rejects arithmetic beyond 9999. Legacy JS date constructors also remap starting years 0 through 99.
- Better: Specify the supported year interval and check the file grammar and arithmetic bounds in both languages. State the ancient-year exception for comparisons to the old engine.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, invalid inputs have no shared diagnostic precedence

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:179`, PR #11
- What: Missing version returns unsupported_version despite also satisfying the missing-field condition. With a negative account balance and negative rule amount, the rule wins. The port must reproduce an error code and ids but has no ordering rule for these cases.
- Better: Specify priority and add shared multiple-error vectors, or promise exact diagnostic parity only for single-fault inputs. Specify how missing and mistyped version and rate fields are classified.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, an inclusive range end survives every test

- Where: `packages/calculator/src/lib/account-schedule.ts:46` and its schedule tests, PR #11
- What: Changing the upper-bound guard from >= to > passes all 870 tests. For a January 15 to 20 schedule it credits a January 20 deposit. A range ending on day 1 never visits the end month.
- Better: Test the schedule builder directly with a mid-month end and a deposit on that day.
- Seen before: no
- Promoted: no

### 2026-11-27, spec 2 part C, partial-month wording conflates dates with buckets

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:205` and `:231`, PR #11
- What: A placement-derived date also controls bounds, growth and trace. Part D's wording can discard a January 28 one-time deposit in a monthly January 27 to February 1 range just because its compounding bucket is start.
- Better: Use the resolved date for eligibility and growth. Bucket retained deposits only after that test and preserve their resolved dates in the trace.
- Seen before: 2026-11-27, spec 2 part B, the schedule loses the resolved deposit date
- Promoted: yes, the partial-range eligibility guideline in AGENTS.md

### 2026-11-27, spec 2 part C, Rust must infer defaults and salary evaluation order

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:169` and `:211`, PR #11
- What: Part C leaves several defaults to old code and does not specify all salary-share grouping. With salary 100, monthly basis and amount 7, dividing salary first yields 0.5833333333333335. Applying the percent first yields 0.5833333333333334.
- Better: List normalized defaults and give the parenthesized salary-share expression, including the annual case.
- Seen before: 2026-11-27, spec 2 part A, exact parity depends on unstated rounding and evaluation order
- Promoted: yes, the salary formula guideline in AGENTS.md

### 2026-11-27, spec 2 part C, trace field names are absent from the port spec

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:306` and `04-rust-port-spec.md:55`, PR #11
- What: Rust must serialize exactly the same fields. The spec describes a segment's dates and counts in prose. An implementation could reasonably emit startDate and endDate where TS emits from and to.
- Better: Include the TraceSegment and TraceDeposit wire shapes with their inclusive start and exclusive end.
- Seen before: no
- Promoted: no
