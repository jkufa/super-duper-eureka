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
- Promoted: yes, the machine-readable command guideline in AGENTS.md

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
- Promoted: yes, the intermediate overflow guideline in AGENTS.md

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
- Promoted: yes, the last supported month guideline in AGENTS.md

### 2026-11-27, spec 2 part C, invalid inputs have no shared diagnostic precedence

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:179`, PR #11
- What: Missing version returns unsupported_version despite also satisfying the missing-field condition. With a negative account balance and negative rule amount, the rule wins. The port must reproduce an error code and ids but has no ordering rule for these cases.
- Better: Specify priority and add shared multiple-error vectors, or promise exact diagnostic parity only for single-fault inputs. Specify how missing and mistyped version and rate fields are classified.
- Seen before: no
- Promoted: yes, the multiple-error subjects guideline in AGENTS.md

### 2026-11-27, spec 2 part C, an inclusive range end survives every test

- Where: `packages/calculator/src/lib/account-schedule.ts:46` and its schedule tests, PR #11
- What: Changing the upper-bound guard from >= to > passes all 870 tests. For a January 15 to 20 schedule it credits a January 20 deposit. A range ending on day 1 never visits the end month.
- Better: Test the schedule builder directly with a mid-month end and a deposit on that day.
- Seen before: no
- Promoted: yes, the comparison-boundary guideline in AGENTS.md

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

### 2026-11-28, spec 3, clock and environment bans name one function and miss its siblings

- Where: `crates/core/clippy.toml`, PR #12
- What: The ban list names `SystemTime::now`, `Instant::now`, and `std::env::var`. `SystemTime::UNIX_EPOCH.elapsed()`, `Instant::elapsed`, `std::env::var_os`, `std::env::vars`, and `std::fs::read` all pass `just check`. So does an `async fn` and an `unsafe` block.
- Better: Ban each sibling path that reads the clock, the environment, the filesystem, or the network, and forbid `unsafe` in `core`. There is no lint that forbids `async fn`.
- Seen before: no
- Promoted: yes, the clock-ban guideline in AGENTS.md
- Promoted: yes, the clock independence guideline in AGENTS.md

### 2026-11-28, spec 3, unpublished-crate licence skip is not limited to the workspace

- Where: `deny.toml`, PR #12
- What: `[licenses.private] ignore = true` skips every crate with `publish = false`. A path dependency outside the workspace, with that flag and either `GPL-3.0-only` or no licence, passed `cargo deny check licenses`. A publishable crate with the same licence failed.
- Better: Do not treat `publish = false` as proof that a crate is ours. Keep the licence check on path dependencies.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 3, one-time bounds are only rejected while deserialising

- Where: `crates/core/src/scenario/raw.rs`, `crates/core/src/scenario/rule.rs`, PR #15
- What: `ContributionRuleFile` fields are public, and the check that a one-time rule has no `startDate` or `endDate` lives only in `Deserialize`. `Scenario::parse` copies those dates onto the validated rule. A struct literal with a one-time rule, start `2027-01-01` and end `2027-12-01` parses successfully, and both accessors return those dates. The same JSON fails to deserialise. The doc comment says both accessors are always `None` on a one-time rule.
- Better: Run that check in the conversion to the validated rule, and keep the raw fields visible only inside the scenario module. `pub(crate)` still lets the schedule builder build the bad value. JSON deserialisation already rejects it, so the wire codes stay the same.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 3, id newtypes hide their fields differently

- Where: `crates/core/src/scenario/account.rs`, `crates/core/src/scenario/rule.rs`, PR #15
- What: `AccountId`'s field is private. `RuleId`'s field is `pub(super)`. Outside the crate both constructors are private. Inside the scenario module, any sibling can build a `RuleId` from an arbitrary string, and only `account.rs` can build an `AccountId`.
- Better: Keep both fields private. Give `RuleId` a `pub(super)` constructor for the duplicate check, so the next id type has one pattern to copy.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 3, equal rule dates survive every test

- Where: `crates/core/src/scenario/rule.rs`, `crates/core/src/scenario/tests.rs`, PR #15
- What: The end-before-start test uses 2027-01-02 and 2027-01-01. Changing `end < start` to `end <= start` leaves all 29 `retirement-core` tests passing. A rule whose start and end are both 2027-05-05 is valid in both languages.
- Better: Accept that equal pair in a test, beside the pair that fails.
- Seen before: 2026-11-27, spec 2 part C, an inclusive range end survives every test
- Promoted: yes, the comparison-boundary guideline in AGENTS.md

### 2026-11-28, spec 3, unknown-field tests skip three raw structs

- Where: `crates/core/src/scenario/raw.rs`, `crates/core/src/scenario/tests.rs`, PR #15
- What: Removing `deny_unknown_fields` from `InterestFile`, from `SalaryFile`, or from `GrowthFile` leaves all 29 tests passing. The shape test sends an extra key to the scenario, an account, a rule and a timing variant, and it never sends one to these three.
- Better: Give each raw struct an unknown-key case.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 3, jiff clock ban names a type this crate does not have

- Where: `crates/core/clippy.toml`, PR #15
- What: The list bans `jiff::Zoned::now`. jiff 1.0.3 has no `Zoned` type. The clock method is `jiff::ZonedDateTime::now`, and it is not banned. `jiff::tz::TimeZone::try_system` compiles in `retirement-core` and Clippy allows it. `TimeZone::system` is banned. With the features in `Cargo.toml`, `try_system` returns an error and `now` is not compiled, so this is not a live clock read.
- Better: Ban `jiff::ZonedDateTime::now` and `jiff::tz::TimeZone::try_system`. Confirm each call fails `just check` when the method is actually in the build.
- Seen before: 2026-11-28, spec 3, clock and environment bans name one function and miss its siblings
- Promoted: yes, the clock-ban guideline in AGENTS.md

### 2026-11-28, spec 2 part F, a rate-independent pool produces two different headline rates

- Where: `packages/calculator/src/lib/effective-rate.ts:92`, PR #19
- What: Two zero-balance accounts at 4% and 10% receive end-placement deposits of 50 and [10.01, 1.23] in their only month. Reordering the accounts moves the effective rate from 10% to 4%. Both totals are 61.24 and neither earns interest. A one-unit change in the last place of a salary deposit can also switch endpoints.
- Better: Define a return for a pool with no exposure to interest and take that shortcut before bisection. Test both orders and a rounded salary deposit.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 parts D and E, a valid final segment requests year 10000

- Where: `packages/calculator/src/lib/account-schedule.ts:69` and `:76`, PRs #14 and #17
- What: With no accounts, today 9999-12-01 and end 9999-12-02 the CLI exits 1 with a RangeError. Spec 4 documents the exclusion from parity, but spec 2 accepts the file.
- Better: Finish the segment at the requested end when it lies in the current month. Break before computing a successor.
- Seen before: 2026-11-27, spec 2 part C, date helpers have different year domains
- Promoted: yes, the last supported month guideline in AGENTS.md

### 2026-11-28, spec 2 part E, backcast salary can differ by more than the parity tolerance

- Where: `packages/calculator/src/lib/account-schedule.ts:29`, `implementation/rust-redesign/04-rust-port-spec.md:34`
- What: At base salary 1e308, raise 1e155, as-of 2028 and projection year 2026, Bun returns 0.009999999999999969. A standalone rustc 1.100.0 calculation using the specified powi returns 0. Its positive square overflows before the reciprocal.
- Better: Use a negative-exponent operation verified at the scaled output and cover the boundary in the parity inputs.
- Seen before: 2026-11-27, spec 2 part C, finite operands overflow the projection
- Promoted: yes, the intermediate overflow guideline in AGENTS.md

### 2026-11-28, spec 2 part D, the deposit-free monthly split example does not generalize

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:282`, PR #14
- What: Splitting April on the 16th adds 1.48 to 250000 at 6%, but with a 20000 one-time deposit on the 28th it subtracts 47.19. The deposit earns a half-month less. In daily mode the split preserves the final balance, while recombining separately accumulated contributions can round differently.
- Better: State the split property for final balance and quantify a late start-bucket deposit alongside the no-deposit example.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 part E, parity can compare two different valid overflow subjects

