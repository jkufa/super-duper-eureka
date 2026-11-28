import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { constants } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { generateCase } from '../src/lib/corpus/case';
import { stableJson } from '../src/lib/corpus/json';
import { HAND_CASES } from './golden/hand-computed';
import { rustJson } from './golden/rust-json';
import { candidateOf, selectCases } from './golden/select';
import type { ErrorReport } from './parity/compare';
import { errorReportOf, memberAt, parseJson } from './parity/compare';

const USAGE = `Usage: golden <lastSeed>

Captures the golden set from the TypeScript CLI on Bun into crates/cli/tests/golden/: the CLI
examples, every case in parity/regressions/, the hand-computed cases, and 200 generated cases
chosen from seeds 1 to lastSeed to cover every trait, with a manifest of their names. The new set
replaces the old one whole.`;

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const TESTS = join(REPO, 'crates/cli/tests');
const GOLDEN = join(TESTS, 'golden');
const STAGED = join(TESTS, '.golden-new');
const RETIRED = join(TESTS, '.golden-old');
const MANIFEST = 'manifest';
const SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'] as const;
const EXAMPLES = join(REPO, 'packages/cli/examples');
const REGRESSIONS = join(REPO, 'parity/regressions');
const TS_CLI = join(REPO, 'packages/cli/src/index.ts');
const GENERATED_CASES = 200;
const SEED_PATTERN = /^[1-9][0-9]*$/;
const SCENARIO_SUFFIX = '.scenario.json';

const EXAMPLE_TODAYS: ReadonlyArray<[string, string]> = [
  ['basic', '2026-01-01'],
  ['custom-growth', '2026-01-01'],
  ['daily', '2026-02-01'],
  ['one-time', '2026-01-01'],
  ['stale-and-excluded', '2026-06-15']
];

/** One golden input: the scenario file's text and its today. */
interface GoldenInput {
  group: string;
  name: string;
  scenarioText: string;
  today: string;
}

function firstAccountId(scenarioText: string): string | undefined {
  const accounts = memberAt(parseJson(scenarioText), ['accounts']);
  const id = Array.isArray(accounts) ? memberAt(accounts[0], ['id']) : undefined;
  return typeof id === 'string' ? id : undefined;
}

function examples(): Array<GoldenInput> {
  return EXAMPLE_TODAYS.map(([name, today]) => ({
    group: 'examples',
    name,
    scenarioText: readFileSync(join(EXAMPLES, `${name}.json`), 'utf8'),
    today
  }));
}

function regressions(): Array<GoldenInput> {
  return readdirSync(REGRESSIONS)
    .filter((file) => file.endsWith(SCENARIO_SUFFIX))
    .toSorted()
    .map((file) => {
      const name = file.slice(0, -SCENARIO_SUFFIX.length);
      const corpusCase = parseJson(readFileSync(join(REGRESSIONS, `${name}.json`), 'utf8'));
      const today = memberAt(corpusCase, ['today']);
      if (typeof today !== 'string') {
        throw new Error(`Regression ${name} has no today.`);
      }
      return {
        group: 'regressions',
        name,
        scenarioText: readFileSync(join(REGRESSIONS, file), 'utf8'),
        today
      };
    });
}

function handComputed(): Array<GoldenInput> {
  return HAND_CASES.map(({ name, scenario, today }) => ({
    group: 'hand-computed',
    name,
    scenarioText: stableJson(scenario),
    today
  }));
}

function generated(lastSeed: number): Array<GoldenInput> {
  const pool = Array.from({ length: lastSeed }, (_, index) =>
    candidateOf(index + 1, generateCase(index + 1))
  );
  const chosen = selectCases(pool, GENERATED_CASES);
  const covered = new Set(chosen.flatMap(({ traits }) => traits));
  const missing = [...new Set(pool.flatMap(({ traits }) => traits))].filter(
    (trait) => !covered.has(trait)
  );
  if (missing.length > 0) {
    throw new Error(`The chosen cases miss ${missing.join(', ')}.`);
  }
  process.stderr.write(
    `Chose ${String(chosen.length)} of ${String(pool.length)} seeds covering ${String(covered.size)} traits: ${chosen.map(({ seed }) => seed).join(' ')}\n`
  );
  return chosen.map(({ seed, corpusCase }) => ({
    group: 'generated',
    name: `seed-${String(seed).padStart(5, '0')}`,
    scenarioText: stableJson(corpusCase.scenario),
    today: corpusCase.today
  }));
}

