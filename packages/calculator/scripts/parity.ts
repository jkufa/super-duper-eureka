import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateCase } from '../src/lib/corpus/case';
import { stableJson } from '../src/lib/corpus/json';
import type { Json } from '../src/lib/corpus/json';
import { observeTraits } from '../src/lib/corpus/traits';
import { parseScenario } from '../src/lib/parse-scenario';
import type { Scenario, ScenarioFile } from '../src/lib/scenario';
import {
  compareDocuments,
  compareErrors,
  errorReportOf,
  expectedErrorOf,
  memberAt,
  parseJson,
  relativeDifference,
  TOLERANCE
} from './parity/compare';
import type { ErrorReport, NumberDifference } from './parity/compare';

const USAGE = `Usage: parity <workDir> <lastSeed>

Writes parity corpus seeds 1 to lastSeed into workDir, which must be outside the repo, runs every
seed and every case in parity/regressions/ through the TypeScript CLI on Bun and the release
Rust CLI, compares the two, and prints a report. Exits 1 when anything mismatches.`;

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const REGRESSIONS = join(REPO, 'parity/regressions');
const TS_CLI = join(REPO, 'packages/cli/src/index.ts');
const RUST_CLI = join(REPO, 'target/release/retirement-calc');
const GROWTH = 'growth_periods_over_1000';
const SEED_PATTERN = /^[1-9][0-9]*$/;
const CASE_SUFFIX = '.json';
const SCENARIO_SUFFIX = '.scenario.json';

/** One case to run: a scenario file, the today to run it with, and its traits. */
interface ParityCase {
  name: string;
  scenarioPath: string;
  scenario: Json;
  today: string;
  traits: Array<string>;
}

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

type Run = 'projection' | 'trace';

interface Mismatch {
  run: Run;
  path: string;
  reason: string;
  ts: string;
  rust: string;
}

interface RunDifference extends NumberDifference {
  run: Run;
}

interface CaseResult {
  parityCase: ParityCase;
  /** The traits the report groups by. */
  groups: Array<string>;
  growth: boolean;
  status: number;
  traced: boolean;
  numbers: number;
  signedZeros: number;
  differences: Array<RunDifference>;
  mismatches: Array<Mismatch>;
  /** An `effectiveRate` beyond the tolerance in a growth case, which does not fail the run. */
  conditionedRate?: { difference: RunDifference; finalBalanceRelative: number };
}

function seedFrom(text: string | undefined): number | undefined {
  return text !== undefined && SEED_PATTERN.test(text) && Number.isSafeInteger(Number(text))
    ? Number(text)
    : undefined;
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function writeSeeds(workDir: string, lastSeed: number): Array<ParityCase> {
  mkdirSync(workDir, { recursive: true });
  const cases: Array<ParityCase> = [];
  for (let seed = 1; seed <= lastSeed; seed++) {
    const corpusCase = generateCase(seed);
    const { today, traits } = corpusCase;
    const name = String(seed);
    const scenarioPath = join(workDir, `${name}${SCENARIO_SUFFIX}`);
    const scenarioText = stableJson(corpusCase.scenario);
    writeFileSync(join(workDir, `${name}${CASE_SUFFIX}`), stableJson(corpusCase));
    writeFileSync(scenarioPath, scenarioText);
    const scenario = parseJson(scenarioText) ?? null;
    cases.push({ name: `seed ${name}`, scenarioPath, scenario, today, traits });
  }
  return cases;
}

function readRegressions(): Array<ParityCase> {
  return readdirSync(REGRESSIONS)
    .filter((file) => file.endsWith(CASE_SUFFIX) && !file.endsWith(SCENARIO_SUFFIX))
    .toSorted()
    .map((file) => {
      const name = file.slice(0, -CASE_SUFFIX.length);
      const scenarioPath = join(REGRESSIONS, `${name}${SCENARIO_SUFFIX}`);
      const { scenario, today, traits } = regressionFields(
        name,
        parseJson(readFileSync(join(REGRESSIONS, file), 'utf8'))
      );
      if (readFileSync(scenarioPath, 'utf8') !== stableJson(scenario)) {
        throw new Error(`${name}${SCENARIO_SUFFIX} is not the scenario in ${file}.`);
      }
      return { name: `regression ${name}`, scenarioPath, scenario, today, traits };
    });
}

function regressionFields(
  name: string,
  value: Json | undefined
): Pick<ParityCase, 'scenario' | 'today' | 'traits'> {
  const scenario = memberAt(value, ['scenario']);
  const today = memberAt(value, ['today']);
  const traits = memberAt(value, ['traits']);
  if (
    value === undefined ||
    stableJson(value) !== stableJson({ scenario, today, traits }) ||
    scenario === undefined ||
    typeof today !== 'string' ||
    !Array.isArray(traits)
  ) {
    throw new Error(`Regression ${name} is not { scenario, today, traits }.`);
  }
  return {
    scenario,
    today,
    traits: traits.filter((trait): trait is string => typeof trait === 'string')
  };
}

function buildRustCli() {
  const { status } = spawnSync('cargo', ['build', '--release', '-p', 'retirement-cli'], {
    cwd: REPO,
    stdio: ['ignore', 'inherit', 'inherit']
  });
  if (status !== 0) {
    throw new Error('cargo build --release -p retirement-cli failed.');
  }
}

async function runCli(program: string, args: Array<string>): Promise<CliResult> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Array<Buffer> = [];
    const stderr: Array<Buffer> = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', rejectRun);
    child.on('close', (status) => {
      resolveRun({
        status: status ?? -1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8')
      });
    });
  });
}

