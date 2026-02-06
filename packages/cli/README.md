# @retirement/cli

Command line tooling to run the retirement calculator and debug step by step behavior.

## Usage

```bash
retirement-calc --config packages/cli/examples/basic.json
```

## Debug mode

```bash
retirement-calc --config packages/cli/examples/basic.json --debug
```

Debug mode emits wide events for every step and a final run summary. By default output is pretty printed JSON.

## Options

- `--config <path>`: Path to a JSON file that matches `RetirementConfig`.
- `--debug`: Emit step wide events and a final run event.
- `--no-interactive`: Do not pause between steps when `--debug` is enabled.
- `--raw`: Emit raw JSON without pretty formatting.
- `--skip <spec>`: Skip prompts for specific steps. Example `1,3-5,next:10`.
- `--help`: Show help.

## Skip spec

The skip spec supports a flexible syntax:

- `1,3,5` skips specific step indices
- `3-7` skips a range of steps
- `next:10` skips the next 10 steps

You can combine tokens with commas. For example `1,3-5,next:10`.
