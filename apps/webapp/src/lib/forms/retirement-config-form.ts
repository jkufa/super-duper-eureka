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
  contributionVariables: z.array(
    z.object({
      id: z.string(),
      amount: z.coerce.number().min(0),
    }),
  ),
});

export type RetirementConfigFormValues = z.infer<typeof retirementConfigFormSchema>;

const toPercent = (value: number | undefined) => Number(((value ?? 0) * 100).toFixed(2));
const toDecimalRate = (value: number) => value / 100;
const toNumberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function toRetirementConfigFormDefaults(config: RetirementConfig): RetirementConfigFormValues {
  return {
    currentBalance: config.currentBalance,
    annualReturnPct: toPercent(config.interest.annualRate),
    variancePct: toPercent(config.interest.variance),
    yearsToRetirement: config.timeHorizonYears,
    compounding: config.interest.compounding ?? 'monthly',
    baseSalary: config.salary.annualBase,
    annualRaisePct: toPercent(config.salary.annualRaiseRate),
    contributionVariables: config.contributions.map((rule) => ({
      id: rule.id,
      amount: rule.amount,
    })),
  };
}

export function applyRetirementConfigFormValues(
  baseConfig: RetirementConfig,
  values: RetirementConfigFormValues,
): RetirementConfig {
  const contributionAmountById = new Map(
    values.contributionVariables.map((item) => [item.id, toNumberOr(item.amount, 0)]),
  );
  const nextContributions = baseConfig.contributions.map((rule) => {
    const nextAmount = contributionAmountById.get(rule.id);
    if (typeof nextAmount === 'number') {
      return { ...rule, amount: nextAmount };
    }
    return rule;
  });

  return {
    ...baseConfig,
    currentBalance: toNumberOr(values.currentBalance, baseConfig.currentBalance),
    timeHorizonYears: Math.max(1, Math.trunc(toNumberOr(values.yearsToRetirement, baseConfig.timeHorizonYears))),
    interest: {
      ...baseConfig.interest,
      annualRate: toDecimalRate(toNumberOr(values.annualReturnPct, baseConfig.interest.annualRate * 100)),
      variance: toDecimalRate(toNumberOr(values.variancePct, (baseConfig.interest.variance ?? 0) * 100)),
      compounding: values.compounding,
    },
    salary: {
      ...baseConfig.salary,
      annualBase: toNumberOr(values.baseSalary, baseConfig.salary.annualBase),
      annualRaiseRate: toDecimalRate(toNumberOr(values.annualRaisePct, (baseConfig.salary.annualRaiseRate ?? 0) * 100)),
    },
    contributions: nextContributions,
  };
}
