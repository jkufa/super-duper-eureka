import { describe, expect, it } from 'vite-plus/test';

import {
  addMonths,
  compareDates,
  daysInMonth,
  daysInYear,
  formatPlainDate,
  isLeapYear,
  parsePlainDate
} from '../plain-date';

describe('plain dates', () => {
  it.each([
    [1900, false],
    [2000, true],
    [2024, true],
    [2026, false],
    [2100, false]
  ])('treats %i as a leap year: %s', (year, leap) => {
    expect(isLeapYear(year)).toBe(leap);
    expect(daysInYear(year)).toBe(leap ? 366 : 365);
  });

  it('knows the days in each month', () => {
    const months = Array.from({ length: 12 }, (_, index) => index + 1);

    expect(months.map((month) => daysInMonth(2026, month))).toStrictEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ]);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
  });

  it('compares by year, then month, then day', () => {
    const date = { year: 2026, month: 5, day: 15 };

    expect(compareDates(date, { year: 2026, month: 5, day: 15 })).toBe(0);
    expect(compareDates(date, { year: 2027, month: 1, day: 1 })).toBeLessThan(0);
    expect(compareDates(date, { year: 2026, month: 4, day: 30 })).toBeGreaterThan(0);
    expect(compareDates(date, { year: 2026, month: 5, day: 16 })).toBeLessThan(0);
  });

  it.each([
    ['2026-11-15', 3, '2027-02-15'],
    ['2026-12-31', 1, '2027-01-31'],
    ['2026-01-15', -1, '2025-12-15'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2026-01-01', 120, '2036-01-01']
  ])('adds months to %s: %i gives %s', (from, months, expected) => {
    const date = parsePlainDate(from);
    if (!date) {
      throw new Error(`Bad fixture date ${from}.`);
    }

    expect(formatPlainDate(addMonths(date, months))).toBe(expected);
  });

  it.each([
    [{ year: 9999, month: 12, day: 31 }, 1],
    [{ year: 1, month: 1, day: 1 }, -1],
    [{ year: 2026, month: 1, day: 1 }, 12 * 8000]
  ])('throws a RangeError when adding months to %o leaves years 0001 to 9999', (date, months) => {
    expect(() => addMonths(date, months)).toThrow(RangeError);
  });

  it('reaches both ends of the year range', () => {
    expect(addMonths({ year: 9999, month: 11, day: 30 }, 1)).toStrictEqual({
      year: 9999,
      month: 12,
      day: 30
    });
    expect(addMonths({ year: 1, month: 2, day: 28 }, -1)).toStrictEqual({
      year: 1,
      month: 1,
      day: 28
    });
  });

  it.each(['2026-01-01', '2024-02-29', '0001-01-01', '9999-12-31', '2026-12-31'])(
    'parses and formats %s unchanged',
    (text) => {
      const date = parsePlainDate(text);

      expect(date && formatPlainDate(date)).toBe(text);
    }
  );

  it('parses into year, month 1 to 12 and day', () => {
    expect(parsePlainDate('2026-03-09')).toStrictEqual({ year: 2026, month: 3, day: 9 });
  });

  it.each([
    '2026-02-30',
    '2025-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-1-01',
    '26-01-01',
    '2026-01-01T00:00:00.000Z',
    ' 2026-01-01',
    '2026/01/01',
    '0000-01-01',
    '0000-12-31',
    '2026-01-01\n',
    '2026-01-01 ',
    '\t2026-01-01',
    '2026-01-01T00:00',
    '2026-01-01Z',
    '＋2026-01-01',
    '२०२६-01-01',
    ''
  ])('rejects %j', (text) => {
    expect(parsePlainDate(text)).toBeUndefined();
  });

  it.each([
    ['an array holding a date', ['2026-01-01']],
    ['a symbol', Symbol('2026-01-01')],
    ['a number', 20_260_101],
    ['null', null],
    ['an object with a matching string form', { toString: () => '2026-01-01' }]
  ])('rejects %s without coercing it', (_, value) => {
    expect(parsePlainDate(value)).toBeUndefined();
  });
});