async function runBoth(args: Array<string>): Promise<[CliResult, CliResult]> {
  return Promise.all([runCli('bun', [TS_CLI, ...args]), runCli(RUST_CLI, args)]);
}

type Shown = Json | ErrorReport | undefined;

function show(value: Shown): string {
  return typeof value === 'number' || value === undefined ? String(value) : JSON.stringify(value);
}

function firstLine(text: string): string {
  return text.split('\n', 1)[0] ?? '';
}

/** Compares one run of both CLIs and returns its error reports when both failed with status 2. */
function compareRun(
  run: Run,
  ts: CliResult,
  rust: CliResult,
  result: CaseResult
): [ErrorReport, ErrorReport] | undefined {
  const mismatch = (path: string, reason: string, tsValue: Shown, rustValue: Shown) => {
    result.mismatches.push({ run, path, reason, ts: show(tsValue), rust: show(rustValue) });
  };
  if (ts.status !== rust.status) {
    mismatch(
      '(exit status)',
      'different exit status',
      `${String(ts.status)} ${firstLine(ts.stderr)}`,
      `${String(rust.status)} ${firstLine(rust.stderr)}`
    );
    return undefined;
  }
  if (ts.status === 1) {
    if (ts.stdout !== '' || rust.stdout !== '') {
      mismatch('(stdout)', 'exit 1 with output', ts.stdout, rust.stdout);
    }
    return undefined;
  }
  const tsDocument = parseJson(ts.stdout);
  const rustDocument = parseJson(rust.stdout);
  if (ts.status === 2) {
    const tsError = errorReportOf(tsDocument);
    const rustError = errorReportOf(rustDocument);
    if (!tsError || !rustError) {
      mismatch('$', 'exit 2 without an error document', ts.stdout, rust.stdout);
      return undefined;
    }
    for (const problem of compareErrors(tsError, rustError)) {
      mismatch('$.error', problem, tsError, rustError);
    }
    return [tsError, rustError];
  }
  if (ts.status !== 0 || tsDocument === undefined || rustDocument === undefined) {
    mismatch('$', `exit ${String(ts.status)} without a JSON document`, ts.stdout, rust.stdout);
    return undefined;
  }
  const comparison = compareDocuments(tsDocument, rustDocument);
  result.numbers += comparison.numbers;
  result.signedZeros += comparison.signedZeros;
  if (comparison.structure) {
    const { path, reason, ts: tsValue, rust: rustValue } = comparison.structure;
    mismatch(path, reason, tsValue, rustValue);
  }
  for (const difference of comparison.differences) {
    const runDifference = { ...difference, run };
    result.differences.push(runDifference);
    if (!result.growth) {
      mismatch(difference.path, 'differs outside growth cases', difference.ts, difference.rust);
    } else if (run === 'projection' && difference.path === '$.effectiveRate') {
      if (difference.beyondTolerance) {
        result.conditionedRate = {
          difference: runDifference,
          finalBalanceRelative: finalBalanceDifference(tsDocument, rustDocument)
        };
      }
    } else if (difference.beyondTolerance) {
      mismatch(difference.path, 'beyond the tolerance', difference.ts, difference.rust);
    }
  }
  return undefined;
}

const FINAL_BALANCE = ['bands', 'baseline', 'total', 'finalBalance'];

