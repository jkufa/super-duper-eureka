import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

import { generateRandomRetirementConfig } from '../src/lib/random';
import type { RetirementConfig } from '../src/lib/types';
import {
  BASELINE_DIR,
  fullExampleFiles,
  projectBaseline,
  runFullExample
} from '../src/lib/__testing__/baseline';
import type { BaselineCase } from '../src/lib/__testing__/baseline';
import { parseRetirementConfig } from '../src/lib/__testing__/parse-config';
import { handWrittenConfigs } from './hand-written-configs';

const EXAMPLES_DIR = new URL('../../cli/examples/', import.meta.url);
const GENERATED_SEEDS = 200;

function exampleConfigs(): Array<[string, RetirementConfig]> {
  return readdirSync(EXAMPLES_DIR)
    .filter((file) => file.endsWith('.json'))
    .toSorted()
    .map((file) => {
      const parsed: unknown = JSON.parse(readFileSync(new URL(file, EXAMPLES_DIR), 'utf8'));
      return [`example-${file.replace(/\.json$/, '')}`, parseRetirementConfig(parsed)];
    });
}

function generatedConfigs(): Array<[string, RetirementConfig]> {
  return Array.from({ length: GENERATED_SEEDS }, (_, index): [string, RetirementConfig] => {
    const seed = index + 1;
    const month = String((index % 12) + 1).padStart(2, '0');
    return [
      `generated-${String(seed).padStart(3, '0')}`,
      {
        ...generateRandomRetirementConfig(seed),
        startDate: `2026-${month}-01T00:00:00.000Z`
      }
    ];
  });
}

function requireFirstOfMonth(name: string, config: RetirementConfig) {
  if (
    typeof config.startDate !== 'string' ||
    !/^\d{4}-\d{2}-01T00:00:00\.000Z$/.test(config.startDate)
  ) {
    throw new Error(
      `${name}: startDate must be an ISO string on the 1st of a month at UTC midnight.`
    );
  }
}

function toExactJson(name: string, value: unknown): string {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!isDeepStrictEqual(JSON.parse(text), value)) {
    throw new Error(`${name} does not survive a JSON round trip unchanged.`);
  }
  return text;
}

function toStoredInput(config: RetirementConfig): RetirementConfig {
  const text = JSON.stringify(config);
  const json: unknown = JSON.parse(text);
  return parseRetirementConfig(json);
}

if (process.versions.bun !== undefined) {
  throw new Error(
    'Run this on Node with `vp run @retirement/calculator#write-baseline`. Bun computes some powers differently from Node, and the baseline test runs on Node.'
  );
}

const examples = exampleConfigs();
const inputs = [...examples, ...generatedConfigs(), ...Object.entries(handWrittenConfigs)];

const files = new Map<string, string>();
for (const [name, config] of inputs) {
  const input = toStoredInput(config);
  requireFirstOfMonth(name, input);
  const baselineCase: BaselineCase = { name, input, ...projectBaseline(input) };
  files.set(`cases/${name}.json`, toExactJson(name, baselineCase));
}
for (const [name, input] of examples) {
  const full = runFullExample(input);
  const fullFiles = fullExampleFiles(name);
  files.set(`full/${fullFiles.result}`, toExactJson(fullFiles.result, full.result));
  files.set(`full/${fullFiles.steps}`, toExactJson(fullFiles.steps, full.steps));
}

const staging = new URL('../baseline.next/', BASELINE_DIR);
const previous = new URL('../baseline.old/', BASELINE_DIR);

if (!existsSync(BASELINE_DIR) && existsSync(previous)) {
  renameSync(previous, BASELINE_DIR);
}
rmSync(staging, { recursive: true, force: true });
mkdirSync(new URL('cases/', staging), { recursive: true });
mkdirSync(new URL('full/', staging), { recursive: true });
for (const [path, text] of files) {
  writeFileSync(new URL(path, staging), text);
}

if (existsSync(BASELINE_DIR)) {
  rmSync(previous, { recursive: true, force: true });
  renameSync(BASELINE_DIR, previous);
}
try {
  renameSync(staging, BASELINE_DIR);
} catch (error) {
  if (existsSync(previous)) {
    renameSync(previous, BASELINE_DIR);
  }
  throw error;
}
rmSync(previous, { recursive: true, force: true });
