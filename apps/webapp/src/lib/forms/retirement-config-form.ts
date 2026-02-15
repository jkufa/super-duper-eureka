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

const customVariableDraftSchema = z.object({
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
});

export const retirementConfigFormSchema = z.object({
  currentBalance: z.coerce.number().min(0, 'Current investments must be positive'),
  annualReturnPct: z.coerce.number().min(0).max(50),
  variancePct: z.coerce.number().min(0).max(50),
  yearsToRetirement: z.coerce.number().int().min(1).max(80),
  compounding: z.enum(['monthly', 'daily']),
  baseSalary: z.coerce.number().min(0),
  annualRaisePct: z.coerce.number().min(0).max(50),
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
  customVariableDraft: customVariableDraftSchema,
  customVariableEditDraft: customVariableDraftSchema,
});

export type RetirementConfigFormValues = z.infer<typeof retirementConfigFormSchema>;

const toPercent = (value: number | undefined) => Number(((value ?? 0) * 100).toFixed(2));
const toDecimalRate = (value: number) => value / 100;
const toNumberOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function resolveSalaryBasis(
  item: RetirementConfigFormValues['customVariables'][number],
): 'annual' | 'monthly' | undefined {
  if (item.type !== 'salaryPercent') return undefined;
  if (item.frequency === 'monthly') return 'monthly';
  return 'annual';
}

export function toRetirementConfigFormDefaults(config: RetirementConfig): RetirementConfigFormValues {
  const now = new Date();
  const startDate = normalizeStartDate(config.startDate);
  const startYear = startDate.getFullYear();
  const customVariableDraftDefaults = {
    name: '',
    type: 'flat' as const,
    amount: 0,
    frequency: 'monthly' as const,
    placement: 'end' as const,
    timingInputMode: 'hybrid' as const,
    timingNaturalText: '',
    timingDay: 1,
    timingMonth: 1,
    timingYear: now.getFullYear(),
    yearStart: 0,
    yearEnd: config.timeHorizonYears,
    growthEnabled: false,
    growthType: 'percent' as const,
    growthAmount: 0,
    growthCadence: 'annual' as const,
  };

  return {
    currentBalance: config.currentBalance,
    annualReturnPct: toPercent(config.interest.annualRate),
    variancePct: toPercent(config.interest.variance),
    yearsToRetirement: config.timeHorizonYears,
    compounding: config.interest.compounding ?? 'monthly',
    baseSalary: config.salary.annualBase,
    annualRaisePct: toPercent(config.salary.annualRaiseRate),
    customVariables: config.contributions.map((rule) => {
      const yearStart = rule.yearRange?.start ?? 0;
      const yearEnd = rule.yearRange?.end ?? config.timeHorizonYears;

      if (rule.timing.frequency === 'oneTime') {
        const oneTimeYear = Math.max(0, rule.timing.on.year);
        return {
          id: rule.id,
          name: rule.name ?? rule.id,
          type: rule.type,
          amount: rule.amount,
          frequency: 'oneTime' as const,
          placement: 'start' as const,
          timingInputMode: 'hybrid' as const,
          timingNaturalText: '',
          timingDay: rule.timing.on.day ?? 1,
          timingMonth: rule.timing.on.month + 1,
          timingYear: startYear + oneTimeYear,
          yearStart: oneTimeYear,
          yearEnd: oneTimeYear,
          growthEnabled: Boolean(rule.growth),
          growthType: rule.growth?.type ?? 'percent',
          growthAmount: rule.growth?.amount ?? 0,
          growthCadence: rule.growth?.cadence ?? 'annual',
        };
      }

      if (rule.timing.frequency === 'annual') {
        return {
          id: rule.id,
          name: rule.name ?? rule.id,
          type: rule.type,
          amount: rule.amount,
          frequency: 'annual' as const,
          placement: rule.timing.placement ?? 'start',
          timingInputMode: 'hybrid' as const,
          timingNaturalText: '',
          timingDay: rule.timing.day ?? 1,
          timingMonth: rule.timing.month + 1,
          timingYear: startYear,
          yearStart,
          yearEnd,
          growthEnabled: Boolean(rule.growth),
          growthType: rule.growth?.type ?? 'percent',
          growthAmount: rule.growth?.amount ?? 0,
          growthCadence: rule.growth?.cadence ?? 'annual',
        };
      }

      return {
        id: rule.id,
        name: rule.name ?? rule.id,
        type: rule.type,
        amount: rule.amount,
        frequency: 'monthly' as const,
        placement: rule.timing.placement ?? 'start',
        timingInputMode: 'hybrid' as const,
        timingNaturalText: '',
        timingDay: rule.timing.day ?? 1,
        timingMonth: 1,
        timingYear: startYear,
        yearStart,
        yearEnd,
        growthEnabled: Boolean(rule.growth),
        growthType: rule.growth?.type ?? 'percent',
        growthAmount: rule.growth?.amount ?? 0,
        growthCadence: rule.growth?.cadence ?? 'annual',
      };
    }),
    customVariableDraft: { ...customVariableDraftDefaults },
    customVariableEditDraft: { ...customVariableDraftDefaults },
  };
}

export function applyRetirementConfigFormValues(
  baseConfig: RetirementConfig,
  values: RetirementConfigFormValues,
): RetirementConfig {
  const startDate = normalizeStartDate(baseConfig.startDate);
  const startYear = startDate.getFullYear();
  const nextContributions = values.customVariables.map((item) => {
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
      salaryBasis: resolveSalaryBasis(item),
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
    contributions: nextContributions,
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
