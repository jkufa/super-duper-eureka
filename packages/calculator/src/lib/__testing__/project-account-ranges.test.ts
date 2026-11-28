import { describe, expect, it } from 'vite-plus/test';

import { parseScenario } from '../parse-scenario';
import {
  addMonths,
  compareDates,
  daysInMonth,
  formatPlainDate,
  parsePlainDate
} from '../plain-date';
import type { PlainDate } from '../plain-date';
import { projectAccount, traceAccountRange } from '../project-account';
import type { Compounding, ContributionRuleFile, RuleTiming } from '../scenario';

const DOUBLING_MONTHLY_RATE = 4095;
const DOUBLING_DAILY_RATE = 2 ** 365 - 1;
const DOUBLING_LEAP_DAILY_RATE = 2 ** 366 - 1;
const RATE_FOR = { monthly: DOUBLING_MONTHLY_RATE, daily: DOUBLING_DAILY_RATE } as const;

const EARLY_AND_LATE: Array<ContributionRuleFile> = [
  { id: 'early', type: 'flat', amount: 100, timing: { frequency: 'monthly', day: 3 } },
  { id: 'late', type: 'flat', amount: 10, timing: { frequency: 'monthly', day: 20 } }
];

function date(text: string): PlainDate {
  const parsed = parsePlainDate(text);
  if (!parsed) {
    throw new Error(`Bad fixture date ${text}.`);
  }
  return parsed;
}

function flat(id: string, amount: number, timing: RuleTiming): ContributionRuleFile {
  return { id, type: 'flat', amount, timing };
}

function oneTime(id: string, amount: number, on: string): ContributionRuleFile {
  return flat(id, amount, { frequency: 'oneTime', on });
}

function setup(compounding: Compounding, contributions: Array<ContributionRuleFile>) {
  const scenario = parseScenario(
    {
      version: 1,
      endDate: '2030-01-01',
      interest: { annualRate: 0, compounding },
      salary: { annualBase: 0, asOf: '2026-01-01' },
      accounts: [
        {
          id: 'account',
          name: 'Account',
          kind: 'taxable',
          included: true,
          balance: 0,
          balanceAsOf: '2026-01-01',
          contributions
        }
      ]
    },
    { today: '2026-01-01' }
  );
  const [account] = scenario.accounts;
  if (!account) {
    throw new Error('The fixture has no account.');
  }
  return { scenario, account };
}

interface Run {
  compounding: Compounding;
  contributions?: Array<ContributionRuleFile>;
  from: string;
  to: string;
  opening: number;
  rate?: number;
}

function project({ compounding, contributions = [], from, to, opening, rate }: Run) {
  const { scenario, account } = setup(compounding, contributions);
  return projectAccount(
    scenario,
    account,
    date(from),
    date(to),
    opening,
    rate ?? RATE_FOR[compounding]
  );
}

function trace({ compounding, contributions = [], from, to, opening, rate }: Run) {
  const { scenario, account } = setup(compounding, contributions);
  return traceAccountRange(
    scenario,
    account,
    date(from),
    date(to),
    opening,
    rate ?? RATE_FOR[compounding]
  );
}

function finalBalance(run: Run) {
  return project(run).finalBalance;
}

function nextDay(day: PlainDate): PlainDate {
  return day.day < daysInMonth(day.year, day.month)
    ? { ...day, day: day.day + 1 }
    : { ...addMonths(day, 1), day: 1 };
}

function daysFrom(from: string, to: string): Array<string> {
  const days: Array<string> = [];
  for (let day = date(from); compareDates(day, date(to)) < 0; day = nextDay(day)) {
    days.push(formatPlainDate(day));
  }
  return days;
}

