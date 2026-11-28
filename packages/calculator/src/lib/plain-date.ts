export interface PlainDate {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
}

const MONTHS_PER_YEAR = 12;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

/** The day is clamped to the last day of the resulting month. */
export function addMonths(date: PlainDate, months: number): PlainDate {
  const monthsSinceYearZero = date.year * MONTHS_PER_YEAR + date.month - 1 + months;
  const year = Math.floor(monthsSinceYearZero / MONTHS_PER_YEAR);
  const month = monthsSinceYearZero - year * MONTHS_PER_YEAR + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function parsePlainDate(text: string): PlainDate | undefined {
  const match = DATE_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const isRealDate =
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
