import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { calculateProjectionWithSteps, calculateRetirement } from '../src/lib/calculator';
import { generateRandomRetirementConfig } from '../src/lib/random';
import type { RetirementConfig } from '../src/lib/types';
import {
  BASELINE_CASES_DIR,
  BASELINE_FULL_DIR,
  isRetirementConfig,
  projectBaseline
} from '../src/lib/__testing__/baseline';
import type { BaselineCase } from '../src/lib/__testing__/baseline';
import { handWrittenConfigs } from './hand-written-configs';

const EXAMPLES_DIR = new URL('../../cli/examples/', import.meta.url);
const GENERATED_SEEDS = 200;

function exampleConfigs(): Array<[string, RetirementConfig]> {
  return readdirSync(EXAMPLES_DIR)
    .filter((file) => file.endsWith('.json'))
    .toSorted()
    .map((file) => {
      const parsed: unknown = JSON.parse(readFileSync(new URL(file, EXAMPLES_DIR), 'utf8'));
      if (!isRetirementConfig(parsed)) {
        throw new Error(`${file} is not a retirement config.`);
      }
      return [`example-${file.replace(/\.json$/, '')}`, parsed];
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

function requireCanonicalNumbers(name: string, value: unknown) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new Error(`${name}: the engine produced ${String(value)}.`);
    }
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) {
      requireCanonicalNumbers(name, item);
    }
  }
}

function writeJson(dir: URL, file: string, value: unknown) {
  writeFileSync(new URL(file, dir), `${JSON.stringify(value, null, 2)}\n`);
}

if (process.versions.bun !== undefined) {
  throw new Error(
    'Run this on Node with `vp run @retirement/calculator#write-baseline`. Bun computes some powers differently from Node, and the baseline test runs on Node.'
  );
}

const examples = exampleConfigs();
const inputs = [...examples, ...generatedConfigs(), ...Object.entries(handWrittenConfigs)];

rmSync(BASELINE_CASES_DIR, { recursive: true, force: true });
rmSync(BASELINE_FULL_DIR, { recursive: true, force: true });
mkdirSync(BASELINE_CASES_DIR, { recursive: true });
mkdirSync(BASELINE_FULL_DIR, { recursive: true });

for (const [name, input] of inputs) {
  requireFirstOfMonth(name, input);
  requireCanonicalNumbers(name, calculateRetirement(input));
  requireCanonicalNumbers(name, calculateProjectionWithSteps(input, input.interest.annualRate));
  const baselineCase: BaselineCase = { name, input, ...projectBaseline(input) };
  writeJson(BASELINE_CASES_DIR, `${name}.json`, baselineCase);
}

for (const [name, input] of examples) {
  writeJson(BASELINE_FULL_DIR, `${name}.result.json`, calculateRetirement(input));
  writeJson(
    BASELINE_FULL_DIR,
    `${name}.steps.json`,
    calculateProjectionWithSteps(input, input.interest.annualRate)
  );
}
