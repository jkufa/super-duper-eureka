import { describe, expect, it } from 'vite-plus/test';

import { parseScenario, ScenarioError } from '../parse-scenario';
import type { PlainDate } from '../plain-date';
import { projectAccount, traceAccountRange } from '../project-account';
import type { Compounding, ContributionRuleFile } from '../scenario';

const DOUBLING_MONTHLY_RATE = 4095;
const DOUBLING_DAILY_RATE = 2 ** 365 - 1;
const NOVEMBER: PlainDate = { year: 2026, month: 11, day: 1 };
const DECEMBER: PlainDate = { year: 2026, month: 12, day: 1 };
const FEBRUARY: PlainDate = { year: 2027, month: 2, day: 1 };

const EARLY_AND_LATE: Array<ContributionRuleFile> = [
  { id: 'early', type: 'flat', amount: 100, timing: { frequency: 'monthly', day: 3 } },
  { id: 'late', type: 'flat', amount: 10, timing: { frequency: 'monthly', day: 20 } }
];

function scenarioFor(compounding: Compounding, contributions = EARLY_AND_LATE) {
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
          contributions
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

function scenarioErrorFrom(run: () => void): ScenarioError {
  try {
    run();
  } catch (error) {
    if (error instanceof ScenarioError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a ScenarioError.');
}

describe('projectAccount', () => {
  it('compounds each month from the opening balance it is given and keeps one yearly row per calendar year', () => {
    const { scenario, account } = scenarioFor('monthly');
    const series = projectAccount(
      scenario,
      account,
      NOVEMBER,
      FEBRUARY,
      2000,
      DOUBLING_MONTHLY_RATE
    );

    expect(series).toStrictEqual({
      startBalance: 2000,
      finalBalance: 17_470,
      totalContributions: 330,
      totalInterest: 15_140,
      monthly: [
        { year: 2026, month: 11, balance: 4210, contributions: 110, interest: 2100 },
        { year: 2026, month: 12, balance: 8630, contributions: 220, interest: 6410 },
        { year: 2027, month: 1, balance: 17_470, contributions: 330, interest: 15_140 }
      ],
      yearly: [
        { year: 2026, balance: 8630, contributions: 220, interest: 6410 },
        { year: 2027, balance: 17_470, contributions: 330, interest: 15_140 }
      ]
    });
  });

  it.each([
    ['on', DECEMBER, DECEMBER],
    ['after', FEBRUARY, DECEMBER]
  ])('returns the opening balance and no rows when from is %s to', (_, from, to) => {
    const { scenario, account } = scenarioFor('daily');

    expect(projectAccount(scenario, account, from, to, 500, 0.05)).toStrictEqual({
      startBalance: 500,
      finalBalance: 500,
      totalContributions: 0,
      totalInterest: 0,
      monthly: [],
      yearly: []
    });
    expect(traceAccountRange(scenario, account, from, to, 500, 0.05)).toStrictEqual([]);
  });

  it.each([
    ['from', { year: 2026, month: 11, day: 2 }, { year: 2027, month: 1, day: 1 }, '2026-11-02'],
    ['to', { year: 2026, month: 11, day: 1 }, { year: 2027, month: 1, day: 31 }, '2027-01-31']
  ])('rejects a %s date that is not the 1st of a month', (name, from, to, received) => {
    const { scenario, account } = scenarioFor('monthly');
    const expected = new RangeError(
      `${name} must be the 1st of a month until day-accurate ranges land (received ${received}).`
    );

    expect(() => projectAccount(scenario, account, from, to, 0, 0)).toThrow(expected);
    expect(() => traceAccountRange(scenario, account, from, to, 0, 0)).toThrow(expected);
  });

  it.each([
    [
      'a deposit that overflows the balance',
      [{ id: 'huge', type: 'flat', amount: 1e308, timing: { frequency: 'monthly' } }],
      1e308,
      0,
      'not_finite: the balance after 2026-11-01 is NaN.'
    ],
    [
      'a rate that overflows the balance',
      [],
      1e300,
      1e300,
      'not_finite: the balance after 2026-11-01 is Infinity.'
    ]
  ] satisfies Array<[string, Array<ContributionRuleFile>, number, number, string]>)(
    'throws not_finite with the account id for %s, from both entry points',
    (_, contributions, openingBalance, rate, message) => {
      const { scenario, account } = scenarioFor('monthly', contributions);
      const projected = scenarioErrorFrom(() =>
        projectAccount(scenario, account, NOVEMBER, FEBRUARY, openingBalance, rate)
      );
      const traced = scenarioErrorFrom(() =>
        traceAccountRange(scenario, account, NOVEMBER, FEBRUARY, openingBalance, rate)
      );

      expect([projected.code, projected.accountId, projected.message]).toStrictEqual([
        'not_finite',
        'account',
        message
      ]);
      expect([traced.code, traced.accountId, traced.message]).toStrictEqual([
        projected.code,
        projected.accountId,
        projected.message
      ]);
    }
  );
});

describe('traceAccountRange', () => {
  it('records each month with its deposits in schedule order', () => {
    const { scenario, account } = scenarioFor('daily');
    const trace = traceAccountRange(
      scenario,
      account,
      NOVEMBER,
      DECEMBER,
      1000,
      DOUBLING_DAILY_RATE
    );
    const finalBalance = 1000 * 2 ** 30 + 100 * 2 ** 28 + 10 * 2 ** 11;

    expect(finalBalance).toBe(1_100_585_390_080);
    expect(trace).toStrictEqual([
      {
        from: '2026-11-01',
        to: '2026-12-01',
        days: 30,
        daysInMonth: 30,
        daysInYear: 365,
        balanceStart: 1000,
        balanceEnd: 1_100_585_390_080,
        contributions: 110,
        interest: 1_100_585_388_970,
        annualRate: DOUBLING_DAILY_RATE,
        deposits: [
          { ruleId: 'early', date: '2026-11-03', amount: 100, bucket: 3 },
          { ruleId: 'late', date: '2026-11-20', amount: 10, bucket: 20 }
        ]
      }
    ]);
  });
});
