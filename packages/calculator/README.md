# @retirement/calculator

The retirement projection engine. It takes a scenario file, checks it once, and projects every account from today to the scenario's end date in three bands. It never reads the clock: the caller passes today.

## Usage

```ts
import { parseScenario, projectScenario, traceAccount } from '@retirement/calculator';

const scenario = parseScenario(JSON.parse(text), { today: '2026-01-01' });
const projection = projectScenario(scenario);
const trace = traceAccount(scenario, '401k', 'baseline');
```

`parseScenario` throws a `ScenarioError` with a `code`, the `path` of the field at fault, and the `accountId` and `ruleId` it belongs to. `projectScenario` and `traceAccount` throw `not_finite` and `unknown_account` the same way.

## Exports

- Functions: `parseScenario`, `projectScenario`, `traceAccount`.
- Errors: `ScenarioError` and its `ScenarioErrorCode`.
- File types: `ScenarioFile`, `AccountFile`, `ContributionRuleFile`, `RuleTiming`, `PlainDateString`, `RunOptions`.
- Result types: `ScenarioProjection`, `Band`, `BandProjection`, `AccountProjection`, `Series`, `Row`, `TraceSegment`, `TraceDeposit`.

The scenario file format and every rule of the engine are in `implementation/rust-redesign/02-ts-engine-rebuild-spec.md`, parts C to F. `packages/cli/examples/` holds example files.