- Where: `implementation/rust-redesign/02-ts-engine-rebuild-spec.md:186` and `:305`, `04-rust-port-spec.md:89`
- What: Aggregate, salary and weighted-rate failures have no account id. Two accounts may each overflow, and reporting either first is permitted. Comparing their ids whenever both are present can reject a conforming port.
- Better: Require exact subjects for isolated account failures. For multiple independent failures either define traversal priority or compare only the agreed code.
- Seen before: 2026-11-27, spec 2 part C, invalid inputs have no shared diagnostic precedence
- Promoted: yes, the multiple-error subjects guideline in AGENTS.md

### 2026-11-28, spec 2 part F, port properties omit the solver exceptions

- Where: `implementation/rust-redesign/04-rust-port-spec.md:115`, PR #19
- What: With no cash or deposits, unequal overrides 2% and 3% and default 6%, spec 2 returns 6%. The unconditional bracket property fails. An unrestricted bracket also invalidates the stated residual bound after 60 passes.
- Better: Condition the properties on the specified shortcuts and the rate domain used for the residual test.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 part F, equivalent-looking solver arithmetic survives mutation

- Where: `packages/calculator/src/lib/__testing__/effective-rate.test.ts:297`, PR #19
- What: Changing both midpoints to (lo + hi) / 2 passes all 981 tests. Between 0.01 and 0.03 the specified first midpoint is 0.019999999999999997 and the mutant returns 0.02.
- Better: Assert the first midpoint on that bracket.
- Seen before: 2026-11-27, spec 2 part A, exact parity depends on unstated rounding and evaluation order
- Promoted: yes, the float reduction and midpoint guideline in AGENTS.md

