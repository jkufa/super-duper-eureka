import { describe, expect, it } from 'vite-plus/test';

import { makeConfig } from '../factories';
import { buildSchedule } from '../schedule';
import type { Schedule } from '../schedule';
import type { CompoundingFrequency, ContributionTiming } from '../types';

function datesAndBuckets(schedule: Schedule) {
  return schedule.deposits.map(
    ({ ruleId, ruleIndex, monthOffset, dayOfMonth, amount, bucket }) => ({
      ruleId,
      ruleIndex,
      monthOffset,
      dayOfMonth,
      amount,
      bucket
    })
  );
}

function singleRuleSchedule(timing: ContributionTiming, compounding: CompoundingFrequency) {
  return buildSchedule(
    makeConfig({
      timeHorizonYears: 1,
      startDate: '2026-01-01T00:00:00.000Z',
      interest: { annualRate: 0.05, compounding },
      contributions: [{ type: 'flat', id: 'rule', amount: 10, timing }]
    })
  );
}

function scheduleFor(compounding: CompoundingFrequency) {
  return buildSchedule(
    makeConfig({
      timeHorizonYears: 1,
      startDate: '2026-01-01T00:00:00.000Z',
      interest: { annualRate: 0.05, compounding },
      salary: { annualBase: 120_000, annualRaiseRate: 0 },
      contributions: [
        {
          type: 'flat',
          id: 'midpoint',
          amount: 100,
          timing: { frequency: 'annual', month: 0, day: 16, placement: 'end' }
        },
        {
          type: 'flat',
          id: 'after-midpoint',
          amount: 200,
          timing: { frequency: 'annual', month: 1, day: 15 }
        },
        {
          type: 'flat',
          id: 'placed-end',
          amount: 300,
          timing: { frequency: 'annual', month: 0, placement: 'end' }
        },
        {
          type: 'flat',
          id: 'one-time',
          amount: 1000,
          timing: { frequency: 'oneTime', on: { year: 0, month: 1, day: 20 } }
        },
        {
          type: 'flat',
          id: 'zero',
          amount: 0,
          timing: { frequency: 'annual', month: 0, placement: 'start' }
        },
        {
          type: 'flat',
          id: 'day-31',
          amount: 50,
          timing: { frequency: 'annual', month: 1, day: 31 }
        }
      ]
    })
  );
}

