import type { RetirementConfig } from '@retirement/calculator/types';
import { z } from 'zod/v4';

const customVariableTimingSchema = z.object({
  frequency: z.enum(['monthly', 'annual', 'oneTime']),
  placement: z.enum(['start', 'end']),
  timingInputMode: z.enum(['structured', 'naturalLanguage', 'hybrid']),
  timingNaturalText: z.string(),
  timingDay: z.coerce.number().int().min(1).max(31),
  timingMonth: z.coerce.number().int().min(1).max(12),
  timingYear: z.coerce.number().int().min(2000).max(2200),
});

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
      ...customVariableTimingSchema.shape,
      yearStart: z.coerce.number().int().min(0).max(80),
      yearEnd: z.coerce.number().int().min(0).max(80),
      growthEnabled: z.boolean(),
      growthType: z.enum(['percent', 'flat']),
      growthAmount: z.coerce.number().min(0),
      growthCadence: z.enum(['annual', 'monthly']),
    }),
  ),
  customVariableDraft: z.object({
    name: z.string(),
    type: z.enum(['flat', 'salaryPercent']),
    amount: z.coerce.number().min(0),
    ...customVariableTimingSchema.shape,
    yearStart: z.coerce.number().int().min(0).max(80),
    yearEnd: z.coerce.number().int().min(0).max(80),
    growthEnabled: z.boolean(),
    growthType: z.enum(['percent', 'flat']),
    growthAmount: z.coerce.number().min(0),
    growthCadence: z.enum(['annual', 'monthly']),
  }),
});

export type RetirementConfigFormValues = z.infer<typeof retirementConfigFormSchema>;

const toPercent = (value: number | undefined) => Number(((value ?? 0) * 100).toFixed(2));
const toDecimalRate = (value: number) => value / 100;
const toNumberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function toRetirementConfigFormDefaults(config: RetirementConfig): RetirementConfigFormValues {
  const now = new Date();
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
      timingInputMode: 'hybrid',
      timingNaturalText: '',
      timingDay: 1,
      timingMonth: 1,
      timingYear: now.getFullYear(),
      yearStart: 0,
      yearEnd: config.timeHorizonYears,
      growthEnabled: false,
      growthType: 'percent',
      growthAmount: 0,
      growthCadence: 'annual',
    },
  };
}

export function applyRetirementConfigFormValues(
  baseConfig: RetirementConfig,
  values: RetirementConfigFormValues,
): RetirementConfig {
  const startDate = normalizeStartDate(baseConfig.startDate);
  const startYear = startDate.getFullYear();
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
    const day = Math.max(1, Math.min(31, Math.trunc(toNumberOr(item.timingDay, 1))));
    const monthIndex = Math.max(0, Math.min(11, Math.trunc(toNumberOr(item.timingMonth, 1)) - 1));
    const absoluteYear = Math.trunc(toNumberOr(item.timingYear, startYear));
    const relativeYear = Math.max(0, absoluteYear - startYear);

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      amount: toNumberOr(item.amount, 0),
      growth:
        item.growthEnabled
          ? {
              type: item.growthType,
              amount: toNumberOr(item.growthAmount, 0),
              cadence: item.growthCadence,
            }
          : undefined,
      timing:
        item.frequency === 'oneTime'
          ? ({ frequency: 'oneTime' as const, on: { year: relativeYear, month: monthIndex, day } })
          : item.frequency === 'annual'
              ? ({ frequency: 'annual' as const, month: monthIndex, day, placement: item.placement })
              : ({ frequency: 'monthly' as const, day, placement: item.placement }),
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

function normalizeStartDate(startDate?: Date | string) {
  if (!startDate) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (typeof startDate === 'string') {
    const parsed = new Date(startDate);
    return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
}
