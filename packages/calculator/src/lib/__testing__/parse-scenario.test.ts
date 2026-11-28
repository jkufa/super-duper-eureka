import { describe, expect, it } from 'vite-plus/test';

import { parseScenario, ScenarioError } from '../parse-scenario';
import type { ScenarioErrorCode } from '../parse-scenario';
import type { ScenarioFile } from '../scenario';

const TODAY = '2026-03-01';

function validFile(): ScenarioFile {
  return {
    version: 1,
    endDate: '2036-01-01',
    interest: { annualRate: 0.06, variance: 0.02 },
    salary: { annualBase: 120_000, annualRaiseRate: 0.03, asOf: '2026-01-01' },
    accounts: [
      {
        id: 'k401',
        name: '401k',
        kind: 'pretax',
        included: true,
        balance: 50_000,
        balanceAsOf: '2026-02-15',
        contributions: [
          {
            id: 'deferral',
            type: 'salaryPercent',
            amount: 8,
            salaryBasis: 'perContribution',
            timing: { frequency: 'monthly', day: 15 }
          },
          {
            id: 'bonus',
            type: 'flat',
            amount: 5000,
            growth: { type: 'percent', amount: 2, cadence: 'annual' },
            timing: { frequency: 'annual', month: 2, day: 29, placement: 'end' },
            startDate: '2026-01-01',
            endDate: '2030-12-31'
          }
        ]
      },
      {
        id: 'roth',
        name: 'Roth IRA',
        kind: 'roth',
        included: false,
        balance: 0,
        balanceAsOf: TODAY,
        annualRate: 0.07,
        contributions: [
          {
            id: 'gift',
            name: 'Gift',
            enabled: false,
            type: 'flat',
            amount: 1000,
            timing: { frequency: 'oneTime', on: '2027-06-30' }
          }
        ]
      }
    ]
  };
}

function edited(edit: (file: ScenarioFile) => void): ScenarioFile {
  const file = validFile();
  edit(file);
  return file;
}

function firstAccount(file: ScenarioFile) {
  const account = file.accounts[0];
  if (!account) {
    throw new Error('The fixture has no first account.');
  }
  return account;
}

function firstRule(file: ScenarioFile) {
  const rule = firstAccount(file).contributions[0];
  if (!rule) {
    throw new Error('The fixture has no first rule.');
  }
  return rule;
}

function errorFrom(file: unknown, today = TODAY): ScenarioError {
  try {
    parseScenario(file, { today });
  } catch (error) {
    if (error instanceof ScenarioError) {
      return error;
    }
    throw error;
  }
  throw new Error('parseScenario accepted the file.');
}

function expectError(
  file: unknown,
  code: ScenarioErrorCode,
  ids: { accountId?: string; ruleId?: string } = {},
  today = TODAY
) {
  const error = errorFrom(file, today);
  expect({ code: error.code, accountId: error.accountId, ruleId: error.ruleId }).toStrictEqual({
    code,
    accountId: ids.accountId,
    ruleId: ids.ruleId
  });
  return error;
}