### 2026-11-28, spec 2 part F, the weighted numerator has no order-sensitive test

- Where: `packages/calculator/src/lib/project-scenario.ts:174`, PR #19
- What: Summing the numerator backwards passes all 981 tests. With rates [0.5, 1, 1] and final monthly end deposits [2e16, 1, 1], the correct rate is 0.5 and the reversed result is 0.5000000000000001.
- Better: Pin the weighted rate on a three-account input that distinguishes these orders.
- Seen before: 2026-11-27, spec 2 part B, sorting by deposit date survives the full suite
- Promoted: yes, the float reduction and midpoint guideline in AGENTS.md

### 2026-11-28, spec 2 part F, weighted products can silently underflow

- Where: `packages/calculator/src/lib/project-scenario.ts:175`, PR #19
- What: Balances of 1e-323 each at 5% and 10% produce a positive total and a weighted rate of zero. Both products round to zero before division.
- Better: If subnormal dollar inputs stay supported, scale the balances before multiplying in this case. Document and test the exception in both engines.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 parts E and G, the scenario baseline rebuilds public salary values

- Where: `packages/calculator/src/lib/__testing__/legacy-scenario.ts:150` and `:183`, PRs #17 and #21
- What: Adding a dollar to every published salaryByYear entry leaves both baseline suites green, 484 tests. They call salaryInYear again. A separate scenario test catches this particular change.
- Better: For projectScenario replay, compare salaryByYear directly with the stored yearly salaries. Keep the internal range adapter for figures absent from its result.
- Seen before: 2026-11-27, spec 2 part A, shared digest omits outputs under contract
- Promoted: yes, the public output guideline in AGENTS.md

### 2026-11-28, spec 2 part G, deleting the old baseline also deletes its composition assertion

- Where: `packages/calculator/src/lib/__testing__/baseline-project-scenario.test.ts:13`, PR #21
- What: Both remaining suites check the total count and discover the full examples by prefix. The old suite also required four examples, 200 generated cases and at least 20 hand-written cases. A renamed example can lose full-result coverage without changing the count.
- Better: Assert the four known names and the generated and hand-written counts once in the shared replay tests.
- Seen before: 2026-11-27, spec 2 part A, shared digest omits outputs under contract
- Promoted: yes, the fixture groups guideline in AGENTS.md

### 2026-11-28, spec 2 part G, parser errors replace expressible flat-deposit tests

- Where: `packages/calculator/src/lib/__testing__/ported-calculator.test.ts:245`, PR #21
- What: Fifteen formerly successful one-time flat permutations now return after checking the forbidden salary basis. Dropping that unused field yields the same deposit in the new contract.
- Better: Keep a rejection test and run the original numerical assertions on the fifteen equivalent flat rules.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 part G, the documented invocation changes stdout

- Where: `AGENTS.typescript.md:24`, `packages/cli/README.md:11` and `packages/cli/src/index.ts:133`, PR #21
- What: vp run retirement-calc prepends its command to stdout. The example tests call the engine directly and cannot catch changes to command parsing, stream routing or status.
- Better: Document the direct Bun invocation for JSON consumers and spawn it on one success, one usage error and one scenario error.
- Seen before: 2026-11-26, spec 1, task migration leaves app setup instructions behind
- Promoted: yes, the machine-readable command guideline in AGENTS.md

### 2026-11-28, spec 2 part G, the CLI accepts input forms absent from the port contract

- Where: `packages/cli/src/index.ts:50`, `:90` and `:104`, PR #21
- What: Repeated scalar flags and duplicate JSON members take the last value. Help writes plain text to stdout. Invalid UTF-8 in a name becomes a replacement character, and an escaped lone surrogate passes. A generator that serializes valid objects cannot exercise these file-level differences.
- Better: Define the supported wire grammar and test raw files and command lines for any behavior the port must match.
- Seen before: no
- Promoted: yes, the CLI contract guideline in AGENTS.md

