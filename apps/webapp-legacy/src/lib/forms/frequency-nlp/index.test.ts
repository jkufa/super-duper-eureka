import { describe, expect, test } from 'vitest';
import {
  parseCustomVariableTimingText,
  TIMING_PARSE_ERROR_MESSAGE,
} from './index';

const referenceDate = new Date('2026-02-10T12:00:00.000Z');

function parse(input: string, horizonYears = 40) {
  return parseCustomVariableTimingText(input, {
    referenceDate,
    projectionStartYear: 2026,
    horizonYears,
  });
}

describe('parseCustomVariableTimingText', () => {
  test('parses monthly ordinal cadence', () => {
    const result = parse('every 15th');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'monthly',
        day: 15,
        month: 1,
        year: 2026,
        yearStart: 0,
        yearEnd: 40,
      }),
    );
  });

  test('parses monthly variants', () => {
    const result = parse('monthly on 3rd');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'monthly',
        day: 3,
      }),
    );
  });

  test('parses annual month/day cadence', () => {
    const result = parse('every feb 13');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'annual',
        day: 13,
        month: 2,
      }),
    );
  });

  test('parses annual variants', () => {
    const result = parse('annually on september 30');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'annual',
        day: 30,
        month: 9,
      }),
    );
  });

  test('parses one-time absolute date with chrono', () => {
    const result = parse('on 1/2/2027');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'oneTime',
        day: 2,
        month: 1,
        year: 2027,
        yearStart: 1,
        yearEnd: 1,
      }),
    );
  });

  test('parses recurrence with explicit duration and start year', () => {
    const result = parse('Every 15th for 10 years starting in 2028');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'monthly',
        day: 15,
        yearStart: 2,
        yearEnd: 11,
      }),
    );
  });

  test('supports beginning/from start year modifiers', () => {
    const beginning = parse('every feb 13 beginning in 2030');
    expect(beginning).toEqual(
      expect.objectContaining({
        frequency: 'annual',
        yearStart: 4,
        yearEnd: 40,
      }),
    );

    const from = parse('every feb 13 from 2028 for 2 years');
    expect(from).toEqual(
      expect.objectContaining({
        frequency: 'annual',
        yearStart: 2,
        yearEnd: 3,
      }),
    );
  });

  test('supports until end-year modifier', () => {
    const result = parse('every 15th until 2030');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'monthly',
        yearStart: 0,
        yearEnd: 4,
      }),
    );
  });

  test('supports starting + until end-year window', () => {
    const result = parse('every feb 13 starting in 2028 until 2030');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'annual',
        yearStart: 2,
        yearEnd: 4,
      }),
    );
  });

  test('uses earliest end when both for-duration and until are provided', () => {
    const result = parse('every 15th for 10 years until 2029');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'monthly',
        yearStart: 0,
        yearEnd: 3,
      }),
    );
  });

  test('clamps until earlier than start to start year', () => {
    const result = parse('every feb 13 starting in 2030 until 2028');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'annual',
        yearStart: 4,
        yearEnd: 4,
      }),
    );
  });

  test('clamps duration to projection horizon', () => {
    const result = parse('every 5th for 100 years starting in 2028', 30);
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'monthly',
        yearStart: 2,
        yearEnd: 30,
      }),
    );
  });

  test('ignores range modifiers for one-time and resolves single year', () => {
    const result = parse('on 03/10/2031 for 5 years starting in 2029');
    expect(result).toEqual(
      expect.objectContaining({
        frequency: 'oneTime',
        year: 2031,
        yearStart: 5,
        yearEnd: 5,
      }),
    );
  });

  test('returns null for unparseable input', () => {
    expect(parse('')).toBeNull();
    expect(parse('for 10 years')).toBeNull();
    expect(parse('until 2030')).toBeNull();
    expect(parse('every banana')).toBeNull();
    expect(parse('every feb 30')).toBeNull();
    expect(parse('every 45th')).toBeNull();
  });

  test('exports friendly parse error message with example phrase', () => {
    expect(TIMING_PARSE_ERROR_MESSAGE).toContain('every 15th');
    expect(TIMING_PARSE_ERROR_MESSAGE).toContain('starting in 2028');
  });
});
