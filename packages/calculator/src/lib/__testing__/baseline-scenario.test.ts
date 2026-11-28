import { describe, expect, it } from 'vite-plus/test';

import {
  readBaselineCases,
  readFullExample,
  readFullExampleNames,
  toBaselineOutputs
} from './baseline';
import { runThroughScenario } from './legacy-scenario';

const cases = readBaselineCases();
const examples = cases.filter((stored) => stored.name.startsWith('example-'));

describe('engine baseline through a scenario', () => {
  it('runs every stored case', () => {
    expect(cases).toHaveLength(235);
  });

  it('has 4 examples with full outputs, 200 generated, 4 raw and 27 hand-written cases', () => {
    const count = (prefix: string) => cases.filter(({ name }) => name.startsWith(prefix)).length;

    expect(readFullExampleNames()).toStrictEqual([
      'example-basic',
      'example-custom-growth',
      'example-daily-debug',
      'example-one-time'
    ]);
    expect(examples.map(({ name }) => name)).toStrictEqual(readFullExampleNames());
    expect([count('generated-'), count('raw-')]).toStrictEqual([200, 4]);
    expect(cases.length - examples.length - count('generated-') - count('raw-')).toBe(27);
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