### 2026-11-28, spec 2 part G, the randomness test accepts a constant generator

- Where: `packages/calculator/src/lib/__testing__/random.test.ts:6`, PR #21
- What: Returning 0.5 on every draw passes all 981 tests. Part H will use this function to choose the parity corpus.
- Better: Pin a short sequence for a fixed seed and check another seed differs.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 part G, the clock guard only recognizes three text fragments

- Where: `packages/calculator/src/lib/__testing__/no-clock.test.ts:7`, PR #21
- What: Reading globalThis.Date["now"](<>) passed all eleven guard tests. The scan covers current .ts modules on this machine, but alternate spellings and other source extensions are outside its check.
- Better: Enforce the prohibited globals with a syntax-aware rule or state the literal scope of the guard.
- Seen before: 2026-11-28, spec 3, clock and environment bans name one function and miss its siblings
- Promoted: yes, the clock independence guideline in AGENTS.md

### 2026-11-28, spec 2 part E, tracing computes the stale interval twice

- Where: `packages/calculator/src/lib/project-scenario.ts:74`, PR #17
- What: traceAccount builds and compounds the roll-forward range for a full series, then builds and compounds it again for the trace. A long stale history pays for both.
- Better: Use the final balance of the last roll-forward trace segment, falling back to the stored balance when the trace is empty.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 2 part F, rate bounds depend on a runtime argument limit

- Where: `packages/calculator/src/lib/effective-rate.ts:82`, PR #19
- What: Spreading every included rate into Math.min and Math.max ties the public Node entry point to a function argument limit. A standalone reduction over 250000 values raises RangeError on Node 24.13.0.
- Better: Find both bounds in one iteration over included accounts.

### 2026-11-28, spec 4, a float test still passes after the formula is rearranged

- Where: `crates/core/src/compound/mod.rs`, `crates/core/src/project/mod.rs`, `crates/core/src/project/scenario/effective_rate/mod.rs`, PR #20 and PR #22
- What: Regrouping monthly interest as `balance * (rate * fraction)` left all 142 core tests passing. So did changing the bisection midpoint to `(lo + hi) / 2`, and deleting the `total_interest.is_finite()` check. The partial-month test uses a monthly rate of exactly 1, so the association does not change the bits. The midpoint tests use brackets such as 0 to 1 and 0 to 4095, where both expressions match, including the one that records the first three midpoints. The interest check is what rejects a balance of 1e308 at a rate just above -1 with an end deposit of 1e307 from January to November: cumulative interest is `-inf` while the balance and the contributions stay finite, and no test builds that case.
- Better: Pin each formula with an input on which the wrong association, the rearranged midpoint, or a dropped finiteness check produces a different result.
- Seen before: 2026-11-27, spec 2 part C, an inclusive range end survives every test; 2026-11-28, spec 3, equal rule dates survive every test
- Promoted: yes, the float-formula guideline in AGENTS.md

### 2026-11-28, spec 4, a jiff parser reads the zone database without a ban entry

- Where: `crates/core/clippy.toml`, PR #26
- What: With the workspace feature unification, `jiff::fmt::temporal::DateTimeParser::parse_time_zone` and `BrokenDownTime::to_zoned_datetime` compile in `retirement-core` and `cargo clippy --workspace --all-targets -- -D warnings` allows both. Each calls `jiff::tz::db()`. The same is true of `DateTimeParser::parse_zoned_datetime`, `Pieces::to_time_zone` and `TimeZoneAnnotation::to_time_zone`. The type ban on `ZonedDateTime` fires only when the source names that type, so a call whose return type is inferred is not covered. `Timestamp::now` and a named `ZonedDateTime::try_from(SystemTime)` are rejected.
- Better: Ban those parser methods. Probe them with `--workspace`, because `cargo clippy -p retirement-core` does not turn on the features that compile the clock.
- Seen before: 2026-11-28, spec 3, clock and environment bans name one function and miss its siblings; 2026-11-28, spec 3, jiff clock ban names a type this crate does not have
- Promoted: yes, the clock-ban guideline in AGENTS.md

### 2026-11-28, spec 4, the account projection is public and accepts a non-finite opening

- Where: `crates/core/src/project/mod.rs`, `crates/core/src/project/trace.rs`, `crates/core/src/schedule/mod.rs`, `crates/core/src/schedule/amount.rs`
- What: `project_account`, `trace_account_range`, `build_account_schedule` and `salary_in_year` are public. An empty range skips the finiteness check, so `project_account` returns `Ok` with a non-finite start and final balance when the opening balance is not finite. A rate at or below -1 is accepted on a non-empty range and comes back as `NotFinite` or as a finite negative balance.
- Better: Keep `project_scenario` and `trace_account` as the public entry points. Make the others `pub(crate)`.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, golden numbers use the cross-language tolerance

