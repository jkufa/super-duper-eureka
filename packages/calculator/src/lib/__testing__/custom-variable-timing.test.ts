import { describe, expect, test } from 'vitest';
import {
  getDaysInMonthForYearMonth,
  isValidAnnualMonthDay,
  isValidMonthDay,
} from '../utils/custom-variable-timing';

describe('custom-variable-timing utils', () => {
  test('returns days in month for valid month and year', () => {
    expect(getDaysInMonthForYearMonth(2024, 2)).toBe(29);
    expect(getDaysInMonthForYearMonth(2025, 2)).toBe(28);
    expect(getDaysInMonthForYearMonth(2026, 1)).toBe(31);
  });

  test('returns null for invalid month values', () => {
    expect(getDaysInMonthForYearMonth(2026, 0)).toBeNull();
    expect(getDaysInMonthForYearMonth(2026, 13)).toBeNull();
  });

  test('validates exact month/day/year combinations', () => {
    expect(isValidMonthDay(2, 29, 2024)).toBe(true);
    expect(isValidMonthDay(2, 29, 2025)).toBe(false);
    expect(isValidMonthDay(2, 30, 2024)).toBe(false);
    expect(isValidMonthDay(4, 31, 2026)).toBe(false);
    expect(isValidMonthDay(12, 31, 2026)).toBe(true);
  });

  test('validates annual recurring values using leap-year reference', () => {
    expect(isValidAnnualMonthDay(2, 29)).toBe(true);
    expect(isValidAnnualMonthDay(2, 30)).toBe(false);
    expect(isValidAnnualMonthDay(4, 31)).toBe(false);
    expect(isValidAnnualMonthDay(9, 30)).toBe(true);
  });
});
