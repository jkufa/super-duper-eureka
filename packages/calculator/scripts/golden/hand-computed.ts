import type { Json } from '../../src/lib/corpus/json';

/** A golden input written by hand: the scenario and its today. */
export interface HandCase {
  name: string;
  scenario: Json;
  today: string;
}

const DOUBLING_MONTHLY_RATE = 4095;
const DOUBLING_DAILY_RATE = 2 ** 365 - 1;
const DOUBLING_LEAP_DAILY_RATE = 2 ** 366 - 1;
const JUST_ABOVE_MINUS_1 = -0.9999999999999999;

type Fields = { [key: string]: Json };

function scenario(today: string, endDate: string, interest: Fields, accounts: Array<Fields>): Json {
  return {
    version: 1,
    endDate,
    interest: { annualRate: 0, variance: 0, compounding: 'monthly', ...interest },
    salary: { annualBase: 0, asOf: today },
    accounts: accounts.map((fields) => ({
      name: 'Account',
      kind: 'other',
      included: true,
      balance: 0,
      balanceAsOf: today,
      contributions: [],
      ...fields
    }))
  };
}

function flat(id: string, amount: number, timing: Fields) {
  return { id, type: 'flat', amount, timing };
}

const EARLY_AND_LATE = [
  flat('early', 100, { frequency: 'monthly', day: 3 }),
  flat('late', 10, { frequency: 'monthly', day: 20 })
];

function justAboveMinus1(compounding: string): Json {
  return scenario('2026-01-01', '2026-04-01', { compounding }, [
    {
      id: 'account',
      balance: 1000,
      annualRate: JUST_ABOVE_MINUS_1,
      contributions: [flat('mid-month', 100, { frequency: 'monthly', day: 15 })]
    }
  ]);
}

/**
 * The hand-computed tests of spec 2 parts D to F that a scenario file can express, a rate just
 * above -1 in both modes, and a scenario with no accounts.
 */
export const HAND_CASES: ReadonlyArray<HandCase> = [
  {
    name: 'readme-two-accounts-thirty-years',
    today: '2026-01-01',
    scenario: scenario('2026-01-01', '2056-01-01', {}, [
      { id: 'six', balance: 180_000, annualRate: 0.06 },
      { id: 'ten', balance: 20_000, annualRate: 0.1 }
    ])
  },
  {
    name: 'start-on-27th-of-30-day-month-monthly',
    today: '2026-11-27',
    scenario: scenario('2026-11-27', '2027-01-01', { annualRate: DOUBLING_MONTHLY_RATE }, [
      { id: 'account', balance: 3000, contributions: EARLY_AND_LATE }
    ])
  },
  {
    name: 'start-on-27th-of-30-day-month-daily',
    today: '2026-11-27',
    scenario: scenario(
      '2026-11-27',
      '2027-01-01',
      { annualRate: DOUBLING_DAILY_RATE, compounding: 'daily' },
      [{ id: 'account', balance: 3000, contributions: EARLY_AND_LATE }]
    )
  },
  {
    name: 'one-time-on-28th-in-start-bucket-from-27th',
    today: '2026-11-27',
    scenario: scenario('2026-11-27', '2026-12-01', { annualRate: DOUBLING_MONTHLY_RATE }, [
      {
        id: 'account',
        balance: 2500,
        contributions: [flat('late-november', 500, { frequency: 'oneTime', on: '2026-11-28' })]
      }
    ])
  },
  {
    name: 'deposits-around-a-mid-month-range',
    today: '2026-11-15',
    scenario: scenario('2026-11-15', '2026-11-20', { annualRate: DOUBLING_MONTHLY_RATE }, [
      {
        id: 'account',
        balance: 1000,
        contributions: [
          flat('before-start', 1, { frequency: 'oneTime', on: '2026-11-14' }),
          flat('on-start', 10, { frequency: 'oneTime', on: '2026-11-15' }),
          flat('on-end', 100, { frequency: 'oneTime', on: '2026-11-20' }),
          flat('after-end', 1000, { frequency: 'oneTime', on: '2026-11-21' })
        ]
      }
    ])
  },
  {
    name: 'leap-day-start-with-day-31-rule-daily',
    today: '2028-02-29',
    scenario: scenario(
      '2028-02-29',
      '2028-07-01',
      { annualRate: DOUBLING_LEAP_DAILY_RATE, compounding: 'daily' },
      [
        {
          id: 'account',
          balance: 1,
          contributions: [flat('day-31', 1, { frequency: 'monthly', day: 31 })]
        }
      ]
    )
  },
  {
    name: 'stale-2-pow-53-with-two-deposits-of-1',
    today: '2026-11-01',
    scenario: scenario('2026-11-01', '2026-12-01', {}, [
      {
        id: 'big',
        balance: 2 ** 53,
        balanceAsOf: '2026-09-01',
        contributions: [flat('one', 1, { frequency: 'monthly', placement: 'start' })]
      }
    ])
  },
  {
    name: 'rate-just-above-minus-1-monthly',
    today: '2026-01-01',
    scenario: justAboveMinus1('monthly')
  },
  {
    name: 'rate-just-above-minus-1-daily',
    today: '2026-01-01',
    scenario: justAboveMinus1('daily')
  },
  {
    name: 'no-accounts',
    today: '2026-01-01',
    scenario: scenario('2026-01-01', '2028-01-01', { annualRate: 0.05 }, [])
  }
];
