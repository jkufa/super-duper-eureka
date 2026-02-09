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
  customVariables: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1),
      type: z.enum(['flat', 'salaryPercent']),
      amount: z.coerce.number().min(0),
      frequency: z.enum(['monthly', 'annual']),
      placement: z.enum(['start', 'end']),
      yearStart: z.coerce.number().int().min(0).max(80),
      yearEnd: z.coerce.number().int().min(0).max(80),
    }),
  ),
  customVariableDraft: z.object({
    name: z.string(),
    type: z.enum(['flat', 'salaryPercent']),
    amount: z.coerce.number().min(0),
    frequency: z.enum(['monthly', 'annual']),
    placement: z.enum(['start', 'end']),
    yearStart: z.coerce.number().int().min(0).max(80),
    yearEnd: z.coerce.number().int().min(0).max(80),
  }),
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
    customVariables: [],
    customVariableDraft: {
      name: '',
      type: 'flat',
      amount: 0,
      frequency: 'monthly',
      placement: 'end',
      yearStart: 0,
      yearEnd: config.timeHorizonYears,
    },
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

  const nextCustomContributions = values.customVariables.map((item) => {
    const yearStart = Math.max(0, Math.trunc(toNumberOr(item.yearStart, 0)));
    const yearEnd = Math.max(yearStart, Math.trunc(toNumberOr(item.yearEnd, baseConfig.timeHorizonYears)));

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      amount: toNumberOr(item.amount, 0),
      timing:
        item.frequency === 'annual'
          ? ({ frequency: 'annual' as const, month: 0, placement: item.placement })
          : ({ frequency: 'monthly' as const, placement: item.placement }),
      yearRange: {
        start: yearStart,
        end: yearEnd,
      },
    };
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
    contributions: [...nextContributions, ...nextCustomContributions],
  };
}
