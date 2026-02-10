const REFERENCE_LEAP_YEAR = 2000;

export function getDaysInMonthForYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  return new Date(year, month, 0).getDate();
}

export function isValidMonthDay(month: number, day: number, year: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) return false;
  const daysInMonth = getDaysInMonthForYearMonth(year, month);
  if (!daysInMonth) return false;
  return day >= 1 && day <= daysInMonth;
}

/**
 * Validates annual recurring month/day values against a leap-year calendar.
 * This keeps Feb 29 valid while rejecting impossible dates like Feb 30.
 */
export function isValidAnnualMonthDay(month: number, day: number) {
  return isValidMonthDay(month, day, REFERENCE_LEAP_YEAR);
}

