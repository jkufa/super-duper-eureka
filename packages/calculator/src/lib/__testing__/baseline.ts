import { readdirSync, readFileSync } from 'node:fs';

import { calculateProjectionWithSteps, calculateRetirement } from '../calculator';
import type { AnnualProjection, RetirementConfig } from '../types';
import { digest, monthlyStream, stepStream } from './number-streams';

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

export function projectBaseline(input: RetirementConfig): BaselineOutputs {
  const { baseline, positive, negative } = calculateRetirement(input);
  const { steps } = calculateProjectionWithSteps(input, input.interest.annualRate, {
    includeContributionDetails: false
  });

  return {
    yearly: {
      baseline: baseline.yearlyProjections,
      positive: positive.yearlyProjections,
      negative: negative.yearlyProjections
    },
    monthlyDigest: digest(
      monthlyStream({
        baseline: baseline.monthlyProjections,
        positive: positive.monthlyProjections,
        negative: negative.monthlyProjections
      })
    ),
    stepsDigest: digest(stepStream(steps))
  };
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function isRetirementConfig(value: unknown): value is RetirementConfig {
  return (
    isObject(value) &&
    'currentBalance' in value &&
    typeof value.currentBalance === 'number' &&
    'timeHorizonYears' in value &&
    typeof value.timeHorizonYears === 'number' &&
    'startDate' in value &&
    typeof value.startDate === 'string' &&
    'interest' in value &&
    isObject(value.interest) &&
    'annualRate' in value.interest &&
    typeof value.interest.annualRate === 'number' &&
    'salary' in value &&
    isObject(value.salary) &&
    'annualBase' in value.salary &&
    typeof value.salary.annualBase === 'number' &&
    'contributions' in value &&
    Array.isArray(value.contributions)
  );
}

function isBaselineCase(value: unknown): value is BaselineCase {
  return (
    isObject(value) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'input' in value &&
    isRetirementConfig(value.input) &&
    'yearly' in value &&
    isObject(value.yearly) &&
    'baseline' in value.yearly &&
    Array.isArray(value.yearly.baseline) &&
    'positive' in value.yearly &&
    Array.isArray(value.yearly.positive) &&
    'negative' in value.yearly &&
    Array.isArray(value.yearly.negative) &&
    'monthlyDigest' in value &&
    typeof value.monthlyDigest === 'string' &&
    'stepsDigest' in value &&
    typeof value.stepsDigest === 'string'
  );
}

export function readBaselineCases(): Array<BaselineCase> {
  return readdirSync(BASELINE_CASES_DIR)
    .filter((file) => file.endsWith('.json'))
    .toSorted()
    .map((file) => {
      const parsed: unknown = JSON.parse(readFileSync(new URL(file, BASELINE_CASES_DIR), 'utf8'));
      if (!isBaselineCase(parsed)) {
        throw new Error(`${file} is not a baseline case.`);
      }
      return parsed;
    });
}