function finalBalanceDifference(ts: Json, rust: Json): number {
  return relativeDifference(
    Number(memberAt(ts, FINAL_BALANCE)),
    Number(memberAt(rust, FINAL_BALANCE))
  );
}

function checkTraits(
  expected: ErrorReport | undefined,
  status: number,
  errors: [ErrorReport, ErrorReport] | undefined,
  result: CaseResult
) {
  const mismatch = (reason: string, ts: Shown, rust: Shown) => {
    result.mismatches.push({
      run: 'projection',
      path: '(traits)',
      reason,
      ts: show(ts),
      rust: show(rust)
    });
  };
  if (!expected) {
    if (status !== 0) {
      mismatch('traits predict success', status, status);
    }
    return;
  }
  if (!errors) {
    mismatch(`traits predict ${expected.code}`, status, status);
    return;
  }
  const [tsError, rustError] = errors;
  for (const problem of [
    ...compareErrors(expected, tsError, ['traits', 'TS']),
    ...compareErrors(expected, rustError, ['traits', 'Rust'])
  ]) {
    mismatch(problem, tsError, rustError);
  }
}

function firstAccountId(scenario: Json): string | undefined {
  const accounts = memberAt(scenario, ['accounts']);
  const id = Array.isArray(accounts) ? memberAt(accounts[0], ['id']) : undefined;
  return typeof id === 'string' ? id : undefined;
}

function parsesAs(file: unknown, scenario: Scenario | undefined): file is ScenarioFile {
  return scenario !== undefined;
}

/** What `observeTraits` reads from an engine-error case, whose own traits name only its fault. */
function observedTraits(parityCase: ParityCase): Array<string> {
  if (!parityCase.traits.includes('engine_error')) {
    return [];
  }
  const file = parityCase.scenario;
  try {
    const scenario = parseScenario(file, { today: parityCase.today });
    return parsesAs(file, scenario) ? observeTraits(file, scenario) : [];
  } catch {
    return [];
  }
}

function groupsOf(parityCase: ParityCase, observed: Array<string>): Array<string> {
  const groups = [...new Set([...parityCase.traits, ...observed])].map((trait) =>
    trait.startsWith('error_account:')
      ? 'error_account'
      : trait.startsWith('error_rule:')
        ? 'error_rule'
        : trait
  );
  return parityCase.name.startsWith('regression ') ? [...groups, 'regression'] : groups;
}

async function runCase(parityCase: ParityCase): Promise<CaseResult> {
  const args = ['--scenario', parityCase.scenarioPath, '--today', parityCase.today];
  const [ts, rust] = await runBoth(args);
  const observed = observedTraits(parityCase);
  const result: CaseResult = {
    parityCase,
    groups: groupsOf(parityCase, observed),
    growth: parityCase.traits.includes(GROWTH) || observed.includes(GROWTH),
    status: ts.status,
    traced: false,
    numbers: 0,
    signedZeros: 0,
    differences: [],
    mismatches: []
  };
  const errors = compareRun('projection', ts, rust, result);
  checkTraits(expectedErrorOf(parityCase.traits), ts.status, errors, result);
  const accountId = firstAccountId(parityCase.scenario);
  if (accountId !== undefined && !parityCase.traits.includes('invalid')) {
    result.traced = true;
    const [tsTrace, rustTrace] = await runBoth([...args, '--trace', accountId]);
    compareRun('trace', tsTrace, rustTrace, result);
  }
  return result;
}

