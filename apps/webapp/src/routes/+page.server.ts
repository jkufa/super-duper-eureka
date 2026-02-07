import type { PageServerLoad } from './$types';
import type { RetirementConfig } from '@retirement/calculator/types';
import { createRandomSeed, generateRandomRetirementConfig } from '@retirement/calculator';
import { MOCK_REAL_DATA } from '$env/static/private';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import {
  retirementConfigFormSchema,
  toRetirementConfigFormDefaults,
} from '$lib/forms/retirement-config-form';

export const load: PageServerLoad = async ({ locals }) => {
  const mockRealData = MOCK_REAL_DATA === 'true';
  const seed = mockRealData ? createRandomSeed() : null;

  const config: RetirementConfig
    = mockRealData && seed !== null
      ? generateRandomRetirementConfig(seed)
      : {
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
    mock_real_data: mockRealData,
    mock_seed: seed ?? undefined,
  };

  const configForm = await superValidate(zod4(retirementConfigFormSchema), { defaults: toRetirementConfigFormDefaults(config) });

  return {
    config,
    configForm,
    mock: {
      enabled: mockRealData,
      seed,
    },
    logContext: locals.logContext,
  };
};