- Where: `crates/cli/tests/golden.rs` lines 16 and 169, PR #31
- What: `numbers_agree` accepts a difference of `1e-9 * max(1, |a|, |b|)`. For a rate or any other value at most 1, that is an absolute `1e-9`, about 1.4e8 ulps at 0.05. Changing `examples/basic` `effectiveRate` from `0.05` to `0.0500000005` left both golden tests passing. `0.050000002` failed, so the test does read the file. On `generated/seed-01766`, a `growth_periods_over_1000` case, the release CLI and the committed projection already disagree in 46 numbers. The largest relative difference in the first mismatches was 5.87e-14, and the test accepts all of them. The test has no exact-match rule for cases outside that trait.
- Better: Once the stored files are this platform's Rust CLI output, compare each number with `to_bits`. Regenerate and explain the 18 growth cases whose last digits still differ from the TypeScript capture.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, an error document matches on code and ids only

- Where: `crates/cli/tests/golden.rs` lines 224 and 247, PR #31
- What: Success documents are walked in full. An error document is compared only by `code`, and by `accountId` and `ruleId` under the parity exceptions. Replacing `regressions/today-not-a-date/projection.json` with `{"error":{}}` left the golden test passing, because a missing code makes `error_difference` return `None`. Adding `"extra": true` ahead of `code` in `regressions/interest-is-an-array/projection.json` passed the same run. Key order and extra fields are not checked.
- Better: Walk the error object with the same key, order and value rules as any other document, then apply the `invalid_field` and `not_finite` id exceptions. A missing `code` is a mismatch.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, deleting a trace removes the trace check

- Where: `crates/cli/tests/golden.rs` lines 278 and 299, PR #31
- What: `trace` and `trace.json` are required only when `trace` already exists. Deleting both from `hand-computed/deposits-around-a-mid-month-range` left `golden_groups_hold_the_pinned_cases` and `rust_cli_reproduces_every_golden_case` passing. `just golden` rewrites `trace.json` only when `trace` is present, so the deletion would stick.
- Better: Require both trace files whenever `projection.json` is not an error document.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, golden publish deletes the only copy if killed between the renames

- Where: `justfile` lines 29 and 48, PR #31
- What: The recipe moves the live `golden` directory into `retired`, then moves `staged` into place. The EXIT trap is `rm -rf` of both directories. A copy of that sequence, killed with SIGTERM after the first `mv` and during the sleep before the second, left the live path missing and removed the retired copy. A kill during the write loop, before either `mv`, left the original files in place. A write that exits 1 before the swap also left them in place.
- Better: Restore the retired directory when the live path is missing, and delete the backup only after the new directory is in place.
- Seen before: 2026-11-27, spec 2 part A, staged fixture publication still drops the live path
- Promoted: yes, the fixture publication guideline in AGENTS.md

### 2026-11-28, spec 4 part G, property tests take a random seed and open a regression file

- Where: `crates/core/src/properties.rs` line 22, `crates/core/src/project/scenario/effective_rate/tests.rs` line 761, workspace `Cargo.toml` `proptest` 1.12.0, PR #31
- What: `ProptestConfig::with_cases` copies `Config::default()`. With the `std` feature that default seed is `RngSeed::Random`, drawn from `getrandom`, and the failure store is `FileFailurePersistence::SourceParallel("proptest-regressions")`, which opens a file next to the test. `fork` and `timeout` are off, so the process and clock features stay out. Passing tests still call `File::open`. A failure is written into the source tree and is not replayed on CI unless that file or `PROPTEST_RNG_SEED` is kept. The next CI run draws a new seed.
- Better: Set a fixed `RngSeed` and `failure_persistence: None`, and ban the proptest file and environment entry points in `crates/core/clippy.toml` the same way jiff is banned.
- Seen before: 2026-11-28, spec 4, a jiff parser reads the zone database without a ban entry
- Promoted: yes, the clock-ban guideline in AGENTS.md

### 2026-11-28, spec 4 part G, an empty pool may return any rate inside the bracket

- Where: `crates/core/src/properties.rs` lines 282 to 305, PR #31
- What: The assertion passes when `lowest <= rate && rate <= highest`, before it looks at the empty-pool exception. An included account at rate 0.02, balance 0 and no contributions, with a scenario rate of 0.05, has an empty pool. The spec says the result is the scenario rate. A wrong result of 0.02 still satisfies the bracket clause. The unit test `returns_the_default_rate_when_the_pool_has_no_balance_and_no_deposits` checks the real engine. This property would not.
- Better: When no account is included or the pool is empty, require `rate.to_bits() == default_rate.to_bits()`. Use the bracket only for a pool that has money.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, property generators leave many cases with nothing to prove