describe('projectAccount over part of a month', () => {
  it('starts on the 27th of a 30-day month in monthly mode: 3000 + 3000 × 4/30 = 3400, then December (3400 + 100) × 2 + 10 = 7010', () => {
    const series = project({
      compounding: 'monthly',
      contributions: EARLY_AND_LATE,
      from: '2026-11-27',
      to: '2027-01-01',
      opening: 3000
    });

    expect(series.monthly).toStrictEqual([
      { year: 2026, month: 11, balance: 3400, contributions: 0, interest: 400 },
      { year: 2026, month: 12, balance: 7010, contributions: 110, interest: 3900 }
    ]);
  });

  it('starts on the 27th of a 30-day month in daily mode: 3000 × 2^4 = 48000, then 48000 × 2^31 + 100 × 2^29 + 10 × 2^12', () => {
    const series = project({
      compounding: 'daily',
      contributions: EARLY_AND_LATE,
      from: '2026-11-27',
      to: '2027-01-01',
      opening: 3000
    });

    expect(48_000 * 2 ** 31 + 100 * 2 ** 29 + 10 * 2 ** 12).toBe(103_132_902_236_160);
    expect(series.monthly).toStrictEqual([
      { year: 2026, month: 11, balance: 48_000, contributions: 0, interest: 45_000 },
      {
        year: 2026,
        month: 12,
        balance: 103_132_902_236_160,
        contributions: 110,
        interest: 103_132_902_236_160 - 3110
      }
    ]);
  });

  it.each([
    ['monthly', (1000 + 100) * 1 * (15 / 30), 1650],
    ['daily', 1000 * 2 ** 15 + 100 * 2 ** 13 - 1100, 33_587_200]
  ] as const)(
    'ends mid-month on the 16th in %s mode, keeping the deposit on the 3rd and not the one on the 20th',
    (compounding, interest, balance) => {
      expect(
        project({
          compounding,
          contributions: EARLY_AND_LATE,
          from: '2026-11-01',
          to: '2026-11-16',
          opening: 1000
        })
      ).toStrictEqual({
        startBalance: 1000,
        finalBalance: balance,
        totalContributions: 100,
        totalInterest: interest,
        monthly: [{ year: 2026, month: 11, balance, contributions: 100, interest }],
        yearly: [{ year: 2026, balance, contributions: 100, interest }]
      });
    }
  );

  it.each([
    ['monthly', 1000 + 1000 * (15 / 30) + 10],
    ['daily', 1000 * 2 ** 15 + 10 * 2 ** 5]
  ] as const)(
    'starts and ends inside one month in %s mode: 10th to 25th keeps only the deposit on the 20th',
    (compounding, balance) => {
      expect(balance).toBe(compounding === 'monthly' ? 1510 : 32_768_320);
      expect(
        finalBalance({
          compounding,
          contributions: EARLY_AND_LATE,
          from: '2026-11-10',
          to: '2026-11-25',
          opening: 1000
        })
      ).toBe(balance);
    }
  );

  it.each([
    ['monthly', (1000 + 10) * 1.5, 1515],
    ['daily', (1000 + 10) * 2 ** 15, 33_095_680]
  ] as const)(
    'keeps a deposit on the range start and drops ones before it, on the end and after it, in %s mode',
    (compounding, expected, balance) => {
      const run: Run = {
        compounding,
        contributions: [
          oneTime('before', 1, '2026-11-09'),
          oneTime('on-start', 10, '2026-11-10'),
          oneTime('on-end', 100, '2026-11-25'),
          oneTime('after', 1000, '2026-11-26')
        ],
        from: '2026-11-10',
        to: '2026-11-25',
        opening: 1000
      };

      expect(expected).toBe(balance);
      expect(finalBalance(run)).toBe(balance);
      expect(trace(run)[0]?.deposits).toStrictEqual([
        {
          ruleId: 'on-start',
          date: '2026-11-10',
          amount: 10,
          bucket: compounding === 'monthly' ? 'start' : 10
        }
      ]);
    }
  );

  it.each([
    [
      'monthly',
      '2900 + 2900 × 1/29 = 3000, then 3000 + (3000 + 100) × 1/31 = 3200',
      DOUBLING_MONTHLY_RATE,
      2900,
      [3000, 3200]
    ],
    [
      'daily',
      '1000 × 2 = 2000, then (2000 + 100) × 2 = 4200',
      DOUBLING_LEAP_DAILY_RATE,
      1000,
      [2000, 4200]
    ]
  ] as const)('starts on 29 February in %s mode: %s', (compounding, _, rate, opening, balances) => {
    const run: Run = {
      compounding,
      contributions: [flat('first', 100, { frequency: 'monthly', day: 1 })],
      from: '2028-02-29',
      to: '2028-03-02',
      opening,
      rate
    };

    expect(project(run).monthly.map(({ balance }) => balance)).toStrictEqual(balances);
    expect(
      trace(run).map(({ from, to, days, daysInMonth: monthDays, daysInYear }) => ({
        from,
        to,
        days,
        monthDays,
        daysInYear
      }))
    ).toStrictEqual([
      { from: '2028-02-29', to: '2028-03-01', days: 1, monthDays: 29, daysInYear: 366 },
      { from: '2028-03-01', to: '2028-03-02', days: 1, monthDays: 31, daysInYear: 366 }
    ]);
  });

  it.each([
    ['monthly', '2026-12-01', 1000 + 1000 * (15 / 30) + 100, 1600],
    ['daily', '2026-12-01', 1000 * 2 ** 15 + 100 * 2, 32_768_200],
    ['monthly', '2026-11-30', 1000 + 1000 * (14 / 30), 1466.6666666666667],
    ['daily', '2026-11-30', 1000 * 2 ** 14, 16_384_000]
  ] as const)(
    'dates a day-31 rule on 30 November in %s mode, kept up to %s only when the 30th is counted',
    (compounding, to, expected, balance) => {
      expect(expected).toBe(balance);
      expect(
        finalBalance({
          compounding,
          contributions: [flat('thirty-first', 100, { frequency: 'monthly', day: 31 })],
          from: '2026-11-16',
          to,
          opening: 1000
        })
      ).toBe(balance);
    }
  );

  it('multiplies monthly segment interest by the day fraction last: 1000 × 1 × (11/30) = 366.66666666666663, not 1000 × 11 / 30', () => {
    expect(1000 * 1 * (11 / 30)).toBe(366.66666666666663);
    expect((1000 * 11) / 30).toBe(366.6666666666667);
    expect(
      project({ compounding: 'monthly', from: '2026-11-01', to: '2026-11-12', opening: 1000 })
        .totalInterest
    ).toBe(366.66666666666663);
  });

  it('keeps a one-time deposit on the 28th in the start bucket of a monthly segment from the 27th: (2500 + 500) × 4/30 = 400', () => {
    const run: Run = {
      compounding: 'monthly',
      contributions: [oneTime('once', 500, '2026-11-28')],
      from: '2026-11-27',
      to: '2026-12-01',
      opening: 2500
    };

    expect(trace(run)).toStrictEqual([
      {
        from: '2026-11-27',
        to: '2026-12-01',
        days: 4,
        daysInMonth: 30,
        daysInYear: 365,
        balanceStart: 2500,
        balanceEnd: 3400,
        contributions: 500,
        interest: 400,
        annualRate: DOUBLING_MONTHLY_RATE,
        deposits: [{ ruleId: 'once', date: '2026-11-28', amount: 500, bucket: 'start' }]
      }
    ]);
  });

  it('drops a one-time deposit on the 28th from a monthly segment that starts on the 29th: 3000 × 2/30 = 200', () => {
    expect(
      project({
        compounding: 'monthly',
        contributions: [oneTime('once', 500, '2026-11-28')],
        from: '2026-11-29',
        to: '2026-12-01',
        opening: 3000
      }).monthly
    ).toStrictEqual([{ year: 2026, month: 11, balance: 3200, contributions: 0, interest: 200 }]);
  });

  it('drops a start placement dated day 1 from a daily range that starts on the 2nd and keeps it the next month: 1000 × 2^31 + 100 × 2^2', () => {
    const series = project({
      compounding: 'daily',
      contributions: [flat('placed-start', 100, { frequency: 'monthly', placement: 'start' })],
      from: '2026-11-02',
      to: '2026-12-03',
      opening: 1000
    });

    expect(series.monthly.map(({ contributions }) => contributions)).toStrictEqual([0, 100]);
    expect(series.finalBalance).toBe(1000 * 2 ** 31 + 100 * 2 ** 2);
    expect(series.finalBalance).toBe(2_147_483_648_400);
  });

  it('drops an end placement dated the last day from a daily range that ends on that day: 1000 × 2^29', () => {
    const series = project({
      compounding: 'daily',
      contributions: [flat('placed-end', 100, { frequency: 'monthly', placement: 'end' })],
      from: '2026-11-01',
      to: '2026-11-30',
      opening: 1000
    });

    expect(series.totalContributions).toBe(0);
    expect(series.finalBalance).toBe(536_870_912_000);
  });

  it('totals the kept deposits of a partial monthly segment in rule order: 1e16 + 1 + 1 = 1e16, not 1 + 1 + 1e16', () => {
    const series = project({
      compounding: 'monthly',
      contributions: [
        oneTime('big', 1e16, '2026-11-25'),
        oneTime('first-small', 1, '2026-11-17'),
        oneTime('second-small', 1, '2026-11-18')
      ],
      from: '2026-11-16',
      to: '2026-12-01',
      opening: 0
    });

    expect(1e16 + 1 + 1).toBe(10_000_000_000_000_000);
    expect(1 + 1 + 1e16).toBe(10_000_000_000_000_002);
    expect(series.monthly).toStrictEqual([
      {
        year: 2026,
        month: 11,
        balance: 15_000_000_000_000_000,
        contributions: 10_000_000_000_000_000,
        interest: 5_000_000_000_000_000
      }
    ]);
  });

  it('adds the numbered-day total before the start total on day 1 of a partial daily segment: (1e16 + (1 + 1)) × 2^15', () => {
    const series = project({
      compounding: 'daily',
      contributions: [
        flat('first-start', 1, { frequency: 'monthly', placement: 'start' }),
        oneTime('big', 1e16, '2026-11-01'),
        flat('second-start', 1, { frequency: 'monthly', placement: 'start' })
      ],
      from: '2026-11-01',
      to: '2026-11-16',
      opening: 0
    });

    expect(1e16 + (1 + 1)).toBe(10_000_000_000_000_002);
    expect(series.totalContributions).toBe(10_000_000_000_000_002);
    expect(series.finalBalance).toBe(10_000_000_000_000_002 * 2 ** 15);
  });

  it('switches the daily rate from 365 to 366 days at a year end: 1000 × 2 × 2 = 4000, then 4000 × 2^(365/366)', () => {
    const run: Run = {
      compounding: 'daily',
      from: '2027-12-30',
      to: '2028-01-02',
      opening: 1000
    };
    const leapDailyRate = (2 ** 365) ** (1 / 366) - 1;

    expect(leapDailyRate).toBe(0.9962158948735886);
    expect(project(run).monthly.map(({ balance }) => balance)).toStrictEqual([
      4000,
      4000 + 4000 * leapDailyRate
    ]);
    expect(4000 + 4000 * leapDailyRate).toBe(7984.863579494355);
    expect(trace(run).map(({ daysInYear }) => daysInYear)).toStrictEqual([365, 366]);
  });

  it('counts 29 February in a daily range that crosses it at the 366-day rate: 1000 × 2^3', () => {
    expect(
      finalBalance({
        compounding: 'daily',
        from: '2028-02-28',
        to: '2028-03-02',
        opening: 1000,
        rate: DOUBLING_LEAP_DAILY_RATE
      })
    ).toBe(8000);
  });
});

