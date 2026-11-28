# @retirement/cli

Runs the retirement engine on a scenario file and prints the result as JSON.

## Usage

```bash
retirement-calc --scenario <file> [--today YYYY-MM-DD] [--trace <accountId>] [--band <band>]
```

From the repo root, `bun packages/cli/src/index.ts --scenario packages/cli/examples/basic.json --today 2026-01-01` runs it on Bun. Programs should call it this way. `vp run retirement-calc` with the same options also runs it, but prints a line of its own to stdout before the JSON.

## Options

- `--scenario <file>`: a version 1 scenario JSON file. Required.
- `--today <date>`: the date results start from, `YYYY-MM-DD`. Default: this machine's local date.
- `--trace <accountId>`: print the account's trace segments instead of the projection.
- `--band <band>`: `baseline`, `positive` or `negative`. Only with `--trace`. Default: `baseline`.
- `--help`: print the usage text.

## Output

stdout holds exactly one JSON document, indented by two spaces and ending in a newline: the `ScenarioProjection`, or with `--trace` an array of `TraceSegment`. The same input and `--today` give byte-identical output.

## Exit status

- `0`: success.
- `1`: bad usage, or the scenario file cannot be read or is not JSON. The message goes to stderr and nothing goes to stdout.
- `2`: the scenario is invalid or cannot be projected. stdout holds `{ "error": { "code": "...", "accountId": "...", "ruleId": "..." } }`, with `accountId` and `ruleId` only when the error carries them, and stderr holds the message.
