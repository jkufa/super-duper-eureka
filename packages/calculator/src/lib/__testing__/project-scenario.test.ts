import { describe, expect, it } from 'vite-plus/test';

import { parseScenario, ScenarioError } from '../parse-scenario';
import { projectScenario, traceAccount } from '../project-scenario';
import type { Band, BandProjection } from '../project-scenario';
import type { AccountFile, Compounding, ContributionRuleFile, ScenarioFile } from '../scenario';

const DOUBLING_MONTHLY_RATE = 4095;
const DOUBLING_DAILY_RATE = 2 ** 365 - 1;
const BANDS: Array<Band> = ['baseline', 'positive', 'negative'];

interface AccountSetup extends Partial<Omit<AccountFile, 'id'>> {
  id: string;
}

interface Setup {
  today: string;
  endDate: string;
  compounding?: Compounding;
  annualRate?: number;
  variance?: number;
  salary?: ScenarioFile['salary'];
  accounts: Array<AccountSetup>;
}

function toAccountFile({ id, ...fields }: AccountSetup, today: string): AccountFile {
  return {
    id,
    name: id,
    kind: 'other',
    included: true,
    balance: 0,
    balanceAsOf: today,
    contributions: [],
    ...fields
  };
}

function scenarioOf(setup: Setup) {
  const { today, endDate, compounding = 'monthly', annualRate = 0, variance = 0 } = setup;
  return parseScenario(
    {
      version: 1,
      endDate,
      interest: { annualRate, variance, compounding },
      salary: setup.salary ?? { annualBase: 0, asOf: today },
      accounts: setup.accounts.map((account) => toAccountFile(account, today))
    },
    { today }
  );
}

function project(setup: Setup) {
  return projectScenario(scenarioOf(setup));
}

function accountIn(setup: Setup, band: Band, accountId: string) {
  const account = project(setup).bands[band].accounts.find(
    (candidate) => candidate.accountId === accountId
  );
  if (!account) {
    throw new Error(`The projection has no account ${accountId}.`);
  }
  return account;
}

function flat(id: string, amount: number, timing: ContributionRuleFile['timing']) {
  return { id, type: 'flat', amount, timing } satisfies ContributionRuleFile;
}

