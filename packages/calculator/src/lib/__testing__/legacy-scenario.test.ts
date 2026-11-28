import { describe, expect, it } from 'vite-plus/test';

import type { ContributionRule, RetirementConfig } from './legacy-config';
import { legacyToScenario, runThroughScenario } from './legacy-scenario';

function oneYearConfig(rule: Partial<ContributionRule>): RetirementConfig {
  return {
    currentBalance: 0,
    timeHorizonYears: 1,
    startDate: '2026-01-01T00:00:00.000Z',
    interest: { annualRate: 0 },
    salary: { annualBase: 0 },
    contributions: [
      { id: 'rule', type: 'flat', amount: 1, timing: { frequency: 'monthly' }, ...rule }
    ]
  };
}

describe('legacyToScenario', () => {
  it.each([
    ['a range that starts after the horizon', { yearRange: { start: 2 } }, 0],
    ['a range that ends before the start year', { yearRange: { end: -1 } }, 0],
    ['a fractional range start', { yearRange: { start: 0.5 } }, 0],
    ['a fractional range end', { yearRange: { end: 0.5 } }, 12],
    [
      'a range that starts before the start year with growth',
      {
        amount: 0,
        growth: { type: 'flat', amount: 1, cadence: 'annual' },
        yearRange: { start: -1 }
      },
      0
    ],
    ['an annual rule on 31 April', { timing: { frequency: 'annual', month: 3, day: 31 } }, 1]
  ] satisfies Array<[string, Partial<ContributionRule>, number]>)(
    'reaches the final balance the old engine gave, for %s',
    (_, rule, finalBalance) => {
      expect(runThroughScenario(oneYearConfig(rule)).result.baseline.finalBalance).toBe(
        finalBalance
      );
    }
  );

  it('dates the 31 April rule on the 30th and keeps 29 February', () => {
    const config = oneYearConfig({});
    config.contributions = [
      { id: 'april', type: 'flat', amount: 1, timing: { frequency: 'annual', month: 3, day: 31 } },
      { id: 'leap', type: 'flat', amount: 1, timing: { frequency: 'annual', month: 1, day: 29 } }
    ];
    const rules = legacyToScenario(config).scenario.accounts[0]?.contributions;

    expect(rules?.map((rule) => rule.timing)).toStrictEqual([
      { frequency: 'annual', month: 4, day: 30 },
      { frequency: 'annual', month: 2, day: 29 }
    ]);
  });

  it('leaves out a rule that can never deposit', () => {
    const rules = legacyToScenario(oneYearConfig({ yearRange: { start: 3, end: 2 } })).scenario
      .accounts[0]?.contributions;

    expect(rules).toStrictEqual([]);
  });

  it('throws on a growing rule whose first year is after the start year', () => {
    const config = oneYearConfig({
      growth: { type: 'percent', amount: 2, cadence: 'annual' },
      yearRange: { start: 1 }
    });

    expect(() => legacyToScenario(config)).toThrow(
      new RangeError(
        'Rule "rule" grows from 2026 but cannot deposit before 2027, which the new contract cannot express.'
      )
    );
  });
});
