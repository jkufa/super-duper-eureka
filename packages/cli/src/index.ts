#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  parseScenario,
  projectScenario,
  ScenarioError,
  traceAccount
} from '@retirement/calculator';
import type {
  Band,
  ScenarioErrorCode,
  ScenarioProjection,
  TraceSegment
} from '@retirement/calculator';

const USAGE = `Usage:
  retirement-calc --scenario <file> [--today YYYY-MM-DD] [--trace <accountId>] [--band <band>]

Prints one JSON document to stdout: the scenario's projection, or with --trace the
account's trace segments.

Options:
  --scenario <file>    Path to a version 1 scenario JSON file. Required.
  --today <date>       The date results start from. Default: this machine's local date.
  --trace <accountId>  Print the trace of one account instead of the projection.
  --band <band>        baseline, positive or negative. Only with --trace. Default: baseline.
  --help               Print this text.

Exit status:
  0  Success.
  1  Bad usage, or the scenario file cannot be read or is not JSON. Nothing goes to stdout.
  2  The scenario is invalid or cannot be projected. stdout holds
     { "error": { "code", "accountId"?, "ruleId"? } } and stderr the message.`;

const BANDS: ReadonlyArray<Band> = ['baseline', 'positive', 'negative'];

class UsageError extends Error {}

class InputError extends Error {}

interface Command {
  scenarioPath: string;
  today: string;
  trace?: { accountId: string; band: Band };
}

function readCommand(args: Array<string>): Command | 'help' {
  const { values } = parseArgs({
    args,
    options: {
      scenario: { type: 'string' },
      today: { type: 'string' },
      trace: { type: 'string' },
      band: { type: 'string' },
      help: { type: 'boolean' }
    }
  });
  if (values.help) {
    return 'help';
  }
  if (values.scenario === undefined) {
    throw new UsageError('--scenario is required.');
  }
  const today = values.today ?? localToday();
  if (values.trace === undefined) {
    if (values.band !== undefined) {
      throw new UsageError('--band applies only with --trace.');
    }
    return { scenarioPath: values.scenario, today };
  }
  const bandName = values.band ?? 'baseline';
  const band = BANDS.find((candidate) => candidate === bandName);
  if (band === undefined) {
    throw new UsageError(`--band must be one of ${BANDS.join(', ')} (received "${bandName}").`);
  }
  return { scenarioPath: values.scenario, today, trace: { accountId: values.trace, band } };
}

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new InputError(`Cannot read ${path}: ${messageOf(error)}`);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function run(command: Command): ScenarioProjection | Array<TraceSegment> {
  const text = readText(command.scenarioPath);
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch (error) {
    throw new InputError(`${command.scenarioPath} is not JSON: ${messageOf(error)}`);
  }
  const scenario = parseScenario(file, { today: command.today });
  return command.trace
    ? traceAccount(scenario, command.trace.accountId, command.trace.band)
    : projectScenario(scenario);
}

interface ErrorDocument {
  error: { code: ScenarioErrorCode; accountId?: string; ruleId?: string };
}

function errorDocument({ code, accountId, ruleId }: ScenarioError): ErrorDocument {
  const document: ErrorDocument = { error: { code } };
  if (accountId !== undefined) {
    document.error.accountId = accountId;
  }
  if (ruleId !== undefined) {
    document.error.ruleId = ruleId;
  }
  return document;
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(args: Array<string>): number {
  try {
    const command = readCommand(args);
    if (command === 'help') {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    printJson(run(command));
    return 0;
  } catch (error) {
    if (error instanceof ScenarioError) {
      printJson(errorDocument(error));
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    if (error instanceof UsageError || isParseArgsError(error)) {
      process.stderr.write(`${messageOf(error)}\n\n${USAGE}\n`);
      return 1;
    }
    if (error instanceof InputError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

function isParseArgsError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('ERR_PARSE_ARGS_')
  );
}

process.exitCode = main(process.argv.slice(2));
