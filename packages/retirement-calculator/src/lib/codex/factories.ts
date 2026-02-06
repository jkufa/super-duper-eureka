import type { ContributionRule, Interest, RetirementConfig, SalaryConfig } from './types';

const defaultInterest: Interest = {
  annualRate: 0.05,
  variance: 0,
  compounding: 'monthly',
};

const defaultSalary: SalaryConfig = {
  annualBase: 100000,
  annualRaiseRate: 0,
};

export function makeContribution(rule?: Partial<ContributionRule>): ContributionRule {
  return {
    id: rule?.id ?? 'contribution-1',
    name: rule?.name,
    enabled: rule?.enabled ?? true,
    type: rule?.type ?? 'flat',
    amount: rule?.amount ?? 0,
    salaryBasis: rule?.salaryBasis,
    timing: rule?.timing ?? { frequency: 'monthly', placement: 'start' },
    yearRange: rule?.yearRange,
  };
}

export function makeConfig(overrides?: Partial<RetirementConfig>): RetirementConfig {
  return {
    currentBalance: overrides?.currentBalance ?? 100000,
    timeHorizonYears: overrides?.timeHorizonYears ?? 30,
    startDate: overrides?.startDate ?? '2026-01-01T00:00:00.000Z',
    interest: { ...defaultInterest, ...(overrides?.interest ?? {}) },
    salary: { ...defaultSalary, ...(overrides?.salary ?? {}) },
    contributions: overrides?.contributions?.map(rule => makeContribution(rule)) ?? [],
  };
}
