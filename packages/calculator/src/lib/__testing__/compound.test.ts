import { describe, expect, it } from 'vite-plus/test';

import { compound } from '../compound';
import type { Deposit, DepositBucket, Schedule, ScheduleMonth } from '../schedule';

const DOUBLING_MONTHLY_RATE = 4095;
const DOUBLING_DAILY_RATE = 2 ** 365 - 1;

function month(daysInMonth: number): ScheduleMonth {
  return {
    yearIndex: 0,
    monthIndex: 0,
    calendarYear: 2026,
    daysInMonth,
    daysInYear: 365,
    salary: 0
  };
}

function deposit(
  monthOffset: number,
  amount: number,
  bucket: DepositBucket,
  dayOfMonth = typeof bucket === 'number' ? bucket : 1
): Deposit {
  return {
    ruleId: `rule-${String(amount)}`,
    ruleIndex: 0,
    ruleType: 'flat',
    timing: { frequency: 'monthly', day: dayOfMonth },
    monthOffset,
    dayOfMonth,
    amount,
    bucket
  };
}

describe('compound', () => {
  it('adds start deposits before a month of interest and end deposits after it', () => {
    const schedule: Schedule = {
      compounding: 'monthly',
      months: [month(31), month(28)],
      deposits: [deposit(0, 60, 'start'), deposit(0, 50, 'end'), deposit(0, 40, 'start')]
    };

    expect(compound(1000, schedule, DOUBLING_MONTHLY_RATE)).toStrictEqual({
      finalBalance: 4500,
      totalContributions: 150,
      totalInterest: 3350,
      monthly: [
        { month: month(31), balance: 2250, contributions: 150, interest: 1100 },
        { month: month(28), balance: 4500, contributions: 150, interest: 3350 }
      ]
    });
  });

  it('adds start deposits on day 1, end deposits on the last day and day deposits on their day', () => {
    const schedule: Schedule = {
      compounding: 'daily',
      months: [month(3)],
      deposits: [deposit(0, 1, 'start'), deposit(0, 4, 3), deposit(0, 5, 2), deposit(0, 2, 'end')]
    };

    expect(compound(10, schedule, DOUBLING_DAILY_RATE)).toStrictEqual({
      finalBalance: 120,
      totalContributions: 12,
      totalInterest: 98,
      monthly: [{ month: month(3), balance: 120, contributions: 12, interest: 98 }]
    });
  });

  it.each(['monthly', 'daily'] as const)(
    'adds the total of a bucket to the balance once in %s mode',
    (compounding) => {
      const schedule: Schedule = {
        compounding,
        months: [month(30)],
        deposits: [deposit(0, 1, 'start'), deposit(0, 1, 'start')]
      };

      expect(compound(1e16, schedule, 0).finalBalance).toBe(10_000_000_000_000_002);
    }
  );

  it('totals a bucket in rule order, not in date order', () => {
    const schedule: Schedule = {
      compounding: 'monthly',
      months: [month(31)],
      deposits: [
        deposit(0, 1e16, 'start', 15),
        deposit(0, 1, 'start', 3),
        deposit(0, 1, 'start', 2)
      ]
    };

    expect(compound(0, schedule, 0).finalBalance).toBe(10_000_000_000_000_000);
  });

  it('returns the starting balance when the schedule has no months', () => {
    expect(compound(500, { compounding: 'monthly', months: [], deposits: [] }, 0.05)).toStrictEqual(
      { finalBalance: 500, totalContributions: 0, totalInterest: 0, monthly: [] }
    );
  });

  it('rejects a deposit outside the schedule', () => {
    const schedule: Schedule = {
      compounding: 'monthly',
      months: [month(31)],
      deposits: [deposit(1, 10, 'start')]
    };

    expect(() => compound(0, schedule, 0.05)).toThrow(
      'Deposit for rule "rule-10" is in month 1, outside the schedule.'
    );
  });
});
