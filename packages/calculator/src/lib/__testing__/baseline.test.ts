import { describe, expect, it } from 'vite-plus/test';

import { projectBaseline, readBaselineCases, readFullExample, runFullExample } from './baseline';

const cases = readBaselineCases();
const examples = cases.filter((stored) => stored.name.startsWith('example-'));

describe('engine baseline', () => {
  it('holds the examples, the generated configs and the hand-written configs', () => {
    const generated = cases.filter((stored) => stored.name.startsWith('generated-'));

    expect(examples).toHaveLength(4);
    expect(generated).toHaveLength(200);
    expect(cases.length - examples.length - generated.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases)('$name reproduces the stored outputs', (stored) => {
    const actual = projectBaseline(stored.input);

    expect(actual.yearly).toStrictEqual(stored.yearly);
    expect(actual.monthlyDigest).toBe(stored.monthlyDigest);
    expect(actual.stepsDigest).toBe(stored.stepsDigest);
  });

  it.each(examples)('$name reproduces the stored full results', (stored) => {
    const actual = runFullExample(stored.input);
    const expected = readFullExample(stored.name);

    expect(actual.result).toStrictEqual(expected.result);
    expect(actual.steps).toStrictEqual(expected.steps);
  });
});