describe('splitting a range', () => {
  const contributions = [
    ...EARLY_AND_LATE,
    flat('placed-end', 7, { frequency: 'monthly', placement: 'end' }),
    oneTime('once', 250, '2027-01-17')
  ];

  function split(compounding: Compounding, from: string, middle: string, to: string) {
    const rate = 0.07;
    const first = finalBalance({
      compounding,
      contributions,
      from,
      to: middle,
      opening: 1234.5,
      rate
    });
    return finalBalance({ compounding, contributions, from: middle, to, opening: first, rate });
  }

  it('gives exactly the same final balance in daily mode wherever the range is split', () => {
    const whole = finalBalance({
      compounding: 'daily',
      contributions,
      from: '2026-11-27',
      to: '2027-03-10',
      opening: 1234.5,
      rate: 0.07
    });
    const middles = daysFrom('2026-11-28', '2027-03-10');

    expect(middles).toHaveLength(102);
    expect(
      middles.map((middle) => split('daily', '2026-11-27', middle, '2027-03-10'))
    ).toStrictEqual(middles.map(() => whole));
  });

  it('gives exactly the same final balance in monthly mode when the range is split on the 1st of a month', () => {
    const whole = finalBalance({
      compounding: 'monthly',
      contributions,
      from: '2026-11-27',
      to: '2027-03-10',
      opening: 1234.5,
      rate: 0.07
    });
    const middles = ['2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'];

    expect(
      middles.map((middle) => split('monthly', '2026-11-27', middle, '2027-03-10'))
    ).toStrictEqual(middles.map(() => whole));
  });

  it('compounds a monthly split mid-month twice: 1000 × 2 = 2000 whole, 1000 × 1.5 × 1.5 = 2250 split on the 16th', () => {
    const run = { compounding: 'monthly', opening: 1000 } as const;

    expect(finalBalance({ ...run, from: '2026-11-01', to: '2026-12-01' })).toBe(2000);
    const first = finalBalance({ ...run, from: '2026-11-01', to: '2026-11-16' });
    expect(first).toBe(1500);
    expect(finalBalance({ ...run, from: '2026-11-16', to: '2026-12-01', opening: first })).toBe(
      2250
    );
  });
});

