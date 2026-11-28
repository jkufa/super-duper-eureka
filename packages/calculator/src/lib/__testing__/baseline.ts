import { readdirSync, readFileSync } from 'node:fs';

import { calculateProjectionWithSteps, calculateRetirement } from '../calculator';
import type { ProjectionRun } from '../calculator';
import type {
  AnnualProjection,
  Projection,
  ProjectionByVariance,
  RetirementConfig
} from '../types';
import { digest, monthlyStream, stepStream } from './number-streams';
import type { MonthlyStreamBand } from './number-streams';
import { asObject, asString, childPath, parseRetirementConfig } from './parse-config';

export const BASELINE_DIR = new URL('baseline/', import.meta.url);
export const BASELINE_CASES_DIR = new URL('cases/', BASELINE_DIR);
export const BASELINE_FULL_DIR = new URL('full/', BASELINE_DIR);

export interface BaselineOutputs {
  yearly: Record<'baseline' | 'positive' | 'negative', Array<AnnualProjection>>;
  monthlyDigest: string;
  stepsDigest: string;
}

export interface BaselineCase extends BaselineOutputs {
  name: string;
  input: RetirementConfig;
}

export interface StoredCase {
  name: string;
  input: RetirementConfig;
  yearly: unknown;
  monthlyDigest: unknown;
  stepsDigest: unknown;
}

export interface StoredFullExample {
  result: unknown;
  steps: unknown;
}

export interface FullExample {
  result: ProjectionByVariance;
  steps: ProjectionRun;
}

export function runFullExample(input: RetirementConfig): FullExample {
  return {
    result: calculateRetirement(input),
    steps: calculateProjectionWithSteps(input, input.interest.annualRate)
  };
}

function toStreamBand(projection: Projection): MonthlyStreamBand {
  return {
    finalBalance: projection.finalBalance,
    totalContributions: projection.totalContributions,
    totalGrowth: projection.totalGrowth,
    monthly: projection.monthlyProjections
  };
}

export function projectBaseline(input: RetirementConfig): BaselineOutputs {
  return toBaselineOutputs(runFullExample(input));
}

export function toBaselineOutputs({ result, steps }: FullExample): BaselineOutputs {
  const { baseline, positive, negative } = result;

  return {
    yearly: {
      baseline: baseline.yearlyProjections,
      positive: positive.yearlyProjections,
      negative: negative.yearlyProjections
    },
    monthlyDigest: digest(
      monthlyStream({
        baseline: toStreamBand(baseline),
        positive: toStreamBand(positive),
        negative: toStreamBand(negative)
      })
    ),
    stepsDigest: digest(stepStream(steps))
  };
}

function toStoredCase(file: string, value: unknown): StoredCase {
  const stored = asObject(value, file, ['name', 'input', 'yearly', 'monthlyDigest', 'stepsDigest']);
  return {
    name: asString('name' in stored ? stored.name : undefined, childPath(file, 'name')),
    input: parseRetirementConfig(
      'input' in stored ? stored.input : undefined,
      childPath(file, 'input')
    ),
    yearly: 'yearly' in stored ? stored.yearly : undefined,
    monthlyDigest: 'monthlyDigest' in stored ? stored.monthlyDigest : undefined,
    stepsDigest: 'stepsDigest' in stored ? stored.stepsDigest : undefined
  };
}

export function readBaselineCases(): Array<StoredCase> {
  return readdirSync(BASELINE_CASES_DIR)
    .filter((file) => file.endsWith('.json'))
    .toSorted()
    .map((file) => {
      const parsed: unknown = JSON.parse(readFileSync(new URL(file, BASELINE_CASES_DIR), 'utf8'));
      return toStoredCase(file, parsed);
    });
}

export function fullExampleFiles(name: string): Record<keyof FullExample, string> {
  return { result: `${name}.result.json`, steps: `${name}.steps.json` };
}

export function readFullExample(name: string): StoredFullExample {
  const files = fullExampleFiles(name);
  const result: unknown = JSON.parse(
    readFileSync(new URL(files.result, BASELINE_FULL_DIR), 'utf8')
  );
  const steps: unknown = JSON.parse(readFileSync(new URL(files.steps, BASELINE_FULL_DIR), 'utf8'));
  return { result, steps };
}
