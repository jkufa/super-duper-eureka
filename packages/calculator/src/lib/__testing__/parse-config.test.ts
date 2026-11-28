import { describe, expect, it } from 'vite-plus/test';

import { parseRetirementConfig } from './parse-config';

function config() {
  const contributions: Array<unknown> = [
    { id: 'monthly', type: 'flat', amount: 10, timing: { frequency: 'monthly', day: 3 } },
    {
      id: 'annual',
      type: 'salaryPercent',
      amount: 5,
      salaryBasis: 'annual',
      timing: { frequency: 'annual', month: 2, placement: 'end' },
      yearRange: { start: 1 }
    },
    {
      id: 'once',
      type: 'flat',
      amount: 100,
      timing: { frequency: 'oneTime', on: { year: 1, month: 6, day: 9 } }
    }
  ];
  return {
    currentBalance: 1000,
    timeHorizonYears: 2,
    startDate: '2026-01-01T00:00:00.000Z',
    interest: { annualRate: 0.05, variance: 0.01, compounding: 'monthly' },
    salary: { annualBase: 50_000, annualRaiseRate: 0.02 },
    contributions
  };
}

describe('parseRetirementConfig', () => {
  it('reads a valid config back unchanged', () => {
    expect(parseRetirementConfig(config())).toStrictEqual(config());
  });

  it('rejects an unknown top-level key', () => {
    expect(() => parseRetirementConfig({ ...config(), horizon: 3 })).toThrow(
      'horizon: unknown key.'
    );
  });

  it('rejects an unknown nested key', () => {
    const input = { ...config(), salary: { annualBase: 50_000, annualRaiseRtae: 0.02 } };

    expect(() => parseRetirementConfig(input)).toThrow('salary.annualRaiseRtae: unknown key.');
  });

  it('rejects a key that belongs to another timing variant', () => {
    const input = config();
    input.contributions[2] = {
      id: 'once',
      type: 'flat',
      amount: 100,
      timing: { frequency: 'oneTime', on: { year: 1, month: 6 }, placement: 'end' }
    };

    expect(() => parseRetirementConfig(input)).toThrow(
      'contributions[2].timing.placement: unknown key.'
    );
  });

  it('rejects a number that is not finite', () => {
    const input = { ...config(), currentBalance: Number.POSITIVE_INFINITY };

    expect(() => parseRetirementConfig(input)).toThrow('currentBalance: expected a finite number.');
  });

  it('names the full path of a bad deep field', () => {
    const input = config();
    input.contributions[2] = {
      id: 'once',
      type: 'flat',
      amount: 100,
      timing: { frequency: 'oneTime', on: { year: 1, month: 6, day: 'ninth' } }
    };

    expect(() => parseRetirementConfig(input)).toThrow(
      'contributions[2].timing.on.day: expected a finite number.'
    );
  });
});
