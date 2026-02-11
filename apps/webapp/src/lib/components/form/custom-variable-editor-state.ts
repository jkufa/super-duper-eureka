import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

type CustomVariable = RetirementConfigFormValues['customVariables'][number];
type CustomVariableDraft = RetirementConfigFormValues['customVariableDraft'];

export type DraftResetState = CustomVariableDraft;

function toYearOffset(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.trunc(fallback));
  return Math.max(0, Math.trunc(parsed));
}

function toStartBoundDate(yearOffset: unknown, now: Date, currentYear: number) {
  const startOffset = toYearOffset(yearOffset);
  if (startOffset === 0) {
    return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
  return new CalendarDate(currentYear + startOffset, 1, 1);
}

function toEndBoundDate(yearOffset: unknown, currentYear: number, fallback = 0) {
  const endOffset = toYearOffset(yearOffset, fallback);
  return new CalendarDate(currentYear + endOffset, 12, 31);
}

export function toParsedCalendarDate(year: unknown, month: unknown, day: unknown) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  return new CalendarDate(Math.trunc(Number(year)), Math.trunc(Number(month)), Math.trunc(Number(day)));
}

export function toCalendarBounds(input: {
  yearStart: unknown;
  yearEndRaw: unknown;
  isOneTime: boolean;
  horizonYears: number;
  now: Date;
  currentYear: number;
}) {
  const minDate = toStartBoundDate(input.yearStart, input.now, input.currentYear);
  const startOffset = toYearOffset(input.yearStart);
  const endOffsetRaw = input.isOneTime ? input.horizonYears : input.yearEndRaw;
  const endOffset = Math.max(startOffset, toYearOffset(endOffsetRaw, startOffset));
  const maxDate = toEndBoundDate(endOffset, input.currentYear, startOffset);

  return { minDate, maxDate };
}

export function formatCustomVariableDate(date: DateValue | undefined) {
  if (!date) return '';
  return date.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function toCustomVariableDraftState(variable: CustomVariable): CustomVariableDraft {
  return {
    name: variable.name,
    type: variable.type,
    amount: variable.amount,
    frequency: variable.frequency,
    placement: variable.placement,
    timingNaturalText: variable.timingNaturalText,
    timingDay: variable.timingDay,
    timingMonth: variable.timingMonth,
    timingYear: variable.timingYear,
    yearStart: variable.yearStart,
    yearEnd: variable.yearEnd,
    growthEnabled: variable.growthEnabled,
    growthType: variable.growthType,
    growthAmount: variable.growthAmount,
    growthCadence: variable.growthCadence,
    timingInputMode: 'hybrid',
  };
}

export function toDraftResetState(currentYear: number, horizonYears: number): DraftResetState {
  return {
    name: '',
    amount: 0,
    type: 'flat',
    frequency: 'monthly',
    placement: 'end',
    timingInputMode: 'hybrid',
    timingNaturalText: '',
    timingDay: 1,
    timingMonth: 1,
    timingYear: currentYear,
    yearStart: 0,
    yearEnd: horizonYears,
    growthEnabled: false,
    growthType: 'percent',
    growthAmount: 0,
    growthCadence: 'annual',
  };
}