- Where: `crates/core/src/arbitrary.rs` lines 14 to 19 and 243, PR #31
- What: On 1000 draws from `any_case` with seed 1, 206 scenarios had no accounts, 252 set daily compounding, 341 had a growing rule, 511 had a start or end date, and 530 had an included account with a positive balance. The horizon is at most 120 months and account rates stay inside about -0.05 to 0.15. Raising a rate on an empty or excluded account cannot lower the total, so property 3 holds without exercising compounding. No draw reaches a growth exponent past 1000.
- Better: Reject empty scenarios in the properties that need an account, and draw the raised-rate property from an included account that has a balance or a deposit. Keep a few long horizons if that edge should stay covered after the corpus is gone.
- Seen before: no
- Promoted: yes, the property input guideline in AGENTS.md

### 2026-11-28, spec 4, the port spec still says December 9999 throws

- Where: `implementation/rust-redesign/04-rust-port-spec.md:35`, PR #27
- What: The schedule section still says the TypeScript builder throws when a range reaches December 9999. PR #27 stopped calling `addMonths` for a segment that ends inside that month, and both CLIs now project a range ending on 9999-12-31. `bun packages/cli/src/index.ts` and the release `retirement-calc` both exit 0, with the same JSON, for today 9999-12-01 end 9999-12-31, today 9999-11-20 end 9999-12-31, and today 9999-12-30 end 9999-12-31.
- Better: Delete the clause that says the TypeScript builder throws. The previous sentence already says the last segment ends at `to`.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4, salary powers are not pinned against powf

- Where: `crates/core/src/schedule/amount.rs:15`, PR #28
- What: Replacing the future-year `raise.powi` with `raise.powf` left all 182 `retirement-core` lib tests passing. Annual base 90000, raise 0.03, four years after `asOf`: `powi` gives 101295.79289999998582 and `powf` gives 101295.79290000001492. Percent growth already pins `powi` against `powf` for `1.007` to the third. Salary does not.
- Better: Assert `salary_in_year` for that input, and the past-year division, against the `powf` result.
- Seen before: 2026-11-28, spec 4, a float test still passes after the formula is rearranged
- Promoted: yes, the float-formula guideline in AGENTS.md

### 2026-11-28, spec 4, a later month can add its buckets onto a huge cumulative total

- Where: `crates/core/src/project/mod.rs:222`, PR #29
- What: Monthly cumulative contributions add the segment total, which is the start-bucket sum plus the end-bucket sum. Adding those two bucket sums onto the running total instead left all 182 lib tests passing. A one-time deposit of 1e16 on 2026-01-15, then 1 on 2026-02-01 and 1 on 2026-02-28, rate 0, today 2026-01-01, end 2026-03-01: both CLIs report February contributions of 10000000000000002. Adding the February amounts onto the January total one at a time yields 10000000000000000.
- Better: Pin that February contributions figure through `project_scenario`.
- Seen before: 2026-11-28, spec 4, a float test still passes after the formula is rearranged
- Promoted: yes, the float-formula guideline in AGENTS.md

### 2026-11-28, spec 4, std and unix socket bans still miss sibling calls

- Where: `crates/core/clippy.toml`, PR #32
- What: A probe under `cargo clippy -p retirement-core --all-targets -- -D warnings` was not rejected for `std::env::set_current_dir`, `std::path::Path::try_exists`, `std::os::unix::net::UnixListener::bind`, or `UnixDatagram::bind`. The same probe was rejected for `File::create_new`, `TcpStream::connect_timeout`, `SystemTime::UNIX_EPOCH`, `Command::new`, and a `UdpSocket` parameter, because those name a banned type or method. `std::io::stdin`, `stdout`, and `stderr` were also allowed.
- Better: Ban `set_current_dir`, `Path::try_exists`, `UnixListener`, and `UnixDatagram` next to the siblings already on the list.
- Seen before: 2026-11-28, spec 3, clock and environment bans name one function and miss its siblings
- Promoted: yes, the clock-ban guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, overlapping publishers retire the only complete generation