describe('buildSchedule', () => {
  it('lists one month per projection month with its calendar facts and salary', () => {
    const schedule = scheduleFor('monthly');

    expect(schedule.compounding).toBe('monthly');
    expect(schedule.months).toHaveLength(12);
    expect(schedule.months[1]).toStrictEqual({
      yearIndex: 0,
      monthIndex: 1,
      calendarYear: 2026,
      daysInMonth: 28,
      daysInYear: 365,
      salary: 120_000
    });
  });

  it('puts monthly-mode deposits in start or end, ordered by month then rule', () => {
    expect(datesAndBuckets(scheduleFor('monthly'))).toStrictEqual([
      {
        ruleId: 'midpoint',
        ruleIndex: 0,
        monthOffset: 0,
        dayOfMonth: 16,
        amount: 100,
        bucket: 'start'
      },
      {
        ruleId: 'placed-end',
        ruleIndex: 2,
        monthOffset: 0,
        dayOfMonth: 31,
        amount: 300,
        bucket: 'end'
      },
      {
        ruleId: 'after-midpoint',
        ruleIndex: 1,
        monthOffset: 1,
        dayOfMonth: 15,
        amount: 200,
        bucket: 'end'
      },
      {
        ruleId: 'one-time',
        ruleIndex: 3,
        monthOffset: 1,
        dayOfMonth: 20,
        amount: 1000,
        bucket: 'start'
      },
      { ruleId: 'day-31', ruleIndex: 5, monthOffset: 1, dayOfMonth: 28, amount: 50, bucket: 'end' }
    ]);
  });

  it('puts daily-mode deposits on their clamped day and keeps placement-only rules in their bucket', () => {
    expect(datesAndBuckets(scheduleFor('daily'))).toStrictEqual([
      { ruleId: 'midpoint', ruleIndex: 0, monthOffset: 0, dayOfMonth: 16, amount: 100, bucket: 16 },
      {
        ruleId: 'placed-end',
        ruleIndex: 2,
        monthOffset: 0,
        dayOfMonth: 31,
        amount: 300,
        bucket: 'end'
      },
      {
        ruleId: 'after-midpoint',
        ruleIndex: 1,
        monthOffset: 1,
        dayOfMonth: 15,
        amount: 200,
        bucket: 15
      },
      {
        ruleId: 'one-time',
        ruleIndex: 3,
        monthOffset: 1,
        dayOfMonth: 20,
        amount: 1000,
        bucket: 20
      },
      { ruleId: 'day-31', ruleIndex: 5, monthOffset: 1, dayOfMonth: 28, amount: 50, bucket: 28 }
    ]);
  });

  it('carries the rule type and the rule timing object on each deposit', () => {
    const config = makeConfig({
      timeHorizonYears: 1,
      contributions: [
        { type: 'salaryPercent', id: 'pct', amount: 5, timing: { frequency: 'monthly' } }
      ]
    });
    const [first] = buildSchedule(config).deposits;

    expect(first?.ruleType).toBe('salaryPercent');
    expect(first?.timing).toBe(config.contributions[0]?.timing);
  });

  it('keeps the day of two deposits that share a monthly bucket', () => {
    const onSecond = singleRuleSchedule({ frequency: 'monthly', day: 2 }, 'monthly');
    const onFifteenth = singleRuleSchedule({ frequency: 'monthly', day: 15 }, 'monthly');

    expect(onSecond.deposits[0]?.bucket).toBe('start');
    expect(onFifteenth.deposits[0]?.bucket).toBe('start');
    expect(onSecond.deposits[0]?.dayOfMonth).toBe(2);
    expect(onFifteenth.deposits[0]?.dayOfMonth).toBe(15);
  });

  it.each([
    [{ frequency: 'monthly', placement: 'start' }, 'start', 1],
    [{ frequency: 'monthly' }, 'start', 1],
    [{ frequency: 'monthly', day: 0, placement: 'end' }, 'end', 31],
    [{ frequency: 'monthly', placement: 'end' }, 'end', 31]
  ] satisfies Array<[ContributionTiming, string, number]>)(
    'keeps a placement-only daily rule %o in bucket %s on day %i',
    (timing, bucket, dayOfMonth) => {
      const [first] = singleRuleSchedule(timing, 'daily').deposits;

      expect(first?.bucket).toBe(bucket);
      expect(first?.dayOfMonth).toBe(dayOfMonth);
    }
  );

  it.each([
    ['monthly', 'start', 1],
    ['daily', 1, 1]
  ] as const)(
    'dates a one-time rule without a day on day 1 in %s mode',
    (compounding, bucket, dayOfMonth) => {
      const [first] = singleRuleSchedule(
        { frequency: 'oneTime', on: { year: 0, month: 3 } },
        compounding
      ).deposits;

      expect(first?.monthOffset).toBe(3);
      expect(first?.bucket).toBe(bucket);
      expect(first?.dayOfMonth).toBe(dayOfMonth);
    }
  );

  it.each([
    ['monthly', 'start'],
    ['daily', 30]
  ] as const)('clamps a one-time rule on day 31 of April in %s mode', (compounding, bucket) => {
    const [first] = singleRuleSchedule(
      { frequency: 'oneTime', on: { year: 0, month: 3, day: 31 } },
      compounding
    ).deposits;

    expect(first?.bucket).toBe(bucket);
    expect(first?.dayOfMonth).toBe(30);
  });
});
