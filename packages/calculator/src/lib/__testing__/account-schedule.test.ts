import { describe, expect, it } from 'vite-plus/test';

import { buildAccountSchedule, salaryInYear } from '../account-schedule';
import { parseScenario, ScenarioError } from '../parse-scenario';
import { formatPlainDate, parsePlainDate } from '../plain-date';
import type { PlainDate } from '../plain-date';
import { projectAccount } from '../project-account';
import { projectScenario } from '../project-scenario';
import type { Compounding, ContributionRuleFile, Scenario, ScenarioFile } from '../scenario';

const TODAY = '2026-01-01';

interface Setup {
  rules: Array<ContributionRuleFile>;
  compounding?: Compounding;
  salary?: ScenarioFile['salary'];
}

function scenarioWith({ rules, compounding = 'monthly', salary }: Setup): Scenario {
  return parseScenario(
    {
      version: 1,
      endDate: '2031-01-01',
      interest: { annualRate: 0, compounding },
      salary: salary ?? { annualBase: 0, asOf: TODAY },
      accounts: [
        {
          id: 'account',
          name: 'Account',
          kind: 'other',
          included: true,
          balance: 0,
          balanceAsOf: TODAY,
          contributions: rules
        }
      ]
    },
    { today: TODAY }
  );
}

function date(text: string): PlainDate {
  const parsed = parsePlainDate(text);
  if (!parsed) {
    throw new Error(`Bad fixture date ${text}.`);
  }
  return parsed;
}

function deposits(setup: Setup, from: string, to: string) {
  const scenario = scenarioWith(setup);
  const [account] = scenario.accounts;
  if (!account) {
    throw new Error('The fixture has no account.');
  }
  return buildAccountSchedule(scenario, account, date(from), date(to)).flatMap((month) =>
    month.deposits.map((deposit) => ({
      ruleId: deposit.ruleId,
      date: formatPlainDate(deposit.date),
      amount: deposit.amount,
      bucket: deposit.bucket
    }))
  );
}

function flat(
  id: string,
  timing: ContributionRuleFile['timing'],
  extra: Partial<ContributionRuleFile> = {}
): ContributionRuleFile {
  return { id, type: 'flat', amount: 100, timing, ...extra };
}

function percentOfSalary(id: string, extra: Partial<ContributionRuleFile>): ContributionRuleFile {
  return {
    id,
    type: 'salaryPercent',
    amount: 50,
    timing: { frequency: 'annual', month: 1 },
    ...extra
  };
}