- Where: `justfile:34` and `packages/calculator/scripts/golden.ts:197`, PR #33
- What: I paused the Rust writer after it staged all 229 cases and started TypeScript capture. Its startup cleanup removed the Rust staging directory. After TypeScript wrote one case, I resumed Rust. It exited 0, installed the one-case directory and deleted the retired 229 cases. Killing the second writer and running recovery left one case and no manifest. Two Rust writers and two TypeScript writers reproduced the same loss separately.
- Better: Serialize publishers across both commands and give each writer its own staging directory. Verify the candidate for publication before retiring the previous generation.
- Seen before: spec 4 part G, golden publish deletes the only copy if killed between the renames
- Promoted: yes, the fixture publication guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, readers lose the live path between the renames

- Where: `justfile:45` and `packages/calculator/scripts/golden.ts:215`, PR #33
- What: For both commands, a reader found no `golden/manifest` after the first rename. SIGKILL left the live path missing. A later valid invocation recovered all 229 cases. A kill during staging or after the second rename left a populated live path.
- Better: Switch generations in one atomic operation and keep the selected generation available to readers that are already using it.
- Seen before: spec 2 part A, staged fixture publication still drops the live path
- Promoted: yes, the fixture publication guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, regeneration approves a stale manifest

- Where: `crates/cli/tests/golden.rs:415`, PR #33
- What: Renaming `regressions/no-accounts` made the layout test fail. Following the rename with `just golden` regenerated the manifest from the renamed folders and both golden tests passed. The independent name for that regression disappears in part H.
- Better: Check the source folders against the committed inventory before regenerating outputs. Handle intentional case changes explicitly.
- Seen before: spec 2 part G, deleting the old baseline also deletes its composition assertion
- Promoted: yes, the fixture inventory guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, TypeScript capture can replace 229 cases with 30

- Where: `packages/calculator/scripts/golden.ts:109` and `:240`, PR #33
- What: In a scratch copy, `bun packages/calculator/scripts/golden.ts 1` exited 0. The manifest had 30 entries, including one generated case. Cleanup removed the complete backup. The Rust inventory test then failed.
- Better: Require all four expected group counts in the candidate before publishing it.
- Seen before: spec 2 part A, fixture writer removes the oracle before validating replacements
- Promoted: yes, the fixture inventory guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, the Rust CLI suite accepts a change to repeated options

- Where: `crates/cli/src/main.rs:30` and `packages/cli/src/__testing__/cli.test.ts:135`, part H review
- What: Setting `args_override_self` to false passed `just check`. A real invocation with two `--today` arguments then exited 1. Spec 2 and the TypeScript subprocess test require exit 0 and the second value in stdout.
- Better: Port the repeated-option subprocess test before removing its TypeScript counterpart.
- Seen before: spec 2 part G, the CLI accepts input forms absent from the port contract
- Promoted: yes, the CLI contract guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, the examples shipped to users can drift from their golden copies

- Where: `crates/cli/tests/cli.rs:21` and `packages/calculator/src/lib/__testing__/examples.test.ts:69`, part H review
- What: Changing only the shipped basic example's monthly Roth amount from 500 to 501 passed `just check`. The TypeScript example test failed with 120240 versus 120000. The Rust byte comparison read the other copy. The TypeScript suite also checks the inventory of example files.
- Better: Use the shipped files as the inputs for the examples group, or compare their names and contents with that group's inputs.
- Seen before: spec 2 parts E and G, the scenario baseline rebuilds public salary values
- Promoted: yes, the shipped examples guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, property inputs omit account kinds and named rules

- Where: `crates/core/src/arbitrary.rs:158` and `:196`, PR #33
- What: The round-trip generator emits only `other` and never supplies a rule name. Mapping a parsed `taxable` account to `Other` passed `just check`. Separately, deleting the test writer's rule-name field also passed. A round trip compares two parsed values, so an independent raw-to-validated assertion is needed for a parser that drops a value consistently.
- Better: Exercise the accepted account kinds and optional names with raw input and assert their validated values. Generate named rules and every kind for the writer round trip.
- Seen before: spec 4 part G, property generators leave many cases with nothing to prove
- Promoted: yes, the property input guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, the pool tolerance accepts infinity

- Where: `crates/core/src/project/scenario/effective_rate/tests.rs:770`, PR #33
- What: Returning positive infinity for every `Pool::final_balance` passed the pooled-balance property on all 256 draws. The expected target was finite, but the difference and the tolerance bound both became infinity. Other solver tests and the golden replay failed.
- Better: Require finite endpoints before applying a relative tolerance to a pool evaluated at the reported rate.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 parts F and G, a total can omit its final month and still satisfy the row property

