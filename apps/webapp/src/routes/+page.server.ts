import type { PageServerLoad } from './$types';
import type { RetirementConfig } from '@retirement/calculator/types';

export const load: PageServerLoad = async ({ locals }) => {
  const config: RetirementConfig = {
    currentBalance: 10000,
    timeHorizonYears: 30,
    startDate: '2026-01-01T00:00:00.000Z',
    interest: {
      annualRate: 0.06,
      variance: 0.02,
      compounding: 'monthly',
    },
    salary: {
      annualBase: 90000,
      annualRaiseRate: 0.03,
    },
    contributions: [
      {
        id: 'monthly-contribution',
        name: 'Monthly contribution',
        type: 'flat',
        amount: 500,
        timing: { frequency: 'monthly', placement: 'end' },
      },
    ],
  };

  locals.logContext = {
    ...locals.logContext,
    feature: 'retirement-calculator',
    projection_years: config.timeHorizonYears,
    contribution_rule_count: config.contributions.length,
  };

  return { config };
};