async function runAll(cases: Array<ParityCase>, workers: number): Promise<Array<CaseResult>> {
  const results: Array<CaseResult> = Array.from({ length: cases.length });
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < cases.length) {
      const index = next;
      next += 1;
      const parityCase = cases[index];
      if (parityCase) {
        results[index] = await runCase(parityCase);
      }
      done += 1;
      if (done % 1000 === 0) {
        process.stderr.write(`${String(done)} of ${String(cases.length)} cases\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

interface Group {
  cases: number;
  withDifference: number;
  mismatched: number;
  largest: number;
}

function largestOf(results: Array<CaseResult>): { relative: number; where: string } {
  let largest = { relative: 0, where: '-' };
  for (const result of results) {
    for (const difference of result.differences) {
      if (difference.relative > largest.relative) {
        largest = {
          relative: difference.relative,
          where: `${result.parityCase.name} ${difference.run} ${difference.path}`
        };
      }
    }
  }
  return largest;
}

function report(results: Array<CaseResult>, workers: number, seconds: number) {
  const lines: Array<string> = [];
  const statuses = new Map<number, number>();
  const groups = new Map<string, Group>();
  for (const result of results) {
    statuses.set(result.status, (statuses.get(result.status) ?? 0) + 1);
    const largest = Math.max(0, ...result.differences.map(({ relative }) => relative));
    for (const name of result.groups) {
      const group = groups.get(name) ?? { cases: 0, withDifference: 0, mismatched: 0, largest: 0 };
      group.cases += 1;
      group.withDifference += result.differences.length > 0 ? 1 : 0;
      group.mismatched += result.mismatches.length > 0 ? 1 : 0;
      group.largest = Math.max(group.largest, largest);
      groups.set(name, group);
    }
  }
  const growth = results.filter((result) => result.growth);
  const outside = results.filter((result) => !result.growth);
  const overall = largestOf(results);
  const mismatched = results.filter((result) => result.mismatches.length > 0);
  const conditioned = results.filter((result) => result.conditionedRate);
  const sum = (pick: (result: CaseResult) => number) =>
    results.reduce((total, result) => total + pick(result), 0);

  lines.push(
    `Cases: ${String(results.length)}, run on ${String(workers)} workers in ${seconds.toFixed(1)} s`,
    `Projection exit statuses: ${[...statuses]
      .toSorted(([a], [b]) => a - b)
      .map(([status, count]) => `${String(status)}: ${String(count)}`)
      .join(', ')}`,
    `Traces compared: ${String(sum((result) => (result.traced ? 1 : 0)))}`,
    `Numbers compared: ${String(sum((result) => result.numbers))}`,
    `Numbers that differ: ${String(sum((result) => result.differences.length))}`,
    `Sign-of-zero differences: ${String(sum((result) => result.signedZeros))}`,
    `Tolerance: ${String(TOLERANCE)}`,
    `Largest relative difference overall: ${String(overall.relative)} (${overall.where})`,
    `Largest relative difference outside ${GROWTH}: ${String(largestOf(outside).relative)} (${largestOf(outside).where})`,
    `Largest relative difference inside ${GROWTH} (${String(growth.length)} cases): ${String(largestOf(growth).relative)} (${largestOf(growth).where})`
  );
  if (overall.relative < 1e-12) {
    lines.push(
      `The largest difference is below 1e-12: spec 4 part F tightens the tolerance to ${String(overall.relative * 100)}.`
    );
  }
  lines.push(
    '',
    'Trait | cases | with a numeric difference | mismatched | largest relative difference'
  );
  for (const [name, group] of [...groups].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    lines.push(
      `${name} | ${String(group.cases)} | ${String(group.withDifference)} | ${String(group.mismatched)} | ${String(group.largest)}`
    );
  }
  lines.push(
    '',
    `effectiveRate beyond the tolerance in ${GROWTH} cases: ${String(conditioned.length)}`
  );
  for (const { parityCase, conditionedRate } of conditioned) {
    if (conditionedRate) {
      const { difference, finalBalanceRelative } = conditionedRate;
      lines.push(
        `  ${parityCase.name}: TS ${String(difference.ts)}, Rust ${String(difference.rust)}, relative ${String(difference.relative)}; baseline finalBalance relative difference ${String(finalBalanceRelative)}`
      );
    }
  }
  lines.push('', `Mismatched cases: ${String(mismatched.length)}`);
  for (const result of mismatched) {
    const [first] = result.mismatches;
    if (first) {
      lines.push(
        `  ${result.parityCase.name} (${String(result.mismatches.length)} mismatches): ${first.run} ${first.path}: ${first.reason}; TS ${first.ts}, Rust ${first.rust}`
      );
    }
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return mismatched.length === 0;
}

async function main(args: Array<string>): Promise<number> {
  const [workDirText, lastText, ...rest] = args;
  const lastSeed = seedFrom(lastText);
  if (workDirText === undefined || lastSeed === undefined || rest.length > 0) {
    process.stderr.write(`${USAGE}\n`);
    return 1;
  }
  const workDir = resolve(workDirText);
  if (isInside(REPO, workDir)) {
    process.stderr.write(`${workDir} is inside the repo. Pick a folder outside it.\n`);
    return 1;
  }
  buildRustCli();
  const cases = [...writeSeeds(workDir, lastSeed), ...readRegressions()];
  const workers = availableParallelism();
  const started = performance.now();
  const results = await runAll(cases, workers);
  const seconds = (performance.now() - started) / 1000;
  return report(results, workers, seconds) ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