- Where: `crates/core/src/properties.rs:57`, PR #33
- What: Dropping the last monthly row after constructing the yearly rows passed all eight properties. The sum check iterates the rows the total returns. Unit tests and the golden replay caught the missing row.
- Better: Check row counts and calendar positions against the scenario range before comparing sums.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 parts F and G, the standard library still exposes unguarded I/O

- Where: `crates/core/clippy.toml:20`, PR #34
- What: All ten Path methods added by #34 failed Clippy. A test calling `std::env::home_dir`, resolving `localhost:0` via `ToSocketAddrs` and using `DirBuilder` on the current directory passed the full `just check`. These paths can read process state, resolve a hostname or operate on the filesystem. A separate probe passed JSON through an OS pipe using the dev dependency's `serde_json::to_writer` and `from_reader`.
- Better: Cover home-directory lookup, hostname resolution and directory builders when testing the core I/O guard.
- Seen before: spec 4, std and unix socket bans still miss sibling calls
- Promoted: yes, the purity guard guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, the default runner bypasses the repository seed

- Where: `crates/core/clippy.toml:62`, PR #33
- What: In a core test, `let runner: TestRunner = Default::default()` passed `just check`. Proptest 1.12.0 implements it through the banned `TestRunner::new`. With the locked features it uses proptest's built-in seed. The current eight properties use the repository seed correctly.
- Better: Keep runner construction in the one shared helper and check alternate constructors, including trait defaults.
- Seen before: spec 4 part G, property tests take a random seed and open a regression file
- Promoted: yes, the purity guard guideline in AGENTS.md

### 2026-11-28, spec 4 parts F and G, the regeneration record lists one path per file

- Where: `implementation/rust-redesign/04-rust-port-spec.md:119`, PR #33 and `8817e84`
- What: The PR says the commit lists every moved JSON path. I compared every token against its parent. There were 761 changed numeric tokens across 27 files. The commit lists the largest difference per file and omits the other paths and the old and new values. The reported reason and maximum are correct.
- Better: Attach the field-level old and new values when regenerating, with the cause for each group of changes.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 parts F and G, the account generator callback has one caller

- Where: `crates/core/src/arbitrary.rs:221` and `:291`, PR #33
- What: Before #33, two callers supplied different account generators. `rg 'scenario_with\('` now finds one caller, `cases_of`, which always builds the same boxed account strategy with a different length range.
- Better: Pass the length range to the scenario generator and construct the account strategy there.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, the golden writer's explicit unlock is not what the tests fail on

- Where: `crates/cli/tests/golden.rs:630`, PR #35
- What: Replacing `lock.unlock()` with a drop of the `File` left all 14 publication tests passing under `cargo test --test-threads=8`. The tests publish, spawn the CLI, and publish again. On Darwin 24, `LOCK_UN` releases the lock while a forked child still holds the descriptor, and closing the parent's descriptor does not. Nothing in the suite fails if the explicit release is deleted.
- Better: Keep a publication test that fails when the writer only closes the descriptor while another thread is between fork and exec.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, the default today is checked as a shape

- Where: `crates/cli/src/main.rs:203` and `crates/cli/tests/cli.rs:296`, PR #35
- What: `defaults_today_to_a_date_in_the_file_grammar` checks that the omitted `--today` is ten characters with dashes. Returning the constant `2026-06-01` from `local_today` left that test passing. The basic example's balances are dated 2026-01-01 and its end date is 2046-01-01, so that constant still projects. It is not this machine's date.
- Better: Compare the omitted `--today` with the date the test reads from the clock by the same rule the CLI uses.
- Seen before: no
- Promoted: no

### 2026-11-28, spec 4 part G, parking a thread waits on the clock without a ban

- Where: `crates/core/clippy.toml:65`, PR #35
- What: A core test calling `std::env::home_dir`, `DirBuilder::new`, `ToSocketAddrs::to_socket_addrs`, `serde_json::to_writer`, `serde_json::from_reader`, and `std::process::id` failed `cargo clippy -p retirement-core --all-targets -- -D warnings`. The same probe was allowed to call `std::thread::park_timeout`, `TestRunner::default`, and `DefaultHasher::new`. `park_timeout` waits on the clock, next to the new `thread::sleep` ban. `DefaultHasher::new` in Rust 1.100 uses the keys 0 and 0. With proptest's `no_std` feature, `TestRunner::default` uses the crate's deterministic generator and does not open a file. Clippy still cannot name `TestRunner::default`.
- Better: Ban `std::thread::park_timeout` beside `std::thread::sleep`. Keep runner construction in `crate::arbitrary::check`.
- Seen before: 2026-11-28, spec 4, std and unix socket bans still miss sibling calls
- Promoted: yes, the clock-ban guideline in AGENTS.md