function monthly(id: string, amount: number, placement: 'start' | 'end' = 'start') {
  return flat(id, amount, { frequency: 'monthly', placement });
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

function segment(from: string, to: string, days: number, daysInMonth: number) {
  return { from, to, days, daysInMonth, daysInYear: 365 };
}

function startDeposit(date: string) {
  return [{ ruleId: 'start', date, amount: 100, bucket: 'start' }];
}

function totalOfBalances(order: Array<number>) {
  return project({
    today: '2026-11-01',
    endDate: '2026-12-01',
    accounts: order.map((balance, index) => ({ id: `a${String(index)}`, balance }))
  }).bands.baseline.total;
}

function months(rows: Array<{ year: number; month?: number }>) {
  return rows.map(({ year, month }) => [year, month]);
}

function twoAccounts(variance: number, override: number): Setup {
  return {
    today: '2026-11-16',
    endDate: '2036-01-01',
    compounding: 'daily',
    annualRate: 0.05,
    variance,
    salary: { annualBase: 80_000, annualRaiseRate: 0.02, asOf: '2026-01-01' },
    accounts: [
      {
        id: 'override',
        balance: 40_000,
        balanceAsOf: '2026-03-10',
        annualRate: override,
        contributions: [flat('o', 300, { frequency: 'monthly', day: 28 })]
      },
      {
        id: 'default',
        balance: 25_000,
        balanceAsOf: '2026-11-16',
        contributions: [
          {
            id: 'd',
            type: 'salaryPercent',
            amount: 5,
            salaryBasis: 'monthly',
            timing: { frequency: 'monthly', day: 1 }
          }
        ]
      }
    ]
  };
}

function withoutWeightedRates(band: BandProjection): BandProjection {
  const yearly = band.total.yearly.map(({ weightedRate: _, ...row }) => row);
  return { ...band, total: { ...band.total, yearly } };
}

function alone(setup: Setup, accountId: string, annualRate: number): Setup {
  return {
    ...setup,
    variance: 0,
    accounts: setup.accounts
      .filter(({ id }) => id === accountId)
      .map((account) => ({ ...account, annualRate }))
  };
}

describe('projectScenario: a stale account', () => {
  const monthlySetup: Setup = {
    today: '2026-11-16',
    endDate: '2027-01-01',
    annualRate: DOUBLING_MONTHLY_RATE,
    accounts: [
      {
        id: 'stale',
        balance: 1000,
        balanceAsOf: '2026-09-01',
        contributions: [monthly('start', 100), monthly('end', 10, 'end')]
      }
    ]
  };

  it('rolls forward to today in monthly mode and projects from today', () => {
    // September: (1000 + 100) * 2 + 10 = 2210. October: (2210 + 100) * 2 + 10 = 4630.
    // 1 to 15 November, 15 of 30 days: (4630 + 100) * 1.5 = 7095; the end deposit is on the 30th.
    // 16 to 30 November: 7095 * 1.5 + 10 = 10652.5. December: (10652.5 + 100) * 2 + 10 = 21515.
    const projection = project(monthlySetup);
    const [account] = projection.bands.baseline.accounts;

    expect(account?.rolledForward).toStrictEqual({ contributions: 320, interest: 5775 });
    expect(account?.series).toStrictEqual({
      startBalance: 7095,
      finalBalance: 21_515,
      totalContributions: 120,
      totalInterest: 14_300,
      monthly: [
        { year: 2026, month: 11, balance: 10_652.5, contributions: 10, interest: 3547.5 },
        { year: 2026, month: 12, balance: 21_515, contributions: 120, interest: 14_300 }
      ],
      yearly: [{ year: 2026, balance: 21_515, contributions: 120, interest: 14_300 }]
    });
    expect(projection.staleAccounts).toStrictEqual([
      { accountId: 'stale', balanceAsOf: '2026-09-01' }
    ]);
  });

  it('rolls forward across a month end in daily mode', () => {
    // Each day doubles. 30 October: 1000 -> 2000. 31 October: (2000 + 10) -> 4020.
    // 1 November: (4020 + 100) -> 8240, which is the balance at the start of 2 November.
    const projection = project({
      today: '2026-11-02',
      endDate: '2026-11-04',
      compounding: 'daily',
      annualRate: DOUBLING_DAILY_RATE,
      accounts: [
        {
          id: 'stale',
          balance: 1000,
          balanceAsOf: '2026-10-30',
          contributions: [monthly('start', 100), monthly('end', 10, 'end')]
        }
      ]
    });
    const [account] = projection.bands.baseline.accounts;

    expect(account?.rolledForward).toStrictEqual({ contributions: 110, interest: 7130 });
    expect(account?.series.startBalance).toBe(8240);
    expect(account?.series.finalBalance).toBe(32_960);
    expect(account?.series.totalContributions).toBe(0);
    expect(account?.series.totalInterest).toBe(24_720);
  });

  it('starts at balance plus contributions plus interest, added in that order', () => {
    const [account] = project(monthlySetup).bands.baseline.accounts;
    if (!account) {
      throw new Error('The projection has no account.');
    }
    const { contributions, interest } = account.rolledForward;

    expect(account.series.startBalance).toBe(1000 + contributions + interest);
  });

  it('starts at the compounded balance, which can differ from that sum after rounding', () => {
    // 2^53 + 1 rounds to 2^53 each month, while the two deposits of 1 add up to 2.
    const [account] = project({
      today: '2026-11-01',
      endDate: '2026-12-01',
      accounts: [
        {
          id: 'big',
          balance: 2 ** 53,
          balanceAsOf: '2026-09-01',
          contributions: [monthly('one', 1)]
        }
      ]
    }).bands.baseline.accounts;

    expect(account?.rolledForward).toStrictEqual({ contributions: 2, interest: 0 });
    expect(account?.series.startBalance).toBe(2 ** 53);
    expect(2 ** 53 + 2 + 0).toBe(9_007_199_254_740_994);
  });

  it('traces the roll forward from balanceAsOf and then the projection from today', () => {
    // As the monthly test above, without the end rule: 2200, then 3450 at today, then 5175.
    const scenario = scenarioOf({
      today: '2026-11-16',
      endDate: '2026-12-01',
      annualRate: DOUBLING_MONTHLY_RATE,
      variance: DOUBLING_MONTHLY_RATE,
      accounts: [
        {
          id: 'stale',
          balance: 1000,
          balanceAsOf: '2026-10-01',
          contributions: [monthly('start', 100)]
        }
      ]
    });

    expect(traceAccount(scenario, 'stale', 'baseline')).toStrictEqual([
      {
        ...segment('2026-10-01', '2026-11-01', 31, 31),
        balanceStart: 1000,
        balanceEnd: 2200,
        contributions: 100,
        interest: 1100,
        annualRate: DOUBLING_MONTHLY_RATE,
        deposits: startDeposit('2026-10-01')
      },
      {
        ...segment('2026-11-01', '2026-11-16', 15, 30),
        balanceStart: 2200,
        balanceEnd: 3450,
        contributions: 100,
        interest: 1150,
        annualRate: DOUBLING_MONTHLY_RATE,
        deposits: startDeposit('2026-11-01')
      },
      {
        ...segment('2026-11-16', '2026-12-01', 15, 30),
        balanceStart: 3450,
        balanceEnd: 5175,
        contributions: 0,
        interest: 1725,
        annualRate: DOUBLING_MONTHLY_RATE,
        deposits: []
      }
    ]);
    expect(
      traceAccount(scenario, 'stale', 'negative').map(
        ({ balanceStart, balanceEnd, annualRate }) => ({
          balanceStart,
          balanceEnd,
          annualRate
        })
      )
    ).toStrictEqual([
      { balanceStart: 1000, balanceEnd: 1100, annualRate: 0 },
      { balanceStart: 1100, balanceEnd: 1200, annualRate: 0 },
      { balanceStart: 1200, balanceEnd: 1200, annualRate: 0 }
    ]);

    const positive = traceAccount(scenario, 'stale', 'positive');
    const [rolledOctober, rolledNovember, projected] = positive;
    const series = projectScenario(scenario).bands.positive.accounts[0]?.series;

    expect(positive.map(({ from, to }) => [from, to])).toStrictEqual([
      ['2026-10-01', '2026-11-01'],
      ['2026-11-01', '2026-11-16'],
      ['2026-11-16', '2026-12-01']
    ]);
    expect(positive.every(({ annualRate }) => annualRate === 2 * DOUBLING_MONTHLY_RATE)).toBe(true);
    expect(rolledOctober?.balanceStart).toBe(1000);
    expect(rolledNovember?.balanceStart).toBe(rolledOctober?.balanceEnd);
    expect(projected?.balanceStart).toBe(rolledNovember?.balanceEnd);
    expect(projected?.balanceStart).toBe(series?.startBalance);
    expect(projected?.balanceEnd).toBe(series?.finalBalance);
  });
});

describe('projectScenario: accounts and the total', () => {
  it('projects an excluded account but leaves it out of the total and the stale list', () => {
    // Monthly rate 1. kept: 1000 -> 2000. excluded: rolled 50 -> 100, then 200.
    const projection = project({
      today: '2026-11-01',
      endDate: '2026-12-01',
      annualRate: DOUBLING_MONTHLY_RATE,
      accounts: [
        { id: 'kept', balance: 1000 },
        { id: 'excluded', balance: 50, balanceAsOf: '2026-10-01', included: false }
      ]
    });
    const { total, accounts } = projection.bands.baseline;

    expect(accounts.map(({ accountId, included }) => [accountId, included])).toStrictEqual([
      ['kept', true],
      ['excluded', false]
    ]);
    expect(accounts[1]?.series.finalBalance).toBe(200);
    expect(total).toStrictEqual({
      ...accounts[0]?.series,
      yearly: [{ year: 2026, balance: 2000, contributions: 0, interest: 1000, weightedRate: 4095 }]
    });
    expect(total.finalBalance).toBe(2000);
    expect(projection.staleAccounts).toStrictEqual([]);
  });

  it('sums the total in scenario order, starting from 0', () => {
    // 1e16 + 1 rounds back to 1e16, so the two 1s are lost one at a time.
    expect(totalOfBalances([1e16, 1, 1]).startBalance).toBe(10_000_000_000_000_000);
    expect(totalOfBalances([1e16, 1, 1]).monthly[0]?.balance).toBe(10_000_000_000_000_000);
    expect(totalOfBalances([1, 1, 1e16]).startBalance).toBe(10_000_000_000_000_002);
    expect(totalOfBalances([1, 1, 1e16]).finalBalance).toBe(10_000_000_000_000_002);
  });

  it('rolls forward accounts with different as-of dates, one of them equal to today', () => {
    // Monthly rate 1, half of November before today and half after.
    // early: October 1000 -> 2000, 1 to 15 November -> 3000, then 4500.
    // sameMonth: 1 to 15 November 1000 -> 1500, then 2250. fresh: 1000 -> 1500.
    const projection = project({
      today: '2026-11-16',
      endDate: '2026-12-01',
      annualRate: DOUBLING_MONTHLY_RATE,
      accounts: [
        { id: 'sameMonth', balance: 1000, balanceAsOf: '2026-11-01' },
        { id: 'fresh', balance: 1000 },
        { id: 'early', balance: 1000, balanceAsOf: '2026-10-01' }
      ]
    });
    const { accounts, total } = projection.bands.baseline;

    expect(
      accounts.map(({ accountId, rolledForward, series }) => [
        accountId,
        rolledForward.interest,
        series.startBalance,
        series.finalBalance
      ])
    ).toStrictEqual([
      ['sameMonth', 500, 1500, 2250],
      ['fresh', 0, 1000, 1500],
      ['early', 2000, 3000, 4500]
    ]);
    expect([total.startBalance, total.finalBalance, total.totalInterest]).toStrictEqual([
      5500, 8250, 2750
    ]);
    expect(projection.staleAccounts).toStrictEqual([
      { accountId: 'sameMonth', balanceAsOf: '2026-11-01' },
      { accountId: 'early', balanceAsOf: '2026-10-01' }
    ]);
  });

  it('lines up the total rows with every account from a mid-month today to a mid-month end', () => {
    // Rate 0. a: rolls forward 1000 + 100 on 20 October, then 100 on each 20th, 16 deposits.
    // b: 10 on each 5th from December, 16 deposits. c: 7 on 1 March 2027 and 2028.
    const projection = project({
      today: '2026-11-16',
      endDate: '2028-03-10',
      accounts: [
        {
          id: 'a',
          balance: 1000,
          balanceAsOf: '2026-10-01',
          contributions: [flat('a20', 100, { frequency: 'monthly', day: 20 })]
        },
        {
          id: 'b',
          balance: 500,
          contributions: [flat('b5', 10, { frequency: 'monthly', day: 5 })]
        },
        { id: 'c', contributions: [flat('c', 7, { frequency: 'annual', month: 3, day: 1 })] }
      ]
    });
    const { total, accounts } = projection.bands.baseline;

    expect(total.monthly).toHaveLength(17);
    expect(total.monthly[0]).toStrictEqual({
      year: 2026,
      month: 11,
      balance: 1700,
      contributions: 100,
      interest: 0
    });
    expect(total.monthly.at(-1)).toStrictEqual({
      year: 2028,
      month: 3,
      balance: 3374,
      contributions: 1774,
      interest: 0
    });
    expect(total.yearly).toStrictEqual([
      { year: 2026, balance: 1810, contributions: 210, interest: 0, weightedRate: 0 },
      { year: 2027, balance: 3137, contributions: 1537, interest: 0, weightedRate: 0 },
      { year: 2028, balance: 3374, contributions: 1774, interest: 0, weightedRate: 0 }
    ]);
    for (const { series } of accounts) {
      expect(months(series.monthly)).toStrictEqual(months(total.monthly));
      expect(months(series.yearly)).toStrictEqual(months(total.yearly));
    }
  });

  it.each([
    ['no accounts', []],
    ['only excluded accounts', [{ id: 'excluded', balance: 100, included: false }]]
  ] satisfies Array<[string, Array<AccountSetup>]>)(
    'gives a zero total with a row per month when there are %s',
    (_, accounts) => {
      const projection = project({ today: '2026-11-16', endDate: '2027-02-01', accounts });
      const zero = { balance: 0, contributions: 0, interest: 0 };

      expect(projection.bands.baseline.total).toStrictEqual({
        startBalance: 0,
        finalBalance: 0,
        totalContributions: 0,
        totalInterest: 0,
        monthly: [
          { year: 2026, month: 11, ...zero },
          { year: 2026, month: 12, ...zero },
          { year: 2027, month: 1, ...zero }
        ],
        yearly: [
          { year: 2026, ...zero, weightedRate: null },
          { year: 2027, ...zero, weightedRate: null }
        ]
      });
      expect(projection.salaryByYear.map(({ year }) => year)).toStrictEqual([2026, 2027]);
    }
  );

  it('splits into three accounts with the rules divided and totals the same within 1e-9', () => {
    const rules: Array<ContributionRuleFile> = [
      flat('monthly', 500, { frequency: 'monthly', day: 15 }),
      flat('annual', 2000, { frequency: 'annual', month: 6 }),
      {
        id: 'salary',
        type: 'salaryPercent',
        amount: 6,
        salaryBasis: 'monthly',
        timing: { frequency: 'monthly', placement: 'end' }
      }
    ];
    const base = {
      today: '2026-11-16',
      endDate: '2036-11-16',
      annualRate: 0.06,
      variance: 0.02,
      salary: { annualBase: 90_000, annualRaiseRate: 0.03, asOf: '2026-01-01' }
    };

    for (const compounding of ['monthly', 'daily'] as const) {
      const single = project({
        ...base,
        compounding,
        accounts: [{ id: 'one', balance: 100_000, balanceAsOf: '2026-06-01', contributions: rules }]
      });
      const split = project({
        ...base,
        compounding,
        accounts: [50_000, 30_000, 20_000].map((balance, index) => ({
          id: `part${String(index)}`,
          balance,
          balanceAsOf: '2026-06-01',
          contributions: rules.slice(index, index + 1)
        }))
      });
      for (const band of BANDS) {
        const expected = single.bands[band].total.finalBalance;
        const actual = split.bands[band].total.finalBalance;
        expect(Math.abs(actual - expected) / expected).toBeLessThan(1e-9);
        expect(split.bands[band].total.monthly).toHaveLength(121);
      }
    }
  });
});

describe('projectScenario: bands', () => {
  it('projects each account of a two-rate scenario exactly as it projects alone', () => {
    const setup = twoAccounts(0, 0.08);
    const projection = project(setup);

    expect(projection.bands.baseline.accounts[0]).toStrictEqual(
      accountIn(alone(setup, 'override', 0.08), 'baseline', 'override')
    );
    expect(projection.bands.baseline.accounts[1]).toStrictEqual(
      accountIn(alone(setup, 'default', 0.05), 'baseline', 'default')
    );
  });

  it('moves every account rate by the variance, the roll forward included', () => {
    const setup = twoAccounts(0.01, 0.08);
    const rates = Object.fromEntries(
      BANDS.map((band) => [
        band,
        project(setup).bands[band].accounts.map(({ annualRate }) => annualRate)
      ])
    );

    expect(rates).toStrictEqual({
      baseline: [0.08, 0.05],
      positive: [0.08 + 0.01, 0.05 + 0.01],
      negative: [0.08 - 0.01, 0.05 - 0.01]
    });
    for (const [band, offset] of [
      ['positive', 0.01],
      ['negative', -0.01]
    ] as const) {
      expect(accountIn(setup, band, 'override')).toStrictEqual(
        accountIn(alone(setup, 'override', 0.08 + offset), 'baseline', 'override')
      );
      expect(accountIn(setup, band, 'default')).toStrictEqual(
        accountIn(alone(setup, 'default', 0.05 + offset), 'baseline', 'default')
      );
    }
    expect(accountIn(setup, 'positive', 'override').rolledForward.interest).toBeGreaterThan(
      accountIn(setup, 'baseline', 'override').rolledForward.interest
    );
  });

  it('holds the same numbers in all three bands when there is no variance', () => {
    const { bands } = project(twoAccounts(0, 0.08));

    expect(bands.positive).toStrictEqual(withoutWeightedRates(bands.baseline));
    expect(bands.negative).toStrictEqual(withoutWeightedRates(bands.baseline));
  });
});

describe('projectScenario: salary and dates', () => {
  it('gives the salary for each calendar year from today to the last counted day', () => {
    const salary = { annualBase: 100_000, annualRaiseRate: 0.5, asOf: '2025-06-01' };
    const salaryByYear = (endDate: string) =>
      project({ today: '2026-11-16', endDate, salary, accounts: [] }).salaryByYear;

    expect(salaryByYear('2028-03-10')).toStrictEqual([
      { year: 2026, salary: 150_000 },
      { year: 2027, salary: 225_000 },
      { year: 2028, salary: 337_500 }
    ]);
    expect(salaryByYear('2029-01-01').map(({ year }) => year)).toStrictEqual([2026, 2027, 2028]);
  });

  it('reports today and the end date as written', () => {
    const projection = project({ today: '2026-11-16', endDate: '2028-03-10', accounts: [] });

    expect([projection.today, projection.endDate]).toStrictEqual(['2026-11-16', '2028-03-10']);
  });
});

describe('projectScenario: errors', () => {
  it('names the unknown account a trace asks for', () => {
    const scenario = scenarioOf({
      today: '2026-11-01',
      endDate: '2027-01-01',
      accounts: [{ id: 'known' }]
    });
    const error = scenarioErrorFrom(() => traceAccount(scenario, 'missing', 'baseline'));

    expect({
      code: error.code,
      path: error.path,
      accountId: error.accountId,
      ruleId: error.ruleId
    }).toStrictEqual({
      code: 'unknown_account',
      path: '',
      accountId: 'missing',
      ruleId: undefined
    });
    expect(error.message).toBe('unknown_account: the scenario has no account with this id.');
  });

  it('throws not_finite with no account id when finite accounts overflow the total', () => {
    const error = scenarioErrorFrom(() =>
      project({
        today: '2026-11-01',
        endDate: '2026-12-01',
        accounts: [
          { id: 'a', balance: 1e308 },
          { id: 'b', balance: 1e308 }
        ]
      })
    );

    expect({ code: error.code, accountId: error.accountId }).toStrictEqual({
      code: 'not_finite',
      accountId: undefined
    });
    expect(error.message).toBe('not_finite: the total startBalance is Infinity.');
  });

  it('throws not_finite with no account id when the salary in a year overflows', () => {
    const error = scenarioErrorFrom(() =>
      project({
        today: '2026-01-01',
        endDate: '2028-01-01',
        salary: { annualBase: 1e308, annualRaiseRate: 1, asOf: '2026-01-01' },
        accounts: []
      })
    );

    expect({ code: error.code, accountId: error.accountId }).toStrictEqual({
      code: 'not_finite',
      accountId: undefined
    });
    expect(error.message).toBe('not_finite: the salary in 2027 is Infinity.');
  });

  it('throws not_finite with no account id when a weighted rate overflows', () => {
    const error = scenarioErrorFrom(() =>
      project({
        today: '2026-12-01',
        endDate: '2027-01-01',
        accounts: [
          { id: 'a', balance: 1 },
          { id: 'b', balance: 1e10, annualRate: 1e300 }
        ]
      })
    );

    expect({ code: error.code, accountId: error.accountId }).toStrictEqual({
      code: 'not_finite',
      accountId: undefined
    });
    expect(error.message).toBe('not_finite: the weighted rate in 2026 is Infinity.');
  });
});
