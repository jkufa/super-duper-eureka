import { describe, expect, it } from 'vite-plus/test';

import { parseScenario } from '../parse-scenario';
import { projectAccount, traceAccountRange } from '../project-account';
import type { Compounding } from '../scenario';

const DOUBLING_MONTHLY_RATE = 4095;

function scenarioFor(compounding: Compounding) {
  const scenario = parseScenario(
    {
      version: 1,
      endDate: '2028-01-01',
      interest: { annualRate: 0, compounding },
      salary: { annualBase: 0, asOf: '2026-11-01' },
      accounts: [
        {
          id: 'account',
          name: 'Account',
          kind: 'taxable',
          included: true,
          balance: 1000,
          balanceAsOf: '2026-11-01',
          contributions: [
            {
              id: 'early',
              type: 'flat',
              amount: 100,
              timing: { frequency: 'monthly', day: 3 }
            },
            {
              id: 'late',
              type: 'flat',
              amount: 10,
              timing: { frequency: 'monthly', day: 20 }
            }
          ]
        }
      ]
    },
    { today: '2026-11-01' }
  );
  const [account] = scenario.accounts;
  if (!account) {
    throw new Error('The fixture has no account.');
  }
  return { scenario, account };
}

describe('projectAccount', () => {
  it('compounds each month and keeps one yearly row per calendar year', () => {
    const { scenario, account } = scenarioFor('monthly');
    const series = projectAccount(
      scenario,
      account,
      { year: 2026, month: 11, day: 1 },
      { year: 2027, month: 2, day: 1 },
      DOUBLING_MONTHLY_RATE
    );

    expect(series).toStrictEqual({
      startBalance: 1000,
      finalBalance: 9470,
      totalContributions: 330,
      totalInterest: 8140,
      monthly: [
        { year: 2026, month: 11, balance: 2210, contributions: 110, interest: 1100 },
        { year: 2026, month: 12, balance: 4630, contributions: 220, interest: 3410 },
        { year: 2027, month: 1, balance: 9470, contributions: 330, interest: 8140 }
      ],
      yearly: [
        { year: 2026, balance: 4630, contributions: 220, interest: 3410 },
        { year: 2027, balance: 9470, contributions: 330, interest: 8140 }
      ]
    });
  });

  it.each([
    ['from', { year: 2026, month: 11, day: 2 }, { year: 2027, month: 1, day: 1 }],
    ['to', { year: 2026, month: 11, day: 1 }, { year: 2027, month: 1, day: 31 }]
  ])('rejects a %s date that is not the 1st of a month', (name, from, to) => {
    const { scenario, account } = scenarioFor('monthly');

    expect(() => projectAccount(scenario, account, from, to, 0)).toThrow(
      new RangeError(
        `${name} must be the 1st of a month until day-accurate ranges land (received ${name === 'from' ? '2026-11-02' : '2027-01-31'}).`
      )
    );
    expect(() => traceAccountRange(scenario, account, from, to, 0)).toThrow(RangeError);
  });
});

describe('traceAccountRange', () => {
  it('records each month with its deposits in schedule order', () => {
    const { scenario, account } = scenarioFor('daily');
    const trace = traceAccountRange(
      scenario,
      account,
      { year: 2026, month: 11, day: 1 },
      { year: 2026, month: 12, day: 1 },
      0.05
    );
    const series = projectAccount(
      scenario,
      account,
      { year: 2026, month: 11, day: 1 },
      { year: 2026, month: 12, day: 1 },
      0.05
    );

    expect(trace).toStrictEqual([
      {
        from: '2026-11-01',
        to: '2026-12-01',
        days: 30,
        daysInMonth: 30,
        daysInYear: 365,
        balanceStart: 1000,
        balanceEnd: series.finalBalance,
        contributions: 110,
        interest: series.totalInterest,
        annualRate: 0.05,
        deposits: [
          { ruleId: 'early', date: '2026-11-03', amount: 100, bucket: 3 },
          { ruleId: 'late', date: '2026-11-20', amount: 10, bucket: 20 }
        ]
      }
    ]);
  });
});
