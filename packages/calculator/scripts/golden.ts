import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { generateCase } from '../src/lib/corpus/case';
import { stableJson } from '../src/lib/corpus/json';
import { HAND_CASES } from './golden/hand-computed';
import { rustJson } from './golden/rust-json';
import { candidateOf, selectCases } from './golden/select';
import { errorReportOf, memberAt, parseJson } from './parity/compare';

const USAGE = `Usage: golden <lastSeed>

Captures the golden set from the TypeScript CLI on Bun into crates/cli/tests/golden/: the CLI
examples, every case in parity/regressions/, the hand-computed cases, and 200 generated cases
chosen from seeds 1 to lastSeed to cover every trait. The new set replaces the old one whole.`;

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const GOLDEN = join(REPO, 'crates/cli/tests/golden');
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

/** One golden input: the scenario file's text, its today, and whether to keep a trace. */
interface GoldenInput {
  group: string;
  name: string;
  scenarioText: string;
  today: string;
  traceable: boolean;
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
    today,
    traceable: true
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
      const traits = memberAt(corpusCase, ['traits']);
      if (typeof today !== 'string' || !Array.isArray(traits)) {
        throw new Error(`Regression ${name} has no today or traits.`);
      }
      return {
        group: 'regressions',
        name,
        scenarioText: readFileSync(join(REGRESSIONS, file), 'utf8'),
        today,
        traceable: !traits.includes('invalid')
      };
    });
}

function handComputed(): Array<GoldenInput> {
  return HAND_CASES.map(({ name, scenario, today }) => ({
    group: 'hand-computed',
    name,
    scenarioText: stableJson(scenario),
    today,
    traceable: true
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
    today: corpusCase.today,
    traceable: !corpusCase.traits.includes('invalid')
  }));
}

/** Runs the TypeScript CLI and returns its document in the Rust CLI's print. */
function capture(args: Array<string>, label: string): string {
  const { status, stdout, stderr } = spawnSync('bun', [TS_CLI, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 30
  });
  const document = parseJson(stdout);
  if (document === undefined || (status !== 0 && status !== 2)) {
    throw new Error(`${label}: exit ${String(status)}: ${stderr}`);
  }
  if ((status === 2) !== (errorReportOf(document) !== undefined)) {
    throw new Error(`${label}: exit ${String(status)} does not match its document.`);
  }
  const printed = rustJson(document);
  if (!isDeepStrictEqual(parseJson(printed), document)) {
    throw new Error(`${label}: the reprinted document reads back differently.`);
  }
  return printed;
}

function writeCase(root: string, input: GoldenInput) {
  const dir = join(root, input.group, input.name);
  mkdirSync(dir, { recursive: true });
  const scenarioPath = join(dir, 'scenario.json');
  writeFileSync(scenarioPath, input.scenarioText);
  writeFileSync(join(dir, 'today'), `${input.today}\n`);
  const args = ['--scenario', scenarioPath, '--today', input.today];
  const label = `${input.group}/${input.name}`;
  writeFileSync(join(dir, 'projection.json'), capture(args, label));
  const accountId = input.traceable ? firstAccountId(input.scenarioText) : undefined;
  if (accountId !== undefined) {
    writeFileSync(join(dir, 'trace'), `${accountId}\n`);
    writeFileSync(join(dir, 'trace.json'), capture([...args, '--trace', accountId], label));
  }
}

/** Puts `staged` in place of the golden folder, or leaves the old folder and throws. */
function publish(staged: string) {
  const parent = join(GOLDEN, '..');
  const retired = mkdtempSync(join(parent, '.golden-old-'));
  const hadGolden = existsSync(GOLDEN);
  if (hadGolden) {
    renameSync(GOLDEN, join(retired, 'golden'));
  }
  try {
    renameSync(staged, GOLDEN);
  } catch (error) {
    if (hadGolden) {
      renameSync(join(retired, 'golden'), GOLDEN);
    }
    throw error;
  } finally {
    rmSync(retired, { recursive: true, force: true });
  }
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
  mkdirSync(join(GOLDEN, '..'), { recursive: true });
  const staged = mkdtempSync(join(GOLDEN, '..', '.golden-new-'));
  try {
    for (const input of inputs) {
      writeCase(staged, input);
    }
    publish(staged);
  } finally {
    rmSync(staged, { recursive: true, force: true });
  }
  process.stderr.write(`Wrote ${String(inputs.length)} golden cases to ${GOLDEN}.\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
