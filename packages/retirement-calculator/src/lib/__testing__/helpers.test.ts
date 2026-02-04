import { isVariableActive } from '../calculator';
import type { CustomVariable } from '../types';

const BASE_VARIABLE = {
  id: '1',
  name: 'Test',
  enabled: true,
  contribution: { type: 'flat', amount: 1000 },
} as const satisfies Omit<CustomVariable, 'timing'>;

const BASE_VARIABLE_ONE_TIME = {
  ...BASE_VARIABLE,
  timing: {
    frequency: 'oneTime',
    year: 6,
    month: 1,
    yearRange: {
      start: 0,
      end: 10,
    },
  },
} as const satisfies CustomVariable;

const BASE_VARIABLE_ANNUAL = {
  ...BASE_VARIABLE,
  timing: {
    frequency: 'annual',
    month: 0,
    yearRange: {
      start: 0,
      end: 10,
    },
    when: 'start',
  },
} satisfies CustomVariable;

const BASE_VARIABLE_MONTHLY = {
  ...BASE_VARIABLE,
  timing: {
    frequency: 'monthly',
    yearRange: {
      start: 0,
      end: 10,
    },
    when: 'start',
  },
} satisfies CustomVariable;

describe('isVariableActive', () => {
  describe('early exits', () => {
    it('should return false if the variable is not enabled', () => {
      const variable = { ...BASE_VARIABLE_ONE_TIME, enabled: false } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 1, currentMonth: 1, timeHorizon: 10 });
      expect(result).toBe(false);
    });

    it('should return false if the year is greater than the time horizon', () => {
      const variable = { ...BASE_VARIABLE_ONE_TIME } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 11, currentMonth: 1, timeHorizon: 10 });
      expect(result).toBe(false);
    });
  });

  describe('oneTime', () => {
    it('should return true if the year and month are in range', () => {
      const variable = { ...BASE_VARIABLE_ONE_TIME } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 1, timeHorizon: 10 });
      expect(result).toBe(true);
    });

    it('should return false if the year is not in range', () => {
      const variable = {
        ...BASE_VARIABLE_ONE_TIME,
        timing: {
          ...BASE_VARIABLE_ONE_TIME.timing,
          year: 7,
        },
      } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 1, timeHorizon: 10 });
      expect(result).toBe(false);
    });

    it('should return false if the month is not in range', () => {
      const variable = { ...BASE_VARIABLE_ONE_TIME } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 2, timeHorizon: 10 });
      expect(result).toBe(false);
    });
  });

  describe('annual', () => {
    it('should return true if the month is in range and the its within the year range', () => {
      const variable = { ...BASE_VARIABLE_ANNUAL } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 0, timeHorizon: 10, when: 'start' });
      expect(result).toBe(true);
    });

    it('should return false if the month is not in range', () => {
      const variable = { ...BASE_VARIABLE_ANNUAL } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 1, timeHorizon: 10, when: 'start' });
      expect(result).toBe(false);
    });
  });

  describe('monthly', () => {
    it('should return true if the day is in range and the its within the year range', () => {
      const variable = { ...BASE_VARIABLE_MONTHLY } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 0, timeHorizon: 10, when: 'start' });
      expect(result).toBe(true);
    });

    it('should return false if the day is not in range', () => {
      const variable = { ...BASE_VARIABLE_MONTHLY } satisfies CustomVariable;
      const result = isVariableActive({ variable, currentYear: 6, currentMonth: 1, timeHorizon: 10, when: 'end' });
      expect(result).toBe(false);
    });
  });
});
