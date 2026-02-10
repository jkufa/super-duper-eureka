import { describe, expect, test, vi } from 'vitest';
import { TIMING_PARSE_ERROR_MESSAGE } from '$lib/forms/frequency-nlp';
import { buildCreatedCustomVariable, buildSavedCustomVariable } from './custom-variable-editor-actions';

const baseInput = {
  currentYear: 2026,
  horizonYears: 40,
  referenceDate: new Date('2026-02-10T12:00:00.000Z'),
};

describe('custom-variable-editor-actions', () => {
  test('buildCreatedCustomVariable creates a hybrid-mode variable', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const result = buildCreatedCustomVariable({
      ...baseInput,
      name: ' Bonus Income ',
      type: 'flat',
      amount: 1500,
      placement: 'end',
      timingNaturalText: 'every feb 13',
      timing: {
        frequency: 'monthly',
        day: 1,
        month: 1,
        year: 2026,
        yearStart: 0,
        yearEnd: 40,
      },
      growth: {
        enabled: false,
        type: 'percent',
        amount: 0,
        cadence: 'annual',
      },
    });

    expect(result.error).toBeNull();
    expect(result.variable).toEqual(
      expect.objectContaining({
        name: 'Bonus Income',
        frequency: 'annual',
        timingMonth: 2,
        timingDay: 13,
        timingInputMode: 'hybrid',
      }),
    );
    expect(result.variable?.id).toContain('custom-bonus-income-');

    randomSpy.mockRestore();
  });

  test('buildSavedCustomVariable preserves id and applies normalized values', () => {
    const result = buildSavedCustomVariable({
      ...baseInput,
      id: 'custom-existing-id',
      name: 'Updated Bonus',
      type: 'percent',
      amount: 2.5,
      placement: 'start',
      timingNaturalText: '',
      timing: {
        frequency: 'monthly',
        day: 15,
        month: 1,
        year: 2026,
        yearStart: 2,
        yearEnd: 10,
      },
      growth: {
        enabled: true,
        type: 'flat',
        amount: 100,
        cadence: 'monthly',
      },
    });

    expect(result.error).toBeNull();
    expect(result.variable).toEqual(
      expect.objectContaining({
        id: 'custom-existing-id',
        name: 'Updated Bonus',
        timingInputMode: 'hybrid',
        frequency: 'monthly',
        timingDay: 15,
        yearStart: 2,
        yearEnd: 10,
      }),
    );
  });

  test('returns timing parse error when natural language text is invalid', () => {
    const result = buildCreatedCustomVariable({
      ...baseInput,
      name: 'Invalid Timing',
      type: 'flat',
      amount: 100,
      placement: 'end',
      timingNaturalText: 'every banana',
      timing: {
        frequency: 'monthly',
        day: 1,
        month: 1,
        year: 2026,
        yearStart: 0,
        yearEnd: 40,
      },
      growth: {
        enabled: false,
        type: 'percent',
        amount: 0,
        cadence: 'annual',
      },
    });

    expect(result).toEqual({
      error: TIMING_PARSE_ERROR_MESSAGE,
      variable: null,
    });
  });
});