describe('parseScenario', () => {
  it('returns the scenario with dates parsed and defaults filled in', () => {
    const scenario = parseScenario(validFile(), { today: TODAY });

    expect(scenario.endDate).toStrictEqual({ year: 2036, month: 1, day: 1 });
    expect(scenario.interest).toStrictEqual({
      annualRate: 0.06,
      variance: 0.02,
      compounding: 'monthly'
    });
    expect(scenario.salary).toStrictEqual({
      annualBase: 120_000,
      annualRaiseRate: 0.03,
      asOf: { year: 2026, month: 1, day: 1 }
    });
    expect(scenario.accounts.map((account) => account.id)).toStrictEqual(['k401', 'roth']);
    expect(scenario.accounts[0]?.contributions[0]).toStrictEqual({
      id: 'deferral',
      enabled: true,
      type: 'salaryPercent',
      amount: 8,
      salaryBasis: 'perContribution',
      timing: { frequency: 'monthly', day: 15, placement: 'start' }
    });
    expect(scenario.accounts[0]?.contributions[1]?.timing).toStrictEqual({
      frequency: 'annual',
      month: 2,
      day: 29,
      placement: 'end'
    });
    expect(scenario.accounts[1]?.contributions[0]).toStrictEqual({
      id: 'gift',
      name: 'Gift',
      enabled: false,
      type: 'flat',
      amount: 1000,
      salaryBasis: 'annual',
      timing: { frequency: 'oneTime', on: { year: 2027, month: 6, day: 30 } }
    });
  });

  it('fills in a missing variance, raise and compounding', () => {
    const scenario = parseScenario(
      edited((file) => {
        file.interest = { annualRate: 0.05 };
        file.salary = { annualBase: 0, asOf: TODAY };
      }),
      { today: TODAY }
    );

    expect(scenario.interest).toStrictEqual({
      annualRate: 0.05,
      variance: 0,
      compounding: 'monthly'
    });
    expect(scenario.salary.annualRaiseRate).toBe(0);
  });

  describe('raises each validation code', () => {
    it('unsupported_version', () => {
      expectError({ ...validFile(), version: 2 }, 'unsupported_version');
      expectError({ version: 2, somethingNew: true }, 'unsupported_version');
    });

    it('invalid_date', () => {
      expectError(
        edited((file) => {
          file.endDate = '2036-02-30';
        }),
        'invalid_date'
      );
      expectError(
        edited((file) => {
          firstAccount(file).balanceAsOf = '2026-2-01';
        }),
        'invalid_date',
        { accountId: 'k401' }
      );
      expectError(
        edited((file) => {
          firstRule(file).startDate = '2026-13-01';
        }),
        'invalid_date',
        { accountId: 'k401', ruleId: 'deferral' }
      );
      expectError(validFile(), 'invalid_date', {}, '2026-03-32');
    });

    it('end_not_after_today', () => {
      expectError(
        edited((file) => {
          file.endDate = TODAY;
        }),
        'end_not_after_today'
      );
    });

    it('as_of_in_future', () => {
      expectError(
        edited((file) => {
          firstAccount(file).balanceAsOf = '2026-03-02';
        }),
        'as_of_in_future',
        { accountId: 'k401' }
      );
    });

    it('negative_balance', () => {
      expectError(
        edited((file) => {
          firstAccount(file).balance = -0.01;
        }),
        'negative_balance',
        { accountId: 'k401' }
      );
    });

    it('invalid_rate', () => {
      expectError(
        edited((file) => {
          file.interest.annualRate = Number.NaN;
        }),
        'invalid_rate'
      );
      expectError(
        edited((file) => {
          file.interest.variance = Number.POSITIVE_INFINITY;
        }),
        'invalid_rate'
      );
      expectError(
        edited((file) => {
          file.salary.annualRaiseRate = Number.NEGATIVE_INFINITY;
        }),
        'invalid_rate'
      );
      expectError(
        edited((file) => {
          file.interest = { annualRate: -0.5, variance: 0.5 };
        }),
        'invalid_rate'
      );
      expectError(
        edited((file) => {
          file.interest.variance = -0.01;
        }),
        'invalid_rate'
      );
      expectError(
        edited((file) => {
          const roth = file.accounts[1];
          if (roth) {
            roth.annualRate = -0.99;
          }
        }),
        'invalid_rate',
        { accountId: 'roth' }
      );
    });

    it('negative_amount', () => {
      expectError(
        edited((file) => {
          firstRule(file).amount = -1;
        }),
        'negative_amount',
        { accountId: 'k401', ruleId: 'deferral' }
      );
      expectError(
        edited((file) => {
          const bonus = firstAccount(file).contributions[1];
          if (bonus) {
            bonus.growth = { type: 'flat', amount: -5, cadence: 'monthly' };
          }
        }),
        'negative_amount',
        { accountId: 'k401', ruleId: 'bonus' }
      );
      expectError(
        edited((file) => {
          file.salary.annualBase = -1;
        }),
        'negative_amount'
      );
    });

    it('duplicate_id', () => {
      expectError(
        edited((file) => {
          const roth = file.accounts[1];
          if (roth) {
            roth.id = 'k401';
          }
        }),
        'duplicate_id',
        { accountId: 'k401' }
      );
      expectError(
        edited((file) => {
          const gift = file.accounts[1]?.contributions[0];
          if (gift) {
            gift.id = 'deferral';
          }
        }),
        'duplicate_id',
        { accountId: 'roth', ruleId: 'deferral' }
      );
    });

    it.each([
      [{ frequency: 'monthly', day: 0 }],
      [{ frequency: 'monthly', day: 32 }],
      [{ frequency: 'monthly', day: 1.5 }],
      [{ frequency: 'annual', month: 0 }],
      [{ frequency: 'annual', month: 13 }],
      [{ frequency: 'annual', month: 2, day: 30 }],
      [{ frequency: 'annual', month: 4, day: 31 }]
    ])('invalid_day for %o', (timing) => {
      expectError(
        edited((file) => {
          Object.assign(firstRule(file), { timing });
        }),
        'invalid_day',
        { accountId: 'k401', ruleId: 'deferral' }
      );
    });

    it('growth_without_start', () => {
      expectError(
        edited((file) => {
          const bonus = firstAccount(file).contributions[1];
          if (bonus) {
            delete bonus.startDate;
          }
        }),
        'growth_without_start',
        { accountId: 'k401', ruleId: 'bonus' }
      );
    });

    it('growth_on_one_time', () => {
      expectError(
        edited((file) => {
          const gift = file.accounts[1]?.contributions[0];
          if (gift) {
            gift.growth = { type: 'percent', amount: 1, cadence: 'annual' };
          }
        }),
        'growth_on_one_time',
        { accountId: 'roth', ruleId: 'gift' }
      );
    });

    it('rule_end_before_start', () => {
      expectError(
        edited((file) => {
          Object.assign(firstRule(file), { startDate: '2027-01-02', endDate: '2027-01-01' });
        }),
        'rule_end_before_start',
        { accountId: 'k401', ruleId: 'deferral' }
      );
    });

    it('per_contribution_on_one_time', () => {
      expectError(
        edited((file) => {
          const gift = file.accounts[1]?.contributions[0];
          if (gift) {
            Object.assign(gift, { type: 'salaryPercent', salaryBasis: 'perContribution' });
          }
        }),
        'per_contribution_on_one_time',
        { accountId: 'roth', ruleId: 'gift' }
      );
    });
  });

  describe('parses strictly', () => {
    it('rejects an unknown key at the top level', () => {
      const error = expectError({ ...validFile(), extra: 1 }, 'invalid_field');

      expect(error.path).toBe('extra');
      expect(error.message).toBe('invalid_field at extra: unexpected key.');
    });

    it('rejects an unknown key nested in a rule timing and names its path', () => {
      const error = expectError(
        edited((file) => {
          Object.assign(firstRule(file).timing, { weekday: 3 });
        }),
        'invalid_field',
        { accountId: 'k401', ruleId: 'deferral' }
      );

      expect(error.path).toBe('accounts[0].contributions[0].timing.weekday');
    });

    it.each([
      ['a start date on a one-time rule', { startDate: '2027-01-01' }, 'startDate'],
      ['a month on a monthly timing', { timing: { frequency: 'monthly', month: 2 } }, 'month'],
      ['a day on a one-time timing', { timing: { frequency: 'oneTime', on: TODAY, day: 3 } }, 'day']
    ])('rejects a misplaced key: %s', (_, change, key) => {
      const error = expectError(
        edited((file) => {
          const gift = file.accounts[1]?.contributions[0];
          if (gift) {
            Object.assign(gift, change);
          }
        }),
        'invalid_field',
        { accountId: 'roth', ruleId: 'gift' }
      );

      expect(error.path.endsWith(key)).toBe(true);
    });

    it('rejects a number that is not finite and names its path', () => {
      const error = expectError(
        edited((file) => {
          firstAccount(file).balance = Number.NaN;
        }),
        'invalid_field',
        { accountId: 'k401' }
      );

      expect(error.message).toBe('invalid_field at accounts[0].balance: expected a finite number.');
    });

    it('rejects a missing field and a field of the wrong type', () => {
      const missing = expectError(
        edited((file) => {
          Reflect.deleteProperty(firstRule(file), 'amount');
        }),
        'invalid_field',
        { accountId: 'k401', ruleId: 'deferral' }
      );
      const wrongType = expectError(
        edited((file) => {
          Object.assign(firstRule(file).timing, { day: '15' });
        }),
        'invalid_field',
        { accountId: 'k401', ruleId: 'deferral' }
      );

      expect(missing.message).toBe(
        'invalid_field at accounts[0].contributions[0].amount: missing.'
      );
      expect(wrongType.path).toBe('accounts[0].contributions[0].timing.day');
    });

    it('rejects a root that is not an object', () => {
      expectError([], 'invalid_field');
    });
  });
});
