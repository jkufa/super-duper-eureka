import { describe, expect, it } from 'vite-plus/test';

import { formatStreamValue, monthlyStream, stepStream } from './number-streams';
import type { MonthlyStreamBand, MonthlyStreamRow, StepStreamRow } from './number-streams';

const step: StepStreamRow = {
  stepIndex: 0,
  yearIndex: 0,
  monthIndex: 0,
  balanceStart: 100,
  balanceEnd: 100,
  interestEarned: 0,
  contributionsThisStep: 0,
  totalContributions: 0,
  totalInterest: 0,
  contributionsStart: 0,
  contributionsEnd: 0,
  salary: 0,
  annualRate: 0,
  daysInMonth: 31,
  daysInYear: 365,
  compounding: 'daily',
  contributionsByDay: { 20: 2, 3: 1 },
  activeContributions: [{ id: 'rule', type: 'flat', amount: 3 }]
};
const summary = { totalSteps: 1, totalContributions: 0, totalInterest: 0, finalBalance: 100 };

const row: MonthlyStreamRow = {
  year: 0,
  month: 4,
  balance: 10,
  contributions: 2,
  interest: 1,
  salary: 50
};
const ones: MonthlyStreamRow = {
  year: 1,
  month: 1,
  balance: 1,
  contributions: 1,
  interest: 1,
  salary: 1
};

function band(monthly: Array<MonthlyStreamRow>): MonthlyStreamBand {
  return { finalBalance: 7, totalContributions: 8, totalGrowth: 9, monthly };
}

describe('number streams', () => {
  it('writes negative zero as -0', () => {
    expect(formatStreamValue(-0)).toBe('-0');
    expect(formatStreamValue(0)).toBe('0');
    expect(stepStream({ summary, steps: [{ ...step, interestEarned: -0 }] })).not.toBe(
      stepStream({ summary, steps: [step] })
    );
  });

  it('writes the summary, the step count, each step, its day pairs and its contributions', () => {
    expect(stepStream({ summary, steps: [step] })).toBe(
      '1,0,0,100,1,0,0,0,100,100,0,0,0,0,0,0,0,0,31,365,"daily",2,3,1,20,2,1,"rule","flat",3'
    );
  });

  it('writes each band with its totals and its row count before the rows', () => {
    expect(
      monthlyStream({ baseline: band([row]), positive: band([]), negative: band([row, row]) })
    ).toBe('7,8,9,1,0,4,10,2,1,50,7,8,9,0,7,8,9,2,0,4,10,2,1,50,0,4,10,2,1,50');
  });

  it('changes when a row moves from one band to the next', () => {
    expect(
      monthlyStream({ baseline: band([ones]), positive: band([]), negative: band([]) })
    ).not.toBe(monthlyStream({ baseline: band([]), positive: band([ones]), negative: band([]) }));
  });

  it('quotes text, so an id with a comma cannot pass for two values', () => {
    expect(formatStreamValue('a,b')).toBe('"a,b"');
    expect(formatStreamValue('1')).not.toBe(formatStreamValue(1));
  });
});
