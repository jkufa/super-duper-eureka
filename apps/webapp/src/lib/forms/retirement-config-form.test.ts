import { describe, expect, test } from 'vitest';
import type { RetirementConfig } from '@retirement/calculator/types';
import { applyRetirementConfigFormValues, toRetirementConfigFormDefaults } from './retirement-config-form';

describe('retirement-config-form', () => {
  test('maps salaryPercent custom variables to salary basis from timing frequency', () => {
    const baseConfig: RetirementConfig = {
      currentBalance: 0,
      timeHorizonYears: 10,
      startDate: '2026-01-01T00:00:00.000Z',
      interest: { annualRate: 0.05, variance: 0, compounding: 'monthly' },
      salary: { annualBase: 120000, annualRaiseRate: 0.03 },
      contributions: [
        {
          id: 'monthly-percent',
          name: 'Monthly Percent',
          type: 'salaryPercent',
          amount: 7,
          timing: { frequency: 'monthly', placement: 'start' },
        },
        {
          id: 'annual-percent',
          name: 'Annual Percent',
          type: 'salaryPercent',
          amount: 7,
          timing: { frequency: 'annual', month: 0, placement: 'start' },
        },
        {
          id: 'one-time-percent',
          name: 'One Time Percent',
          type: 'salaryPercent',
          amount: 7,
          timing: { frequency: 'oneTime', on: { year: 1, month: 2, day: 15 } },
        },
        {
          id: 'flat-monthly',
          name: 'Flat Monthly',
          type: 'flat',
          amount: 300,
          timing: { frequency: 'monthly', placement: 'end' },
        },
      ],
    };

    const values = toRetirementConfigFormDefaults(baseConfig);
    const next = applyRetirementConfigFormValues(baseConfig, values);

    expect(next.contributions.find(rule => rule.id === 'monthly-percent')?.salaryBasis).toBe('monthly');
    expect(next.contributions.find(rule => rule.id === 'annual-percent')?.salaryBasis).toBe('annual');
    expect(next.contributions.find(rule => rule.id === 'one-time-percent')?.salaryBasis).toBe('annual');
    expect(next.contributions.find(rule => rule.id === 'flat-monthly')?.salaryBasis).toBeUndefined();
  });
});
