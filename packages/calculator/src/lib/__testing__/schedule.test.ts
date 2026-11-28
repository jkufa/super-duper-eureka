import { describe, expect, it } from 'vite-plus/test';

import { makeConfig } from '../factories';
import { buildSchedule } from '../schedule';
import type { CompoundingFrequency } from '../types';

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
      daysInMonth: 28,
      daysInYear: 365,
      salary: 120_000
    });
  });

  it('puts monthly-mode deposits in start or end, ordered by month then rule', () => {
    expect(scheduleFor('monthly').deposits).toStrictEqual([
      { ruleId: 'midpoint', ruleIndex: 0, monthOffset: 0, amount: 100, bucket: 'start' },
      { ruleId: 'placed-end', ruleIndex: 2, monthOffset: 0, amount: 300, bucket: 'end' },
      { ruleId: 'after-midpoint', ruleIndex: 1, monthOffset: 1, amount: 200, bucket: 'end' },
      { ruleId: 'one-time', ruleIndex: 3, monthOffset: 1, amount: 1000, bucket: 'start' },
      { ruleId: 'day-31', ruleIndex: 5, monthOffset: 1, amount: 50, bucket: 'end' }
    ]);
  });

  it('puts daily-mode deposits on their clamped day and keeps placement-only rules in their bucket', () => {
    expect(scheduleFor('daily').deposits).toStrictEqual([
      { ruleId: 'midpoint', ruleIndex: 0, monthOffset: 0, amount: 100, bucket: 16 },
      { ruleId: 'placed-end', ruleIndex: 2, monthOffset: 0, amount: 300, bucket: 'end' },
      { ruleId: 'after-midpoint', ruleIndex: 1, monthOffset: 1, amount: 200, bucket: 15 },
      { ruleId: 'one-time', ruleIndex: 3, monthOffset: 1, amount: 1000, bucket: 20 },
      { ruleId: 'day-31', ruleIndex: 5, monthOffset: 1, amount: 50, bucket: 28 }
    ]);
  });

  it('puts a one-time rule without a day on day 1 in daily mode', () => {
    const schedule = buildSchedule(
      makeConfig({
        timeHorizonYears: 1,
        interest: { annualRate: 0.05, compounding: 'daily' },
        contributions: [
          {
            type: 'flat',
            id: 'once',
            amount: 10,
            timing: { frequency: 'oneTime', on: { year: 0, month: 3 } }
          }
        ]
      })
    );

    expect(schedule.deposits).toStrictEqual([
      { ruleId: 'once', ruleIndex: 0, monthOffset: 3, amount: 10, bucket: 1 }
    ]);
  });
});
