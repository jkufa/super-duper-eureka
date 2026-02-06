# @retirement/logger

Wide event logging utilities for consistent, structured logs across apps and packages.

## Purpose

This package provides a single logger that emits a context rich JSON event per operation. The logger is intended to be reused by the CLI, calculator debug tooling, and future UI components.

## Usage

```ts
import { createWideEventLogger, getDefaultEnvironmentContext } from '@retirement/logger';

const base = {
  service_name: 'retirement-cli',
  service_version: '1.0.0',
  ...getDefaultEnvironmentContext(),
  request_id: 'req_123',
  run_id: 'run_456'
};

const logger = createWideEventLogger({ base, pretty: true });

logger.info({
  event_type: 'projection_run',
  outcome: 'success',
  duration_ms: 42,
  config: { time_horizon_years: 25 }
});
```

## Logger options

- `base`: Required. Shared fields that appear in every event. Use this for environment and run identifiers.
- `pretty`: Optional. Defaults to true. Pretty prints JSON with indentation.
- `indent`: Optional. Defaults to 2 when pretty is true.
- `sink`: Optional. Supply a custom sink for `info` and `error` payloads.

## Exports

- `createWideEventLogger`
- `getDefaultEnvironmentContext`
- `WideEvent` and related types
