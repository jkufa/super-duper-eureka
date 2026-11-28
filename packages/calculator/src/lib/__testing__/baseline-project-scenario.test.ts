import { describe, expect, it } from 'vite-plus/test';

import { parseScenario } from '../parse-scenario';
import { projectScenario } from '../project-scenario';
import { readBaselineCases, readFullExample, toBaselineOutputs } from './baseline';
import { legacyToScenario, runThroughProjectScenario } from './legacy-scenario';

const cases = readBaselineCases();
const examples = cases.filter((stored) => stored.name.startsWith('example-'));

describe('engine baseline through projectScenario', () => {
  it('runs every stored case', () => {
    expect(cases).toHaveLength(235);
  });

  it.each(cases)('$name reproduces the stored outputs', (stored) => {
    const actual = toBaselineOutputs(runThroughProjectScenario(stored.input));

    expect(actual.yearly).toStrictEqual(stored.yearly);
    expect(actual.monthlyDigest).toBe(stored.monthlyDigest);
    expect(actual.stepsDigest).toBe(stored.stepsDigest);
  });

  it.each(examples)('$name reproduces the stored full results', (stored) => {
    const actual = runThroughProjectScenario(stored.input);
    const expected = readFullExample(stored.name);

    expect(actual.result).toStrictEqual(expected.result);
    expect(actual.steps).toStrictEqual(expected.steps);
  });

  it.each(examples)('$name has one fresh account whose series is the total', (stored) => {
    const { scenario: file, today } = legacyToScenario(stored.input);
    const projection = projectScenario(parseScenario(file, { today }));

    expect(projection.staleAccounts).toStrictEqual([]);
    for (const band of Object.values(projection.bands)) {
      const [account, ...others] = band.accounts;
      expect(others).toStrictEqual([]);
      expect(account?.rolledForward).toStrictEqual({ contributions: 0, interest: 0 });
      expect(account?.series).toStrictEqual(band.total);
    }
  });
});