/** The TypeScript CLI's document in the Rust CLI's print, and whether it is an error document. */
interface Captured {
  printed: string;
  error: ErrorReport | undefined;
}

/** Runs the TypeScript CLI and returns its document in the Rust CLI's print. */
function capture(args: Array<string>, label: string): Captured {
  const { status, stdout, stderr } = spawnSync('bun', [TS_CLI, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 30
  });
  const document = parseJson(stdout);
  if (document === undefined || (status !== 0 && status !== 2)) {
    throw new Error(`${label}: exit ${String(status)}: ${stderr}`);
  }
  const error = errorReportOf(document);
  if ((status === 2) !== (error !== undefined)) {
    throw new Error(`${label}: exit ${String(status)} does not match its document.`);
  }
  const printed = rustJson(document);
  if (!isDeepStrictEqual(parseJson(printed), document)) {
    throw new Error(`${label}: the reprinted document reads back differently.`);
  }
  return { printed, error };
}

/**
 * The account a case traces: the first account of a scenario that projects, or that parses and
 * then fails with `not_finite`. A scenario that fails to parse has no trace.
 */
function tracedAccount(scenarioText: string, projection: Captured): string | undefined {
  const parsed = projection.error === undefined || projection.error.code === 'not_finite';
  return parsed ? firstAccountId(scenarioText) : undefined;
}

function writeCase(root: string, input: GoldenInput) {
  const dir = join(root, input.group, input.name);
  mkdirSync(dir, { recursive: true });
  const scenarioPath = join(dir, 'scenario.json');
  writeFileSync(scenarioPath, input.scenarioText);
  writeFileSync(join(dir, 'today'), `${input.today}\n`);
  const args = ['--scenario', scenarioPath, '--today', input.today];
  const label = `${input.group}/${input.name}`;
  const projection = capture(args, label);
  writeFileSync(join(dir, 'projection.json'), projection.printed);
  const accountId = tracedAccount(input.scenarioText, projection);
  if (accountId !== undefined) {
    writeFileSync(join(dir, 'trace'), `${accountId}\n`);
    writeFileSync(join(dir, 'trace.json'), capture([...args, '--trace', accountId], label).printed);
  }
}

/** One line per case, `group/name`, sorted. */
function manifestOf(inputs: ReadonlyArray<GoldenInput>): string {
  return inputs
    .map(({ group, name }) => `${group}/${name}\n`)
    .toSorted()
    .join('');
}

/**
 * Puts the old set back if a run stopped between its two renames, then removes what is left of the
 * staged and the old set. The old set goes only once a set is in place.
 */
function settle() {
  if (!existsSync(GOLDEN) && existsSync(RETIRED)) {
    renameSync(RETIRED, GOLDEN);
  }
  rmSync(STAGED, { recursive: true, force: true });
  if (existsSync(GOLDEN)) {
    rmSync(RETIRED, { recursive: true, force: true });
  }
}

/**
 * Moves the old set aside and the staged set in. A signal that arrives meanwhile waits for both
 * renames, then settles and exits.
 */
function publish() {
  for (const signal of SIGNALS) {
    process.on(signal, () => {
      settle();
      process.exit(128 + constants.signals[signal]);
    });
  }
  if (existsSync(GOLDEN)) {
    renameSync(GOLDEN, RETIRED);
  }
  renameSync(STAGED, GOLDEN);
}

function main(args: Array<string>): number {
  const [lastText, ...rest] = args;
  if (lastText === undefined || !SEED_PATTERN.test(lastText) || rest.length > 0) {
    process.stderr.write(`${USAGE}\n`);
    return 1;
  }
  const inputs = [
    ...examples(),
    ...regressions(),
    ...handComputed(),
    ...generated(Number(lastText))
  ];
  mkdirSync(TESTS, { recursive: true });
  settle();
  try {
    mkdirSync(STAGED);
    for (const input of inputs) {
      writeCase(STAGED, input);
    }
    writeFileSync(join(STAGED, MANIFEST), manifestOf(inputs));
    publish();
  } finally {
    settle();
  }
  process.stderr.write(`Wrote ${String(inputs.length)} golden cases to ${GOLDEN}.\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
