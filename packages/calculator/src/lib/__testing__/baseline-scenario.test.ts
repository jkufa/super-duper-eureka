import { describe, expect, it } from 'vite-plus/test';

import { parseScenario } from '../parse-scenario';
import { parsePlainDate } from '../plain-date';
import { projectAccount, traceAccountRange } from '../project-account';
import type { RetirementConfig } from '../types';
import { readBaselineCases, readFullExample, toBaselineOutputs } from './baseline';
import type { FullExample } from './baseline';
import { legacyToScenario, toLegacyRows } from './legacy-scenario';

const cases = readBaselineCases();
const examples = cases.filter((stored) => stored.name.startsWith('example-'));

function runThroughScenario(input: RetirementConfig): FullExample {
  const { scenario: file, today } = legacyToScenario(input);
  const scenario = parseScenario(file, { today });
  const [account] = scenario.accounts;
  const from = parsePlainDate(today);
  if (!account || !from) {
    throw new Error('The adapter produced no account or no start date.');
  }
  const to = scenario.endDate;
  const { annualRate, variance } = scenario.interest;
  const project = (rate: number) => projectAccount(scenario, account, from, to, rate);

  const baseline = project(annualRate);
  const bands =
    variance === 0
      ? { baseline, positive: baseline, negative: baseline }
      : {
          baseline,
          positive: project(annualRate + variance),
          negative: project(annualRate - variance)
        };
  const trace = traceAccountRange(scenario, account, from, to, annualRate);
  return toLegacyRows(input, scenario, bands, trace);
}

describe('engine baseline through a scenario', () => {
  it('runs every stored case', () => {
    expect(cases).toHaveLength(235);
  });

  it.each(cases)('$name reproduces the stored outputs', (stored) => {
    const actual = toBaselineOutputs(runThroughScenario(stored.input));

    expect(actual.yearly).toStrictEqual(stored.yearly);
    expect(actual.monthlyDigest).toBe(stored.monthlyDigest);
    expect(actual.stepsDigest).toBe(stored.stepsDigest);
  });

  it.each(examples)('$name reproduces the stored full results', (stored) => {
    const actual = runThroughScenario(stored.input);
    const expected = readFullExample(stored.name);

    expect(actual.result).toStrictEqual(expected.result);
    expect(actual.steps).toStrictEqual(expected.steps);
  });
});
