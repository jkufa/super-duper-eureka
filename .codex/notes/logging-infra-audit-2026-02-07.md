# Logging Infrastructure Audit (Webapp)
Date: 2026-02-07
Scope: `apps/webapp` + shared `packages/logger`
Skill applied: `logging-best-practices`

## Executive Summary
The logging implementation is structurally close to wide-event style, but current client logging carries several fields that are either meaningless for a client-only app, constant/redundant, or duplicated by construction. The largest issues are:

1. Context is merged multiple times (`base` in event builder + `base` in logger), creating redundant code and override ambiguity.
2. Client events can inherit server runtime context (`runtime: node ...`) via `logContext`, which is incorrect for browser events.
3. Some identity fields are currently constant placeholders (`session_id: web-session`, `run_id: ui-preview`) and provide no analytical value.
4. Step events repeat heavy static payload on every step (`config`, and full contribution arrays), creating high noise with little incremental value.

## Current Logging Path
- Shared logger schema + sink: `packages/logger/src/index.ts`
- Client context provider: `apps/webapp/src/lib/client/logging/logging-context.svelte.ts`
- Debug logger usage: `apps/webapp/src/lib/components/debug/DebuggerBody.svelte`
- Server request context producer: `apps/webapp/src/hooks.server.ts`
- Server-enriched page context passed to client: `apps/webapp/src/routes/+page.server.ts`

## Findings

### 1) Redundant base merge in event creation (High)
- `createWideEventLogger` already prepends `base` to every event (`packages/logger/src/index.ts`).
- Event builders also spread `base` into each event (`packages/calculator/src/lib/debug.ts`: `buildStepWideEventInput`, `buildRunWideEvent`).
- `DebuggerBody.svelte` passes `eventDetails` as `base` to those builders, and `eventDetails` itself already includes `base`.

Impact:
- Repetition and larger payload objects before serialization.
- Harder reasoning about precedence when fields collide.

### 2) Server context leaks into client events (High)
- `hooks.server.ts` adds node/server environment context into `locals.logContext`.
- `+page.server.ts` forwards this to page data.
- `DebuggerBody.svelte` builds client `eventDetails` as `{ ...base, ...logContext, request_id: base.request_id, ... }`.

Impact:
- Browser events may carry server runtime attributes (for example node runtime metadata) which are semantically wrong in client logs.

### 3) Constant identity fields are low-value noise (High)
Source: `apps/webapp/src/lib/components/debug/Debugger.svelte`.
- `session_id` is hardcoded to `web-session`.
- `run_id` is hardcoded to `ui-preview`.

Impact:
- Looks like high-cardinality identifiers but is actually constant cardinality=1.
- Misleads query consumers and adds schema clutter.

### 4) Client-only unnecessary infrastructure fields (Medium)
For local console-only logging (no ingestion, no cross-service tracing), these are generally unnecessary unless you have a concrete local debugging use-case:
- `region`
- `instance_id`
- `commit_hash` (unless injected at build time and actively used)
- `service_version` (if static placeholder only)

These fields are valuable in distributed/server deployments, but low utility in local browser-only operation.

### 5) Browser fingerprint-heavy fields are optional and often overkill (Medium)
Source: `getBrowserEnvironmentContext` in `packages/logger/src/index.ts`.
- `user_agent`
- `languages`
- `platform`
- `browser_name` + `browser_version` + `runtime` (partial overlap)

Impact:
- For client-local logs, this is usually unnecessary detail.
- Adds potential privacy sensitivity and payload bloat.

### 6) Step events are too wide for per-step emission (Medium)
Source: `packages/calculator/src/lib/debug.ts` + `DebuggerBody.svelte`.
- Every step logs full `config` summary and large `step` payload including `contributions_by_day`.

Impact:
- Very verbose logs with high repetition.
- Harder to scan locally; expensive in memory/console volume.

### 7) Duplicate logger entry points with inconsistent service names (Low)
- `apps/webapp/src/lib/client/logging/logger.ts` uses `service_name: retirement-webapp-client`.
- `logging-context.svelte.ts` defaults to `service_name: retirement-webapp`.

Impact:
- Same client surface can emit different service identities depending on import path.

### 8) Potentially stale export path (Low)
- `apps/webapp/src/lib/index.ts` exports `./client/logger`, but logger file is in `./client/logging/logger.ts`.

Impact:
- Not directly a field issue, but a logging infra wiring inconsistency.

## Field Recommendations for Client-Only Webapp

### Keep (core)
- `timestamp`
- `level`
- `event_type`
- `outcome`
- `duration_ms` (where meaningful)
- `error` (on failures)
- Small business context fields relevant to the calc (`feature`, `projection_years`, `contribution_rule_count`, maybe `mock_real_data`)

### Keep only if generated dynamically
- `request_id` (only if truly per interaction/request)
- `session_id` (only if unique per browser session)
- `run_id` (only if unique per calculator run)

### Remove for current client-only setup
- `region`
- `instance_id`
- `commit_hash` (unless real build metadata is injected and consumed)
- Hardcoded placeholder IDs: current `session_id`, `run_id`

### Consider removing/minimizing
- `service_version` if always placeholder
- `user_agent`, `languages`, `platform`, `timezone` unless actively needed
- Per-step repeated `config` block (emit once in run event instead)
- Large `contributions_by_day` from default step logs (gate behind explicit deep-debug flag)

## Practical Simplification Target
A lean client event baseline could be:
- `timestamp`, `level`, `event_type`, `outcome`, `duration_ms`
- `request_id`/`session_id`/`run_id` only when truly unique
- minimal business context (`feature`, horizon, contribution count)
- `error` object for failure events

This keeps logs readable and useful without server-oriented infra metadata.

## Implemented Cleanup (2026-02-07)
- Removed browser-only low-value fields from default environment context:
  - dropped `languages`
  - dropped `timezone`
- Kept requested fields in browser context:
  - `region` (still available in schema)
  - `commit_hash` (still available in schema)
  - `user_agent`
  - `platform`
  - `language`
  - `browser_name`
  - `browser_version`
- Strengthened type schema in `WideEventBase` to explicitly include:
  - `browser_name`, `browser_version`, `user_agent`, `platform`, `language`
- Stopped server runtime context from being forwarded into client event context:
  - removed `getDefaultEnvironmentContext()` from `apps/webapp/src/hooks.server.ts` log context
- Removed hardcoded low-cardinality IDs in client logger setup:
  - deleted fixed `session_id: web-session`
  - deleted fixed `run_id: ui-preview`
- Added dynamic identifiers for client logs in `initLoggingContext`:
  - generated `request_id` when absent
  - session-scoped `session_id` persisted via `sessionStorage`
  - generated `run_id` for each provider initialization
- Sanitized event context in debugger logging:
  - now forwards only known business fields from `logContext` (`feature`, `projection_years`, `contribution_rule_count`, `mock_real_data`, `mock_seed`)
  - avoids accidental propagation of server/env fields into client events
- Fixed logging export wiring issues:
  - corrected `apps/webapp/src/lib/client/logging/index.ts` export path
  - corrected `apps/webapp/src/lib/index.ts` export path
- Aligned client logger service identity:
  - changed `retirement-webapp-client` to `retirement-webapp`
