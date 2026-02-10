import { parseDate } from 'chrono-node';
import { isValidAnnualMonthDay } from '@retirement/calculator';

export type CustomVariableFrequency = 'monthly' | 'annual' | 'oneTime';

export interface ParseCustomVariableTimingOptions {
  referenceDate?: Date;
  projectionStartYear?: number;
  horizonYears: number;
}

export interface ParsedCustomVariableTiming {
  frequency: CustomVariableFrequency;
  day: number;
  month: number;
  year: number;
  yearStart: number;
  yearEnd: number;
  summary: string;
}

interface ParsedRange {
  startYear?: number;
  durationYears?: number;
  endYear?: number;
  cleanedInput: string;
}

const TIMING_PARSE_ERROR_MESSAGE =
  'Unable to parse that contribution frequency. Try "every 15th", "every Feb 13", "on 1/2/2027", "every 15th until 2030", or "every 15th for 10 years starting in 2028".';

const MONTH_LOOKUP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function normalizeWhitespace(input: string) {
  return input.trim().replace(/\s+/g, ' ');
}

function parseRangeModifiers(input: string): ParsedRange {
  let cleaned = input;
  let startYear: number | undefined;
  let durationYears: number | undefined;
  let endYear: number | undefined;

  const startYearPatterns = [
    /\bstarting\s+(?:in\s+)?(\d{4})\b/i,
    /\bbeginning\s+(?:in\s+)?(\d{4})\b/i,
    /\bfrom\s+(\d{4})\b/i,
    /\bstart\s+(?:in\s+)?(\d{4})\b/i,
  ];

  for (const pattern of startYearPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const parsedYear = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsedYear)) {
        startYear = parsedYear;
      }
      cleaned = cleaned.replace(match[0], ' ');
      break;
    }
  }

  const durationMatch = cleaned.match(/\bfor\s+(\d+)\s+(?:year|years|yr|yrs)\b/i);
  if (durationMatch) {
    const parsedDuration = Number.parseInt(durationMatch[1], 10);
    if (Number.isFinite(parsedDuration)) {
      durationYears = parsedDuration;
    }
    cleaned = cleaned.replace(durationMatch[0], ' ');
  }

  const untilMatch = cleaned.match(/\buntil\s+(\d{4})\b/i);
  if (untilMatch) {
    const parsedEndYear = Number.parseInt(untilMatch[1], 10);
    if (Number.isFinite(parsedEndYear)) {
      endYear = parsedEndYear;
    }
    cleaned = cleaned.replace(untilMatch[0], ' ');
  }

  return {
    startYear,
    durationYears,
    endYear,
    cleanedInput: normalizeWhitespace(cleaned),
  };
}

function parseRecurringTiming(input: string, referenceYear: number) {
  const normalized = input.toLowerCase();

  const monthlyPatterns = [
    /^(?:every|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of\s+(?:each|every)\s+month)?$/,
    /^monthly\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/,
    /^every\s+month\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/,
  ];

  for (const pattern of monthlyPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const day = Number.parseInt(match[1], 10);
    if (day >= 1 && day <= 31) {
      return {
        frequency: 'monthly' as const,
        day,
        month: 1,
        year: referenceYear,
        summary: `Parsed as monthly on day ${String(day)}.`,
      };
    }
  }

  const annualPatterns = [
    /^(?:every\s+year\s+on|every|on)\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/,
    /^annually\s+on\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/,
  ];

  for (const pattern of annualPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const monthToken = match[1];
    const month = MONTH_LOOKUP[monthToken];
    const day = Number.parseInt(match[2], 10);

    if (month && isValidAnnualMonthDay(month, day)) {
      return {
        frequency: 'annual' as const,
        day,
        month,
        year: referenceYear,
        summary: `Parsed as annual on ${monthToken} ${String(day)}.`,
      };
    }
  }

  return null;
}

function resolveYearRange(
  parsed: { frequency: CustomVariableFrequency; year: number },
  range: ParsedRange,
  projectionStartYear: number,
  horizonYears: number,
) {
  if (parsed.frequency === 'oneTime') {
    const oneTimeOffset = Math.max(0, parsed.year - projectionStartYear);
    return {
      yearStart: oneTimeOffset,
      yearEnd: oneTimeOffset,
      rangeSummary: `Applies once in ${String(parsed.year)}.`,
    };
  }

  const normalizedHorizon = Math.max(1, Math.trunc(horizonYears));
  const safeDuration = range.durationYears ? Math.max(1, Math.trunc(range.durationYears)) : undefined;
  const safeStartYear = range.startYear ? Math.trunc(range.startYear) : undefined;
  const safeEndYear = range.endYear ? Math.trunc(range.endYear) : undefined;

  const yearStart = safeStartYear ? Math.max(0, safeStartYear - projectionStartYear) : 0;
  const yearEndCandidates = [normalizedHorizon];
  if (safeDuration) yearEndCandidates.push(yearStart + safeDuration - 1);
  if (safeEndYear) yearEndCandidates.push(safeEndYear - projectionStartYear);
  const yearEnd = Math.min(
    normalizedHorizon,
    Math.max(yearStart, Math.min(...yearEndCandidates)),
  );

  const absoluteStartYear = projectionStartYear + yearStart;
  const absoluteEndYear = projectionStartYear + yearEnd;

  return {
    yearStart,
    yearEnd,
    rangeSummary: `Applies in years ${String(yearStart)}-${String(yearEnd)} (${String(absoluteStartYear)}-${String(absoluteEndYear)}).`,
  };
}

export function parseCustomVariableTimingText(
  input: string,
  options: ParseCustomVariableTimingOptions,
): ParsedCustomVariableTiming | null {
  const trimmed = normalizeWhitespace(input);
  if (!trimmed) return null;

  const referenceDate = options.referenceDate ?? new Date();
  const referenceYear = referenceDate.getFullYear();
  const projectionStartYear = options.projectionStartYear ?? referenceYear;

  const range = parseRangeModifiers(trimmed);
  const cleanedForTiming = range.cleanedInput;
  if (!cleanedForTiming) return null;

  const recurring = parseRecurringTiming(cleanedForTiming, referenceYear);
  if (recurring) {
    const resolvedRange = resolveYearRange(recurring, range, projectionStartYear, options.horizonYears);
    return {
      ...recurring,
      ...resolvedRange,
      summary: `${recurring.summary} ${resolvedRange.rangeSummary}`,
    };
  }

  const parsedDate = parseDate(cleanedForTiming, referenceDate, { forwardDate: true });
  if (!parsedDate) return null;

  const day = parsedDate.getDate();
  const month = parsedDate.getMonth() + 1;
  const year = parsedDate.getFullYear();
  const formatted = parsedDate.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const resolvedRange = resolveYearRange(
    { frequency: 'oneTime', year },
    range,
    projectionStartYear,
    options.horizonYears,
  );

  return {
    frequency: 'oneTime',
    day,
    month,
    year,
    ...resolvedRange,
    summary: `Parsed as one-time on ${formatted}. ${resolvedRange.rangeSummary}`,
  };
}

export { TIMING_PARSE_ERROR_MESSAGE };
