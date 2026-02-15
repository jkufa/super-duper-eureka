import { describe, expect, test } from 'vitest';
import {
  CUSTOM_VARIABLE_VALIDATION_ERRORS,
  normalizeCustomVariableInput,
  validateCustomVariableInput,
} from '../utils/custom-variable';

describe('custom-variable domain utils', () => {
  test('validates happy-path input', () => {
    const error = validateCustomVariableInput(
      {
        name: 'Bonus',
        amount: 5000,
        yearStart: 0,
        yearEnd: 10,
        growthEnabled: true,
        growthAmount: 2,
      },
      {
        frequency: 'annual',
        day: 15,
        month: 2,
        year: 2026,
      },
    );

    expect(error).toBeNull();
  });

  test('returns expected validation errors', () => {
    expect(
      validateCustomVariableInput(
        {
          name: ' ',
          amount: 1,
          yearStart: 0,
          yearEnd: 1,
          growthEnabled: false,
          growthAmount: 0,
        },
        { frequency: 'monthly', day: 1, month: 1, year: 2026 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.nameRequired);

    expect(
      validateCustomVariableInput(
        {
          name: 'Bonus',
          amount: -1,
          yearStart: 0,
          yearEnd: 1,
          growthEnabled: false,
          growthAmount: 0,
        },
        { frequency: 'monthly', day: 1, month: 1, year: 2026 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.amountInvalid);

    expect(
      validateCustomVariableInput(
        {
          name: 'Bonus',
          amount: 1,
          yearStart: 3,
          yearEnd: 1,
          growthEnabled: false,
          growthAmount: 0,
        },
        { frequency: 'monthly', day: 1, month: 1, year: 2026 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.yearRangeInvalid);

    expect(
      validateCustomVariableInput(
        {
          name: 'Bonus',
          amount: 1,
          yearStart: 0,
          yearEnd: 1,
          growthEnabled: false,
          growthAmount: 0,
        },
        { frequency: 'monthly', day: 0, month: 1, year: 2026 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.dayInvalid);

    expect(
      validateCustomVariableInput(
        {
          name: 'Bonus',
          amount: 1,
          yearStart: 0,
          yearEnd: 1,
          growthEnabled: false,
          growthAmount: 0,
        },
        { frequency: 'annual', day: 2, month: 13, year: 2026 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.monthInvalid);

    expect(
      validateCustomVariableInput(
        {
          name: 'Bonus',
          amount: 1,
          yearStart: 0,
          yearEnd: 1,
          growthEnabled: false,
          growthAmount: 0,
        },
        { frequency: 'oneTime', day: 2, month: 2, year: 3000 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.yearInvalid);

    expect(
      validateCustomVariableInput(
        {
          name: 'Bonus',
          amount: 1,
          yearStart: 0,
          yearEnd: 1,
          growthEnabled: true,
          growthAmount: -0.5,
        },
        { frequency: 'monthly', day: 2, month: 2, year: 2026 },
      ),
    ).toBe(CUSTOM_VARIABLE_VALIDATION_ERRORS.growthAmountInvalid);
  });

  test('normalizes and clamps values', () => {
    const normalized = normalizeCustomVariableInput(
      {
        name: '  Bonus  ',
        type: 'flat',
        amount: 5000,
        placement: 'end',
        timingNaturalText: 'every 15th',
        yearStart: -3.2,
        yearEnd: -1.8,
        growthEnabled: true,
        growthType: 'percent',
        growthAmount: -4,
        growthCadence: 'annual',
      },
      {
        frequency: 'oneTime',
        day: 40.2,
        month: 0,
        year: 2500,
      },
    );

    expect(normalized).toEqual({
      name: 'Bonus',
      type: 'flat',
      amount: 5000,
      frequency: 'oneTime',
      placement: 'end',
      timingNaturalText: 'every 15th',
      timingDay: 31,
      timingMonth: 1,
      timingYear: 2200,
      yearStart: 0,
      yearEnd: 0,
      growthEnabled: true,
      growthType: 'percent',
      growthAmount: 0,
      growthCadence: 'annual',
    });
  });
});
