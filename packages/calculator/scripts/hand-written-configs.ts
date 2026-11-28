import { makeConfig } from '../src/lib/factories';
import type { RetirementConfig } from '../src/lib/types';

function firstOf(month: number): string {
  return `2026-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
}

export const handWrittenConfigs = {
  'growth-percent-annual-monthly': makeConfig({
    currentBalance: 40_000,
    timeHorizonYears: 12,
    startDate: firstOf(3),
    interest: { annualRate: 0.06, variance: 0.02, compounding: 'monthly' },
    salary: { annualBase: 85_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'brokerage',
        type: 'flat',
        amount: 500,
        growth: { type: 'percent', amount: 3, cadence: 'annual' },
        timing: { frequency: 'monthly', placement: 'start' }
      },
      {
        id: '401k',
        type: 'salaryPercent',
        amount: 5,
        salaryBasis: 'monthly',
        growth: { type: 'percent', amount: 2, cadence: 'annual' },
        timing: { frequency: 'monthly', placement: 'end' }
      }
    ]
  }),
  'growth-percent-annual-daily': makeConfig({
    currentBalance: 60_000,
    timeHorizonYears: 10,
    startDate: firstOf(6),
    interest: { annualRate: 0.055, variance: 0.015, compounding: 'daily' },
    salary: { annualBase: 95_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'brokerage',
        type: 'flat',
        amount: 400,
        growth: { type: 'percent', amount: 4, cadence: 'annual' },
        timing: { frequency: 'monthly', day: 10 }
      },
      {
        id: 'bonus',
        type: 'salaryPercent',
        amount: 6,
        salaryBasis: 'annual',
        growth: { type: 'percent', amount: 1.5, cadence: 'annual' },
        timing: { frequency: 'annual', month: 2, day: 15 }
      }
    ]
  }),
  'growth-percent-monthly-monthly': makeConfig({
    currentBalance: 15_000,
    timeHorizonYears: 8,
    startDate: firstOf(1),
    interest: { annualRate: 0.07, variance: 0.02, compounding: 'monthly' },
    salary: { annualBase: 70_000, annualRaiseRate: 0.025 },
    contributions: [
      {
        id: 'auto-invest',
        type: 'flat',
        amount: 200,
        growth: { type: 'percent', amount: 0.25, cadence: 'monthly' },
        timing: { frequency: 'monthly', placement: 'end' }
      },
      {
        id: 'ira',
        type: 'flat',
        amount: 3000,
        growth: { type: 'percent', amount: 0.1, cadence: 'monthly' },
        timing: { frequency: 'annual', month: 3, placement: 'start' }
      }
    ]
  }),
  'growth-percent-monthly-daily': makeConfig({
    currentBalance: 22_000,
    timeHorizonYears: 9,
    startDate: firstOf(9),
    interest: { annualRate: 0.045, variance: 0.01, compounding: 'daily' },
    salary: { annualBase: 110_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'auto-invest',
        type: 'flat',
        amount: 200,
        growth: { type: 'percent', amount: 0.25, cadence: 'monthly' },
        timing: { frequency: 'monthly', day: 20 }
      },
      {
        id: 'year-end',
        type: 'flat',
        amount: 1000,
        growth: { type: 'percent', amount: 0.5, cadence: 'monthly' },
        timing: { frequency: 'annual', month: 11, day: 15 }
      }
    ]
  }),
  'growth-flat-annual-monthly': makeConfig({
    currentBalance: 90_000,
    timeHorizonYears: 15,
    startDate: firstOf(1),
    interest: { annualRate: 0.05, variance: 0.01, compounding: 'monthly' },
    salary: { annualBase: 120_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'ira',
        type: 'flat',
        amount: 2000,
        growth: { type: 'flat', amount: 250, cadence: 'annual' },
        timing: { frequency: 'annual', month: 3, placement: 'end' }
      },
      {
        id: 'espp',
        type: 'salaryPercent',
        amount: 3,
        salaryBasis: 'monthly',
        growth: { type: 'flat', amount: 0.5, cadence: 'annual' },
        timing: { frequency: 'monthly', placement: 'start' }
      }
    ]
  }),
  'growth-flat-annual-daily': makeConfig({
    currentBalance: 33_000,
    timeHorizonYears: 11,
    startDate: firstOf(4),
    interest: { annualRate: 0.065, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 78_000, annualRaiseRate: 0.035 },
    contributions: [
      {
        id: 'summer',
        type: 'flat',
        amount: 1500,
        growth: { type: 'flat', amount: 100, cadence: 'annual' },
        timing: { frequency: 'annual', month: 7, day: 31 }
      },
      {
        id: 'hsa',
        type: 'flat',
        amount: 150,
        growth: { type: 'flat', amount: 10, cadence: 'annual' },
        timing: { frequency: 'monthly', placement: 'end' }
      }
    ]
  }),
  'growth-flat-monthly-monthly': makeConfig({
    currentBalance: 5000,
    timeHorizonYears: 7,
    startDate: firstOf(11),
    interest: { annualRate: 0.06, variance: 0.03, compounding: 'monthly' },
    salary: { annualBase: 65_000, annualRaiseRate: 0.04 },
    contributions: [
      {
        id: 'savings',
        type: 'flat',
        amount: 100,
        growth: { type: 'flat', amount: 5, cadence: 'monthly' },
        timing: { frequency: 'monthly', placement: 'start' }
      },
      {
        id: '401k',
        type: 'salaryPercent',
        amount: 3,
        salaryBasis: 'monthly',
        growth: { type: 'flat', amount: 0.01, cadence: 'monthly' },
        timing: { frequency: 'monthly', placement: 'end' }
      }
    ]
  }),
  'growth-flat-monthly-daily': makeConfig({
    currentBalance: 12_500,
    timeHorizonYears: 6,
    startDate: firstOf(2),
    interest: { annualRate: 0.05, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 72_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'month-end',
        type: 'flat',
        amount: 150,
        growth: { type: 'flat', amount: 2, cadence: 'monthly' },
        timing: { frequency: 'monthly', day: 31 }
      },
      {
        id: 'spring',
        type: 'flat',
        amount: 800,
        growth: { type: 'flat', amount: 15, cadence: 'monthly' },
        timing: { frequency: 'annual', month: 4, placement: 'start' }
      }
    ]
  }),
  'year-range-monthly': makeConfig({
    currentBalance: 50_000,
    timeHorizonYears: 20,
    startDate: firstOf(7),
    interest: { annualRate: 0.06, variance: 0.02, compounding: 'monthly' },
    salary: { annualBase: 100_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'mid-career',
        type: 'flat',
        amount: 1000,
        timing: { frequency: 'monthly', placement: 'start' },
        yearRange: { start: 4, end: 11 }
      },
      {
        id: 'bonus',
        type: 'salaryPercent',
        amount: 10,
        salaryBasis: 'annual',
        timing: { frequency: 'annual', month: 1, placement: 'end' },
        yearRange: { start: 2, end: 6 }
      }
    ]
  }),
  'year-range-daily': makeConfig({
    currentBalance: 80_000,
    timeHorizonYears: 12,
    startDate: firstOf(10),
    interest: { annualRate: 0.05, variance: 0.01, compounding: 'daily' },
    salary: { annualBase: 90_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'auto-invest',
        type: 'flat',
        amount: 300,
        timing: { frequency: 'monthly', day: 5 },
        yearRange: { start: 3, end: 8 }
      },
      {
        id: 'new-year',
        type: 'flat',
        amount: 5000,
        timing: { frequency: 'annual', month: 0, day: 2 },
        yearRange: { start: 1, end: 4 }
      }
    ]
  }),
  'year-range-from-zero-with-growth': makeConfig({
    currentBalance: 30_000,
    timeHorizonYears: 14,
    startDate: firstOf(5),
    interest: { annualRate: 0.07, variance: 0.025, compounding: 'monthly' },
    salary: { annualBase: 105_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'early-push',
        type: 'flat',
        amount: 750,
        growth: { type: 'percent', amount: 5, cadence: 'annual' },
        timing: { frequency: 'monthly', placement: 'end' },
        yearRange: { start: 0, end: 5 }
      },
      {
        id: 'until-seven',
        type: 'salaryPercent',
        amount: 4,
        salaryBasis: 'monthly',
        timing: { frequency: 'monthly', placement: 'start' },
        yearRange: { end: 7 }
      }
    ]
  }),
  'one-time-with-day-monthly': makeConfig({
    currentBalance: 70_000,
    timeHorizonYears: 6,
    startDate: firstOf(2),
    interest: { annualRate: 0.05, variance: 0.01, compounding: 'monthly' },
    salary: { annualBase: 88_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'inheritance',
        type: 'flat',
        amount: 10_000,
        timing: { frequency: 'oneTime', on: { year: 0, month: 5, day: 10 } }
      },
      {
        id: 'sale',
        type: 'flat',
        amount: 25_000,
        timing: { frequency: 'oneTime', on: { year: 3, month: 0, day: 14 } }
      }
    ]
  }),
  'one-time-with-day-daily': makeConfig({
    currentBalance: 45_000,
    timeHorizonYears: 5,
    startDate: firstOf(5),
    interest: { annualRate: 0.06, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 115_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'windfall',
        type: 'flat',
        amount: 8000,
        timing: { frequency: 'oneTime', on: { year: 1, month: 10, day: 25 } }
      },
      {
        id: 'leap-day',
        type: 'flat',
        amount: 2900,
        timing: { frequency: 'oneTime', on: { year: 2, month: 1, day: 29 } }
      },
      {
        id: 'signing-bonus',
        type: 'salaryPercent',
        amount: 15,
        salaryBasis: 'annual',
        timing: { frequency: 'oneTime', on: { year: 0, month: 6, day: 31 } }
      }
    ]
  }),
  'one-time-without-day-monthly': makeConfig({
    currentBalance: 20_000,
    timeHorizonYears: 7,
    startDate: firstOf(8),
    interest: { annualRate: 0.045, variance: 0.015, compounding: 'monthly' },
    salary: { annualBase: 60_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'before-start',
        type: 'flat',
        amount: 9999,
        timing: { frequency: 'oneTime', on: { year: 0, month: 2 } }
      },
      {
        id: 'start-month',
        type: 'flat',
        amount: 4000,
        timing: { frequency: 'oneTime', on: { year: 0, month: 7 } }
      },
      {
        id: 'later',
        type: 'flat',
        amount: 12_000,
        timing: { frequency: 'oneTime', on: { year: 4, month: 11 } }
      }
    ]
  }),
  'one-time-without-day-daily': makeConfig({
    currentBalance: 110_000,
    timeHorizonYears: 6,
    startDate: firstOf(12),
    interest: { annualRate: 0.05, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 140_000, annualRaiseRate: 0.025 },
    contributions: [
      {
        id: 'gift',
        type: 'flat',
        amount: 15_000,
        timing: { frequency: 'oneTime', on: { year: 2, month: 6 } }
      },
      {
        id: 'payout',
        type: 'salaryPercent',
        amount: 50,
        salaryBasis: 'monthly',
        timing: { frequency: 'oneTime', on: { year: 3, month: 0 } }
      }
    ]
  }),
  'salary-basis-annual': makeConfig({
    currentBalance: 55_000,
    timeHorizonYears: 10,
    startDate: firstOf(4),
    interest: { annualRate: 0.06, variance: 0.01, compounding: 'monthly' },
    salary: { annualBase: 98_000, annualRaiseRate: 0.04 },
    contributions: [
      {
        id: 'bonus',
        type: 'salaryPercent',
        amount: 8,
        salaryBasis: 'annual',
        timing: { frequency: 'annual', month: 2, placement: 'start' }
      }
    ]
  }),
  'salary-basis-monthly': makeConfig({
    currentBalance: 18_000,
    timeHorizonYears: 10,
    startDate: firstOf(6),
    interest: { annualRate: 0.055, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 76_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: '401k',
        type: 'salaryPercent',
        amount: 7,
        salaryBasis: 'monthly',
        timing: { frequency: 'monthly', day: 12 }
      }
    ]
  }),
  'salary-basis-biweekly': makeConfig({
    currentBalance: 42_000,
    timeHorizonYears: 9,
    startDate: firstOf(8),
    interest: { annualRate: 0.05, variance: 0.02, compounding: 'monthly' },
    salary: { annualBase: 83_000, annualRaiseRate: 0.025 },
    contributions: [
      {
        id: 'paycheck',
        type: 'salaryPercent',
        amount: 10,
        salaryBasis: 'biweekly',
        timing: { frequency: 'monthly', placement: 'end' }
      }
    ]
  }),
  'salary-basis-weekly': makeConfig({
    currentBalance: 9000,
    timeHorizonYears: 8,
    startDate: firstOf(10),
    interest: { annualRate: 0.065, variance: 0.015, compounding: 'daily' },
    salary: { annualBase: 52_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: 'weekly-save',
        type: 'salaryPercent',
        amount: 12,
        salaryBasis: 'weekly',
        timing: { frequency: 'monthly', day: 28 }
      }
    ]
  }),
  'salary-basis-daily': makeConfig({
    currentBalance: 27_000,
    timeHorizonYears: 9,
    startDate: firstOf(12),
    interest: { annualRate: 0.05, variance: 0.01, compounding: 'monthly' },
    salary: { annualBase: 73_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'day-rate',
        type: 'salaryPercent',
        amount: 20,
        salaryBasis: 'daily',
        timing: { frequency: 'monthly', placement: 'start' }
      }
    ]
  }),
  'salary-basis-per-contribution': makeConfig({
    currentBalance: 64_000,
    timeHorizonYears: 11,
    startDate: firstOf(9),
    interest: { annualRate: 0.06, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 125_000, annualRaiseRate: 0.035 },
    contributions: [
      {
        id: 'per-month',
        type: 'salaryPercent',
        amount: 6,
        salaryBasis: 'perContribution',
        timing: { frequency: 'monthly', day: 1 }
      },
      {
        id: 'per-year',
        type: 'salaryPercent',
        amount: 4,
        salaryBasis: 'perContribution',
        timing: { frequency: 'annual', month: 5, day: 30 }
      }
    ]
  }),
  'daily-day-boundaries': makeConfig({
    currentBalance: 35_000,
    timeHorizonYears: 4,
    startDate: firstOf(1),
    interest: { annualRate: 0.05, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 90_000, annualRaiseRate: 0.02 },
    contributions: [
      { id: 'day-31', type: 'flat', amount: 310, timing: { frequency: 'monthly', day: 31 } },
      { id: 'day-29', type: 'flat', amount: 290, timing: { frequency: 'monthly', day: 29 } },
      { id: 'day-1', type: 'flat', amount: 100, timing: { frequency: 'monthly', day: 1 } },
      {
        id: 'placed-end',
        type: 'flat',
        amount: 220,
        timing: { frequency: 'monthly', placement: 'end' }
      },
      {
        id: 'placed-start',
        type: 'flat',
        amount: 110,
        timing: { frequency: 'monthly', placement: 'start' }
      },
      {
        id: 'feb-29',
        type: 'flat',
        amount: 2900,
        timing: { frequency: 'annual', month: 1, day: 29 }
      }
    ]
  }),
  'monthly-day-midpoint': makeConfig({
    currentBalance: 48_000,
    timeHorizonYears: 3,
    startDate: firstOf(1),
    interest: { annualRate: 0.06, variance: 0.02, compounding: 'monthly' },
    salary: { annualBase: 80_000, annualRaiseRate: 0 },
    contributions: [
      { id: 'day-14', type: 'flat', amount: 140, timing: { frequency: 'monthly', day: 14 } },
      { id: 'day-15', type: 'flat', amount: 150, timing: { frequency: 'monthly', day: 15 } },
      { id: 'day-16', type: 'flat', amount: 160, timing: { frequency: 'monthly', day: 16 } },
      { id: 'day-31', type: 'flat', amount: 310, timing: { frequency: 'monthly', day: 31 } },
      {
        id: 'annual-late',
        type: 'flat',
        amount: 1200,
        timing: { frequency: 'annual', month: 1, day: 20, placement: 'start' }
      }
    ]
  }),
  'zero-rate-disabled-rules': makeConfig({
    currentBalance: 10_000,
    timeHorizonYears: 5,
    startDate: firstOf(3),
    interest: { annualRate: 0, variance: 0, compounding: 'monthly' },
    salary: { annualBase: 50_000, annualRaiseRate: 0.01 },
    contributions: [
      {
        id: 'disabled',
        enabled: false,
        type: 'flat',
        amount: 1000,
        timing: { frequency: 'monthly', placement: 'start' }
      },
      {
        id: 'zero-amount',
        type: 'flat',
        amount: 0,
        timing: { frequency: 'annual', month: 6, placement: 'end' }
      },
      {
        id: 'savings',
        type: 'flat',
        amount: 250,
        timing: { frequency: 'monthly', placement: 'end' }
      }
    ]
  }),
  'negative-band-rate': makeConfig({
    currentBalance: 25_000,
    timeHorizonYears: 6,
    startDate: firstOf(11),
    interest: { annualRate: 0.02, variance: 0.05, compounding: 'daily' },
    salary: { annualBase: 67_000, annualRaiseRate: 0.02 },
    contributions: [
      {
        id: 'savings',
        type: 'flat',
        amount: 400,
        timing: { frequency: 'monthly', day: 18 }
      }
    ]
  }),
  'long-horizon-daily': makeConfig({
    currentBalance: 150_000,
    timeHorizonYears: 40,
    startDate: firstOf(7),
    interest: { annualRate: 0.06, variance: 0.02, compounding: 'daily' },
    salary: { annualBase: 95_000, annualRaiseRate: 0.03 },
    contributions: [
      {
        id: '401k',
        type: 'salaryPercent',
        amount: 8,
        salaryBasis: 'perContribution',
        timing: { frequency: 'monthly', day: 15 }
      },
      {
        id: 'ira',
        type: 'flat',
        amount: 7000,
        growth: { type: 'percent', amount: 2, cadence: 'annual' },
        timing: { frequency: 'annual', month: 3, day: 15 }
      },
      {
        id: 'brokerage',
        type: 'flat',
        amount: 500,
        timing: { frequency: 'monthly', placement: 'end' },
        yearRange: { start: 10, end: 25 }
      }
    ]
  })
} satisfies Record<string, RetirementConfig>;
