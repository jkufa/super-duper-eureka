export interface PlainDate {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  readonly day: number;
}

const MONTHS_PER_YEAR = 12;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const FIRST_YEAR = 1;
const LAST_YEAR = 9999;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  const days = DAYS_IN_MONTH[month - 1];
  if (days === undefined) {
    throw new RangeError(`Month ${String(month)} is outside 1 to 12.`);
  }
  return days;
}

export function compareDates(a: PlainDate, b: PlainDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function isSupportedYear(year: number): boolean {
  return year >= FIRST_YEAR && year <= LAST_YEAR;
}

/**
 * The day is clamped to the last day of the resulting month.
 * Throws a RangeError when the result falls outside years 0001 to 9999.
 */
export function addMonths(date: PlainDate, months: number): PlainDate {
  const monthsSinceYearZero = date.year * MONTHS_PER_YEAR + date.month - 1 + months;
  const year = Math.floor(monthsSinceYearZero / MONTHS_PER_YEAR);
  const month = monthsSinceYearZero - year * MONTHS_PER_YEAR + 1;
  if (!isSupportedYear(year)) {
    throw new RangeError(
      `Adding ${String(months)} months to ${formatPlainDate(date)} leaves years 0001 to 9999.`
    );
  }
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function parsePlainDate(text: unknown): PlainDate | undefined {
  if (typeof text !== 'string') {
    return undefined;
  }
  const match = DATE_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const isRealDate =
    isSupportedYear(date.year) &&
    date.month >= 1 &&
    date.month <= MONTHS_PER_YEAR &&
    date.day >= 1 &&
    date.day <= daysInMonth(date.year, date.month);
  return isRealDate ? date : undefined;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export function formatPlainDate(date: PlainDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}