describe('buildAccountSchedule', () => {
  it('lists the months of the range with their calendar facts', () => {
    const scenario = scenarioWith({ rules: [] });
    const [account] = scenario.accounts;
    if (!account) {
      throw new Error('The fixture has no account.');
    }
    const months = buildAccountSchedule(scenario, account, date('2027-12-01'), date('2028-03-01'));

    expect(months).toStrictEqual([
      {
        from: date('2027-12-01'),
        to: date('2028-01-01'),
        firstDay: 1,
        days: 31,
        daysInMonth: 31,
        daysInYear: 365,
        deposits: []
      },
      {
        from: date('2028-01-01'),
        to: date('2028-02-01'),
        firstDay: 1,
        days: 31,
        daysInMonth: 31,
        daysInYear: 366,
        deposits: []
      },
      {
        from: date('2028-02-01'),
        to: date('2028-03-01'),
        firstDay: 1,
        days: 29,
        daysInMonth: 29,
        daysInYear: 366,
        deposits: []
      }
    ]);
  });

  it('cuts the first and last months to the days of the range', () => {
    const scenario = scenarioWith({ rules: [] });
    const [account] = scenario.accounts;
    if (!account) {
      throw new Error('The fixture has no account.');
    }
    const months = buildAccountSchedule(scenario, account, date('2027-12-27'), date('2028-02-10'));

    expect(months).toStrictEqual([
      {
        from: date('2027-12-27'),
        to: date('2028-01-01'),
        firstDay: 27,
        days: 5,
        daysInMonth: 31,
        daysInYear: 365,
        deposits: []
      },
      {
        from: date('2028-01-01'),
        to: date('2028-02-01'),
        firstDay: 1,
        days: 31,
        daysInMonth: 31,
        daysInYear: 366,
        deposits: []
      },
      {
        from: date('2028-02-01'),
        to: date('2028-02-10'),
        firstDay: 1,
        days: 9,
        daysInMonth: 29,
        daysInYear: 366,
        deposits: []
      }
    ]);
  });

  it('keeps each date while two days share the start bucket in monthly mode', () => {
    const rules = [
      flat('second', { frequency: 'monthly', day: 2 }),
      flat('sixteenth', { frequency: 'monthly', day: 16 }),
      flat('seventeenth', { frequency: 'monthly', day: 17 })
    ];

    expect(deposits({ rules }, '2026-01-01', '2026-02-01')).toStrictEqual([
      { ruleId: 'second', date: '2026-01-02', amount: 100, bucket: 'start' },
      { ruleId: 'sixteenth', date: '2026-01-16', amount: 100, bucket: 'start' },
      { ruleId: 'seventeenth', date: '2026-01-17', amount: 100, bucket: 'end' }
    ]);
  });

  it('keeps a placement-only rule in its bucket in daily mode and dates it on day 1 or the last day', () => {
    const rules = [
      flat('placed-end', { frequency: 'monthly', placement: 'end' }),
      flat('placed-start', { frequency: 'monthly', placement: 'start' }),
      flat('unplaced', { frequency: 'monthly' })
    ];

    expect(deposits({ rules, compounding: 'daily' }, '2026-04-01', '2026-05-01')).toStrictEqual([
      { ruleId: 'placed-end', date: '2026-04-30', amount: 100, bucket: 'end' },
      { ruleId: 'placed-start', date: '2026-04-01', amount: 100, bucket: 'start' },
      { ruleId: 'unplaced', date: '2026-04-01', amount: 100, bucket: 'start' }
    ]);
  });

  it.each([
    ['daily', [30, 29, 28]],
    ['monthly', ['end', 'end', 'end']]
  ] as const)(
    'clamps a day-31 rule to a 30-day month and to February in %s mode',
    (compounding, buckets) => {
      const rules = [flat('day-31', { frequency: 'monthly', day: 31 })];
      const april = deposits({ rules, compounding }, '2026-04-01', '2026-05-01');
      const leapFebruary = deposits({ rules, compounding }, '2028-02-01', '2028-03-01');
      const february = deposits({ rules, compounding }, '2027-02-01', '2027-03-01');

      expect([...april, ...leapFebruary, ...february]).toStrictEqual([
        { ruleId: 'day-31', date: '2026-04-30', amount: 100, bucket: buckets[0] },
        { ruleId: 'day-31', date: '2028-02-29', amount: 100, bucket: buckets[1] },
        { ruleId: 'day-31', date: '2027-02-28', amount: 100, bucket: buckets[2] }
      ]);
    }
  );

  it('dates an annual rule on 29 February on the 28th in other years', () => {
    const rules = [flat('leap-day', { frequency: 'annual', month: 2, day: 29 })];

    expect(deposits({ rules, compounding: 'daily' }, '2027-01-01', '2029-01-01')).toStrictEqual([
      { ruleId: 'leap-day', date: '2027-02-28', amount: 100, bucket: 28 },
      { ruleId: 'leap-day', date: '2028-02-29', amount: 100, bucket: 29 }
    ]);
  });

  it.each([
    ['monthly', 'start'],
    ['daily', 28]
  ] as const)('keeps the date of a late one-time deposit in %s mode', (compounding, bucket) => {
    const rules = [flat('late', { frequency: 'oneTime', on: '2026-03-28' })];

    expect(deposits({ rules, compounding }, '2026-01-01', '2027-01-01')).toStrictEqual([
      { ruleId: 'late', date: '2026-03-28', amount: 100, bucket }
    ]);
  });

  it('deposits on the start date and the end date of a rule, and not outside them', () => {
    const rules = [
      flat(
        'inclusive',
        { frequency: 'monthly', day: 15 },
        {
          startDate: '2026-02-15',
          endDate: '2026-04-15'
        }
      ),
      flat(
        'exclusive',
        { frequency: 'monthly', day: 15 },
        {
          startDate: '2026-02-16',
          endDate: '2026-04-14'
        }
      )
    ];

    expect(deposits({ rules }, '2026-01-01', '2026-06-01')).toStrictEqual([
      { ruleId: 'inclusive', date: '2026-02-15', amount: 100, bucket: 'end' },
      { ruleId: 'inclusive', date: '2026-03-15', amount: 100, bucket: 'start' },
      { ruleId: 'exclusive', date: '2026-03-15', amount: 100, bucket: 'start' },
      { ruleId: 'inclusive', date: '2026-04-15', amount: 100, bucket: 'start' }
    ]);
  });

  it('counts annual growth in whole years from the rule start, not from the range start', () => {
    const growth = { type: 'percent', amount: 50, cadence: 'annual' } as const;
    const rules = [
      flat(
        'day-before',
        { frequency: 'annual', month: 3, day: 14 },
        {
          growth,
          startDate: '2026-03-15'
        }
      ),
      flat(
        'anniversary',
        { frequency: 'annual', month: 3, day: 15 },
        {
          growth,
          startDate: '2026-03-15'
        }
      )
    ];

    expect(deposits({ rules }, '2027-01-01', '2029-01-01')).toStrictEqual([
      { ruleId: 'day-before', date: '2027-03-14', amount: 100, bucket: 'start' },
      { ruleId: 'anniversary', date: '2027-03-15', amount: 150, bucket: 'start' },
      { ruleId: 'day-before', date: '2028-03-14', amount: 150, bucket: 'start' },
      { ruleId: 'anniversary', date: '2028-03-15', amount: 225, bucket: 'start' }
    ]);
  });

  it('counts monthly growth in whole months, with the 31st reaching shorter months on their last day', () => {
    const rules = [
      flat(
        'day-before',
        { frequency: 'monthly', day: 14 },
        {
          growth: { type: 'flat', amount: 10, cadence: 'monthly' },
          startDate: '2026-03-15'
        }
      ),
      flat(
        'month-end',
        { frequency: 'monthly', day: 31 },
        {
          growth: { type: 'flat', amount: 1, cadence: 'monthly' },
          startDate: '2026-01-31'
        }
      )
    ];

    expect(deposits({ rules }, '2026-01-01', '2026-06-01')).toStrictEqual([
      { ruleId: 'month-end', date: '2026-01-31', amount: 100, bucket: 'end' },
      { ruleId: 'month-end', date: '2026-02-28', amount: 101, bucket: 'end' },
      { ruleId: 'month-end', date: '2026-03-31', amount: 102, bucket: 'end' },
      { ruleId: 'day-before', date: '2026-04-14', amount: 100, bucket: 'start' },
      { ruleId: 'month-end', date: '2026-04-30', amount: 103, bucket: 'end' },
      { ruleId: 'day-before', date: '2026-05-14', amount: 110, bucket: 'start' },
      { ruleId: 'month-end', date: '2026-05-31', amount: 104, bucket: 'end' }
    ]);
  });

  it('raises salary on each 1 January after salary.asOf, not on its anniversary', () => {
    const salary = { annualBase: 100_000, annualRaiseRate: 0.5, asOf: '2026-07-01' };
    const rules: Array<ContributionRuleFile> = [
      { id: 'match', type: 'salaryPercent', amount: 50, timing: { frequency: 'annual', month: 3 } }
    ];
    const scenario = scenarioWith({ rules, salary });

    expect([2026, 2027, 2028].map((year) => salaryInYear(scenario, year))).toStrictEqual([
      100_000, 150_000, 225_000
    ]);
    expect(deposits({ rules, salary }, '2026-01-01', '2029-01-01')).toStrictEqual([
      { ruleId: 'match', date: '2026-03-01', amount: 50_000, bucket: 'start' },
      { ruleId: 'match', date: '2027-03-01', amount: 75_000, bucket: 'start' },
      { ruleId: 'match', date: '2028-03-01', amount: 112_500, bucket: 'start' }
    ]);
  });

  it('divides salary by the basis, and per contribution by 12 on a monthly rule and 1 on an annual one', () => {
    const salary = { annualBase: 52_000 * 365, asOf: TODAY };
    const rules = [
      percentOfSalary('weekly', { salaryBasis: 'weekly' }),
      percentOfSalary('daily', { salaryBasis: 'daily' }),
      percentOfSalary('per-annual', { salaryBasis: 'perContribution' }),
      percentOfSalary('per-monthly', {
        salaryBasis: 'perContribution',
        timing: { frequency: 'monthly' }
      })
    ];

    expect(deposits({ rules, salary }, '2026-01-01', '2026-02-01')).toStrictEqual([
      { ruleId: 'weekly', date: '2026-01-01', amount: 182_500, bucket: 'start' },
      { ruleId: 'daily', date: '2026-01-01', amount: 26_000, bucket: 'start' },
      { ruleId: 'per-annual', date: '2026-01-01', amount: 9_490_000, bucket: 'start' },
      { ruleId: 'per-monthly', date: '2026-01-01', amount: 9_490_000 / 12, bucket: 'start' }
    ]);
  });

  it('applies raises on both sides of salary.asOf', () => {
    const salary = { annualBase: 100_000, annualRaiseRate: 1, asOf: '2027-07-01' };
    const rules: Array<ContributionRuleFile> = [
      { id: 'match', type: 'salaryPercent', amount: 50, timing: { frequency: 'annual', month: 3 } }
    ];
    const scenario = scenarioWith({ rules, salary });

    expect([2026, 2027, 2028].map((year) => salaryInYear(scenario, year))).toStrictEqual([
      50_000, 100_000, 200_000
    ]);
    expect(deposits({ rules, salary }, '2026-01-01', '2029-01-01')).toStrictEqual([
      { ruleId: 'match', date: '2026-03-01', amount: 25_000, bucket: 'start' },
      { ruleId: 'match', date: '2027-03-01', amount: 50_000, bucket: 'start' },
      { ruleId: 'match', date: '2028-03-01', amount: 100_000, bucket: 'start' }
    ]);
  });

  it('divides by the basis before applying the percentage', () => {
    const salary = { annualBase: 100, asOf: TODAY };
    const rules: Array<ContributionRuleFile> = [
      percentOfSalary('monthly', { amount: 7, salaryBasis: 'monthly' })
    ];
    const [deposit] = deposits({ rules, salary }, '2026-01-01', '2026-02-01');

    expect(deposit?.amount).toBe(0.5833333333333335);
  });

  it('keeps a deposit on the range start and leaves out one on the range end', () => {
    const rules = [
      flat('before', { frequency: 'monthly', day: 14 }),
      flat('on-start', { frequency: 'monthly', day: 15 }),
      flat('inside', { frequency: 'monthly', day: 19 }),
      flat('on-end', { frequency: 'monthly', day: 20 }),
      flat('after', { frequency: 'monthly', day: 21 })
    ];

    expect(deposits({ rules }, '2026-03-15', '2026-03-20')).toStrictEqual([
      { ruleId: 'on-start', date: '2026-03-15', amount: 100, bucket: 'start' },
      { ruleId: 'inside', date: '2026-03-19', amount: 100, bucket: 'end' }
    ]);
  });

  it('leaves out a zero-amount deposit and a disabled rule', () => {
    const rules = [
      flat('zero', { frequency: 'monthly' }, { amount: 0 }),
      { id: 'no-salary', type: 'salaryPercent', amount: 10, timing: { frequency: 'monthly' } },
      flat('disabled', { frequency: 'monthly' }, { enabled: false }),
      flat('kept', { frequency: 'monthly' })
    ] satisfies Array<ContributionRuleFile>;

    expect(deposits({ rules }, '2026-01-01', '2026-02-01')).toStrictEqual([
      { ruleId: 'kept', date: '2026-01-01', amount: 100, bucket: 'start' }
    ]);
  });

  it('lists a month by rule position and totals a bucket in that order', () => {
    const rules = [
      flat('big', { frequency: 'monthly', day: 15 }, { amount: 1e16 }),
      flat('third', { frequency: 'monthly', day: 3 }, { amount: 1 }),
      flat('second', { frequency: 'monthly', day: 2 }, { amount: 1 })
    ];
    const scenario = scenarioWith({ rules });
    const [account] = scenario.accounts;
    if (!account) {
      throw new Error('The fixture has no account.');
    }

    expect(
      deposits({ rules }, '2026-01-01', '2026-02-01').map(({ ruleId }) => ruleId)
    ).toStrictEqual(['big', 'third', 'second']);
    expect(
      projectAccount(scenario, account, date('2026-01-01'), date('2026-02-01'), 0, 0).finalBalance
    ).toBe(1e16);
  });

  it('totals one day of daily mode in rule order', () => {
    const rules = [
      flat('big', { frequency: 'monthly', day: 5 }, { amount: 1e16 }),
      flat('small-a', { frequency: 'monthly', day: 5 }, { amount: 1 }),
      flat('small-b', { frequency: 'monthly', day: 5 }, { amount: 1 })
    ];
    const scenario = scenarioWith({ rules, compounding: 'daily' });
    const [account] = scenario.accounts;
    if (!account) {
      throw new Error('The fixture has no account.');
    }

    expect(
      projectAccount(scenario, account, date('2026-01-01'), date('2026-02-01'), 0, 0).finalBalance
    ).toBe(1e16);
  });

  it('lets the day decide the monthly bucket over the placement: 16 January in start, 15 February in end', () => {
    const rules = [
      flat('january', { frequency: 'annual', month: 1, day: 16, placement: 'end' }),
      flat('february', { frequency: 'annual', month: 2, day: 15, placement: 'start' })
    ];

    expect(deposits({ rules }, '2026-01-01', '2026-03-01')).toStrictEqual([
      { ruleId: 'january', date: '2026-01-16', amount: 100, bucket: 'start' },
      { ruleId: 'february', date: '2026-02-15', amount: 100, bucket: 'end' }
    ]);
  });

  it.each(['monthly', 'daily'] as const)(
    'adds a bucket total to the balance once in %s mode: 1e16 + (1 + 1)',
    (compounding) => {
      const rules = [
        flat('first', { frequency: 'monthly', placement: 'start' }, { amount: 1 }),
        flat('second', { frequency: 'monthly', placement: 'start' }, { amount: 1 })
      ];
      const scenario = scenarioWith({ rules, compounding });
      const [account] = scenario.accounts;
      if (!account) {
        throw new Error('The fixture has no account.');
      }

      expect(1e16 + 1 + 1).toBe(1e16);
      expect(
        projectAccount(scenario, account, date('2026-01-01'), date('2026-02-01'), 1e16, 0)
          .finalBalance
      ).toBe(10_000_000_000_000_002);
    }
  );

  it.each([
    ['monthly', 'NaN', 0],
    ['daily', 'NaN', 0],
    ['monthly', 'Infinity', 1],
    ['daily', 'Infinity', 1]
  ] as const)(
    'throws not_finite with the account id in %s mode when a deposit amount is %s',
    (compounding, value, amount) => {
      const rules = [
        flat(
          'grows',
          { frequency: 'monthly' },
          {
            amount,
            growth: { type: 'percent', amount: 1e300, cadence: 'monthly' },
            startDate: '2026-01-01'
          }
        )
      ];
      const scenario = scenarioWith({ rules, compounding });
      const [account] = scenario.accounts;
      if (!account) {
        throw new Error('The fixture has no account.');
      }
      const built = scenarioErrorFrom(() =>
        buildAccountSchedule(scenario, account, date('2026-01-01'), date('2026-04-01'))
      );
      const projected = scenarioErrorFrom(() => projectScenario(scenario));

      expect((1 + 1e300 / 100) ** 2).toBe(Infinity);
      expect([built.code, built.accountId, built.ruleId, built.message]).toStrictEqual([
        'not_finite',
        'account',
        undefined,
        `not_finite: the deposit of rule grows on 2026-03-01 is ${value}.`
      ]);
      expect([projected.code, projected.accountId, projected.message]).toStrictEqual([
        built.code,
        built.accountId,
        built.message
      ]);
    }
  );
});

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
