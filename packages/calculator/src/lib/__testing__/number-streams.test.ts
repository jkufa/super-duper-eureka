import { describe, expect, it } from 'vite-plus/test';

import { formatStreamValue, stepStream } from './number-streams';
import type { StepStreamRow } from './number-streams';

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

describe('number streams', () => {
  it('writes negative zero as -0', () => {
    expect(formatStreamValue(-0)).toBe('-0');
    expect(formatStreamValue(0)).toBe('0');
    expect(stepStream({ summary, steps: [{ ...step, interestEarned: -0 }] })).not.toBe(
      stepStream({ summary, steps: [step] })
    );
  });

  it('writes the step fields, the days in day order, then the active contributions', () => {
    expect(stepStream({ summary, steps: [step] })).toBe(
      '1,0,0,100,0,0,0,100,100,0,0,0,0,0,0,0,0,31,365,"daily",3,1,20,2,"rule","flat",3'
    );
  });

  it('quotes text, so an id with a comma cannot pass for two values', () => {
    expect(formatStreamValue('a,b')).toBe('"a,b"');
    expect(formatStreamValue('1')).not.toBe(formatStreamValue(1));
  });
});
