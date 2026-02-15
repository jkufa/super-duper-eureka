import {
  normalizeCustomVariableInput,
  validateCustomVariableInput,
  type NormalizeCustomVariableInput,
} from '@retirement/calculator';
import {
  parseCustomVariableTimingText,
  type ParsedCustomVariableTiming,
} from '$lib/forms/frequency-nlp';

export interface TimingParseContext {
  referenceDate: Date;
  projectionStartYear: number;
  horizonYears: number;
}

export interface StructuredTimingFallback {
  frequency: ParsedCustomVariableTiming['frequency'];
  day: number;
  month: number;
  year: number;
  yearStart: number;
  yearEnd: number;
}

export type ResolvedParsedTiming = ParsedCustomVariableTiming;

interface ValidateAndNormalizeInput extends NormalizeCustomVariableInput { parsedTiming: ResolvedParsedTiming }

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toCustomVariableId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const token = Math.random().toString(36).slice(2, 8);
  return `custom-${slug || 'variable'}-${token}`;
}

export function parseCustomVariableTiming(
  input: string,
  context: TimingParseContext,
) {
  return parseCustomVariableTimingText(input, context);
}

export function resolveParsedTimingOrStructured(
  input: string,
  fallback: StructuredTimingFallback,
  context: TimingParseContext,
): ResolvedParsedTiming | null {
  const parsed = parseCustomVariableTiming(input, context);
  if (parsed) return parsed;
  if (input.trim().length > 0) return null;

  return {
    ...fallback,
    day: toFiniteNumber(fallback.day, 1),
    month: toFiniteNumber(fallback.month, 1),
    year: toFiniteNumber(fallback.year, context.projectionStartYear),
    yearStart: toFiniteNumber(fallback.yearStart, 0),
    yearEnd: toFiniteNumber(fallback.yearEnd, Math.max(0, context.horizonYears)),
    summary: '',
  };
}

export function validateAndNormalizeCustomVariableInput(input: ValidateAndNormalizeInput) {
  const validationError = validateCustomVariableInput(
    {
      name: input.name,
      amount: input.amount,
      yearStart: input.parsedTiming.yearStart,
      yearEnd: input.parsedTiming.yearEnd,
      growthEnabled: input.growthEnabled,
      growthAmount: input.growthAmount,
    },
    {
      frequency: input.parsedTiming.frequency,
      day: input.parsedTiming.day,
      month: input.parsedTiming.month,
      year: input.parsedTiming.year,
    },
  );
  if (validationError) {
    return { error: validationError as string, normalized: null };
  }

  const normalized = normalizeCustomVariableInput(
    {
      ...input,
      yearStart: input.parsedTiming.yearStart,
      yearEnd: input.parsedTiming.yearEnd,
    },
    {
      frequency: input.parsedTiming.frequency,
      day: input.parsedTiming.day,
      month: input.parsedTiming.month,
      year: input.parsedTiming.year,
    },
  );

  return {
    error: null,
    normalized,
  };
}
