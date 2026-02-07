import type { RetirementConfig } from '@retirement/calculator/types';
import { z } from 'zod/v4';

export const retirementConfigFormSchema = z.object({
  currentBalance: z.coerce.number().min(0, 'Current investments must be positive'),
  annualReturnPct: z.coerce.number().min(0).max(50),
  variancePct: z.coerce.number().min(0).max(50),
  yearsToRetirement: z.coerce.number().int().min(1).max(80),
  compounding: z.enum(['monthly', 'daily']),
  baseSalary: z.coerce.number().min(0),
  annualRaisePct: z.coerce.number().min(0).max(50),
  monthlyContribution: z.coerce.number().min(0)
});

export type RetirementConfigFormValues = z.infer<typeof retirementConfigFormSchema>;

const toPercent = (value: number | undefined) => Number(((value ?? 0) * 100).toFixed(2));

export function toRetirementConfigFormDefaults(config: RetirementConfig): RetirementConfigFormValues {
  const monthlyContribution
    = config.contributions.find((rule) => rule.timing.frequency === 'monthly' && rule.type === 'flat')
      ?.amount ?? 0;

  return {
    currentBalance: config.currentBalance,
    annualReturnPct: toPercent(config.interest.annualRate),
    variancePct: toPercent(config.interest.variance),
    yearsToRetirement: config.timeHorizonYears,
    compounding: config.interest.compounding ?? 'monthly',
    baseSalary: config.salary.annualBase,
    annualRaisePct: toPercent(config.salary.annualRaiseRate),
    monthlyContribution
  };
}
