export const CUSTOM_VARIABLE_VALIDATION_ERRORS = {
  nameRequired: 'Variable name is required.',
  amountInvalid: 'Amount must be 0 or greater.',
  yearRangeInvalid: 'Year range is invalid.',
  dayInvalid: 'Day must be between 1 and 31.',
  monthInvalid: 'Month must be between 1 and 12.',
  yearInvalid: 'Year must be between 2000 and 2200.',
  growthAmountInvalid: 'Growth amount must be 0 or greater.',
} as const;

export type CustomVariableFrequency = 'monthly' | 'annual' | 'oneTime';
export type CustomVariableType = 'flat' | 'salaryPercent';
export type CustomVariablePlacement = 'start' | 'end';
export type CustomVariableGrowthType = 'percent' | 'flat';
export type CustomVariableGrowthCadence = 'annual' | 'monthly';

export interface ParsedCustomVariableTimingInput {
  frequency: CustomVariableFrequency;
  day: number;
  month: number;
  year: number;
}

export interface ValidateCustomVariableInput {
  name: string;
  amount: number;
  yearStart: number;
  yearEnd: number;
  growthEnabled: boolean;
  growthAmount: number;
}

export interface NormalizeCustomVariableInput {
  name: string;
  type: CustomVariableType;
  amount: number;
  placement: CustomVariablePlacement;
  timingNaturalText: string;
  yearStart: number;
  yearEnd: number;
  growthEnabled: boolean;
  growthType: CustomVariableGrowthType;
  growthAmount: number;
  growthCadence: CustomVariableGrowthCadence;
}

export interface NormalizedCustomVariableInput {
  name: string;
  type: CustomVariableType;
  amount: number;
  frequency: CustomVariableFrequency;
  placement: CustomVariablePlacement;
  timingNaturalText: string;
  timingDay: number;
  timingMonth: number;
  timingYear: number;
  yearStart: number;
  yearEnd: number;
  growthEnabled: boolean;
  growthType: CustomVariableGrowthType;
  growthAmount: number;
  growthCadence: CustomVariableGrowthCadence;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function validateCustomVariableInput(
  input: ValidateCustomVariableInput,
  parsedTiming: ParsedCustomVariableTimingInput,
) {
  if (!input.name.trim()) return CUSTOM_VARIABLE_VALIDATION_ERRORS.nameRequired;
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return CUSTOM_VARIABLE_VALIDATION_ERRORS.amountInvalid;
  }
  if (!Number.isFinite(input.yearStart) || !Number.isFinite(input.yearEnd) || input.yearEnd < input.yearStart) {
    return CUSTOM_VARIABLE_VALIDATION_ERRORS.yearRangeInvalid;
  }
  if (!Number.isFinite(parsedTiming.day) || parsedTiming.day < 1 || parsedTiming.day > 31) {
    return CUSTOM_VARIABLE_VALIDATION_ERRORS.dayInvalid;
  }
  if (
    (parsedTiming.frequency === 'annual' || parsedTiming.frequency === 'oneTime')
    && (!Number.isFinite(parsedTiming.month) || parsedTiming.month < 1 || parsedTiming.month > 12)
  ) {
    return CUSTOM_VARIABLE_VALIDATION_ERRORS.monthInvalid;
  }
  if (
    parsedTiming.frequency === 'oneTime'
    && (!Number.isFinite(parsedTiming.year) || parsedTiming.year < 2000 || parsedTiming.year > 2200)
  ) {
    return CUSTOM_VARIABLE_VALIDATION_ERRORS.yearInvalid;
  }
  if (input.growthEnabled && (!Number.isFinite(input.growthAmount) || input.growthAmount < 0)) {
    return CUSTOM_VARIABLE_VALIDATION_ERRORS.growthAmountInvalid;
  }

  return null;
}

export function normalizeCustomVariableInput(
  input: NormalizeCustomVariableInput,
  parsedTiming: ParsedCustomVariableTimingInput,
): NormalizedCustomVariableInput {
  const normalizedYearStart = Math.max(0, Math.trunc(input.yearStart));
  const normalizedYearEnd = Math.max(normalizedYearStart, Math.trunc(input.yearEnd));

  return {
    name: input.name.trim(),
    type: input.type,
    amount: input.amount,
    frequency: parsedTiming.frequency,
    placement: input.placement,
    timingNaturalText: input.timingNaturalText,
    timingDay: clampInteger(parsedTiming.day, 1, 31),
    timingMonth: clampInteger(parsedTiming.month, 1, 12),
    timingYear: clampInteger(parsedTiming.year, 2000, 2200),
    yearStart: normalizedYearStart,
    yearEnd: normalizedYearEnd,
    growthEnabled: input.growthEnabled,
    growthType: input.growthType,
    growthAmount: Math.max(0, input.growthAmount),
    growthCadence: input.growthCadence,
  };
}
