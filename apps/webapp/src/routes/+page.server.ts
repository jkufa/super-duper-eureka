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

  return {
    config,
    debug: {
      eventDetails: {
        service_name: 'retirement-webapp',
        request_id: locals.requestId,
        session_id: 'web-session',
        run_id: 'preview-run',
        environment: process.env.NODE_ENV ?? 'development',
        runtime: 'node',
        event_type: 'retirement_calc_step',
        outcome: 'success',
      },
      configuration: {
        time_horizon_years: config.timeHorizonYears,
        start_date: config.startDate,
        current_balance: config.currentBalance,
        interest: config.interest,
        salary: config.salary,
        contributions_count: config.contributions.length,
      },
      steps: [
        {
          step_index: 0,
          year_index: 0,
          month_index: 0,
          compounding: 'monthly',
          annual_rate: config.interest.annualRate,
          days_in_month: 31,
          days_in_year: 365,
          balance_start: 75000,
          balance_end: 76357.8,
          interest_earned: 307.8,
          contributions_this_step: 1050,
          contributions_start: 550,
          contributions_end: 500,
          contributions_by_day: {},
          total_contributions: 1050,
          total_interest: 307.8,
          salary: 110000,
          active_contributions: [
            {
              id: '401k',
              type: 'salaryPercent',
              amount: 550,
              timing: { frequency: 'monthly', placement: 'start' },
            },
            {
              id: 'roth',
              type: 'flat',
              amount: 500,
              timing: { frequency: 'monthly', placement: 'end' },
            },
          ],
        },
        {
          step_index: 1,
          year_index: 0,
          month_index: 1,
          compounding: 'monthly',
          annual_rate: config.interest.annualRate,
          days_in_month: 28,
          days_in_year: 365,
          balance_start: 76357.8,
          balance_end: 77722.32,
          interest_earned: 314.52,
          contributions_this_step: 1050,
          contributions_start: 550,
          contributions_end: 500,
          contributions_by_day: {},
          total_contributions: 2100,
          total_interest: 622.32,
          salary: 110000,
          active_contributions: [
            {
              id: '401k',
              type: 'salaryPercent',
              amount: 550,
              timing: { frequency: 'monthly', placement: 'start' },
            },
            {
              id: 'roth',
              type: 'flat',
              amount: 500,
              timing: { frequency: 'monthly', placement: 'end' },
            },
          ],
        },
        {
          step_index: 2,
          year_index: 0,
          month_index: 2,
          compounding: 'monthly',
          annual_rate: config.interest.annualRate,
          days_in_month: 31,
          days_in_year: 365,
          balance_start: 77722.32,
          balance_end: 79093.66,
          interest_earned: 321.34,
          contributions_this_step: 1050,
          contributions_start: 550,
          contributions_end: 500,
          contributions_by_day: {},
          total_contributions: 3150,
          total_interest: 943.66,
          salary: 110000,
          active_contributions: [
            {
              id: '401k',
              type: 'salaryPercent',
              amount: 550,
              timing: { frequency: 'monthly', placement: 'start' },
            },
            {
              id: 'roth',
              type: 'flat',
              amount: 500,
              timing: { frequency: 'monthly', placement: 'end' },
            },
          ],
        },
      ],
    },
  };
};