describe('traceAccountRange over part of a month', () => {
  it('reports each segment with its real dates and day count, and the days add up to the range: 4 + 31 + 31 + 29 + 1 = 96', () => {
    const segments = trace({
      compounding: 'daily',
      from: '2027-11-27',
      to: '2028-03-02',
      opening: 0
    }).map(({ from, to, days, daysInMonth: monthDays, daysInYear }) => [
      from,
      to,
      days,
      monthDays,
      daysInYear
    ]);

    expect(segments).toStrictEqual([
      ['2027-11-27', '2027-12-01', 4, 30, 365],
      ['2027-12-01', '2028-01-01', 31, 31, 365],
      ['2028-01-01', '2028-02-01', 31, 31, 366],
      ['2028-02-01', '2028-03-01', 29, 29, 366],
      ['2028-03-01', '2028-03-02', 1, 31, 366]
    ]);
    expect(segments.reduce((sum, [, , days]) => sum + Number(days), 0)).toBe(
      daysFrom('2027-11-27', '2028-03-02').length
    );
    expect(daysFrom('2027-11-27', '2028-03-02')).toHaveLength(96);
  });
});

describe('yearly rows over a range that starts mid-year and ends mid-month', () => {
  it.each(['monthly', 'daily'] as const)(
    'puts each calendar year at its last counted segment in %s mode: 1000 + 10, + 5 × 110, + 12 × 110, + 110 + 100',
    (compounding) => {
      const series = project({
        compounding,
        contributions: EARLY_AND_LATE,
        from: '2026-07-15',
        to: '2028-02-10',
        opening: 1000,
        rate: 0
      });

      expect(series.monthly).toHaveLength(20);
      expect(series.monthly[0]).toStrictEqual({
        year: 2026,
        month: 7,
        balance: 1010,
        contributions: 10,
        interest: 0
      });
      expect(series.yearly).toStrictEqual([
        { year: 2026, balance: 1560, contributions: 560, interest: 0 },
        { year: 2027, balance: 2880, contributions: 1880, interest: 0 },
        { year: 2028, balance: 3090, contributions: 2090, interest: 0 }
      ]);
    }
  );
});
