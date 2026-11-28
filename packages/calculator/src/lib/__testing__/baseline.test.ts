import { describe, expect, it } from 'vite-plus/test';

import { projectBaseline, readBaselineCases } from './baseline';

const cases = readBaselineCases();

describe('engine baseline', () => {
  it('holds the examples, the generated configs and the hand-written configs', () => {
    const count = (prefix: string) => cases.filter((item) => item.name.startsWith(prefix)).length;

    expect(count('example-')).toBe(4);
    expect(count('generated-')).toBe(200);
    expect(cases.length - count('example-') - count('generated-')).toBeGreaterThanOrEqual(20);
  });

  it.each(cases)('$name reproduces the stored outputs', (stored) => {
    const actual = projectBaseline(stored.input);

    expect(actual.yearly).toStrictEqual(stored.yearly);
    expect(actual.monthlyDigest).toBe(stored.monthlyDigest);
    expect(actual.stepsDigest).toBe(stored.stepsDigest);
  });
});
