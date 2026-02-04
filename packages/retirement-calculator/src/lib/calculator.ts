import type { AnnualProjection, AnnualVariable, CustomVariable, CustomVariablesByFrequency, FrequencyExtended, Interest, MonthlyProjection, MonthlyVariable, OneTimeVariable, Salary } from './types';

const MONTHS_PER_YEAR = 12;
const MONTHS = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
} as const;
type Month = keyof typeof MONTHS;
type MonthIndex = typeof MONTHS[Month];

export interface RetirementConfig {
  /** Current investment balance */
  currentBalance: number;
  /** Time horizon in years */
  timeHorizon: number;
  /** Interest rate and variance */
  interest: Interest;
  /** Salary including raise */
  salary: Salary;
  /** Custom variables that can be added to the calculation */
  customVariables: CustomVariablesByFrequency;
}

export function calculateProjections(config: RetirementConfig) {
  const { currentBalance, timeHorizon, interest, salary, customVariables } = config;

  let currentMonth = new Date().getMonth();

  const monthlyProjections: MonthlyProjection[] = [
    {
      month: currentMonth,
      year: 0,
      balance: currentBalance,
      contributions: 0,
      interest: 0,
      salary: salary.base,
    },
  ];
  const yearlyProjections: AnnualProjection[] = [
    {
      year: 0,
      balance: currentBalance,
      contributions: 0,
      interest: 0,
      salary: salary.base,
    },
  ];

  const monthlyRate = interest.rate / MONTHS_PER_YEAR;

  let runningBalance = currentBalance;
  let runningSalary = salary.base;
  let totalContributions = 0;

  for (let year = 0; year < timeHorizon; year++) {
    const activeAnnualStart = getActiveVariables({ frequency: 'annual', currentMonth, currentYear: year, variables: customVariables, timeHorizon, when: 'start' });
    totalContributions += addVariables(...activeAnnualStart);

    for (let month = currentMonth; month < MONTHS_PER_YEAR; month++) {
      runningSalary = salary.base + 0;

      const activeMonthlyStart = getActiveVariables({ frequency: 'monthly', currentMonth: month, currentYear: year, variables: customVariables, timeHorizon, when: 'start' });
      const activeOneTime = getActiveVariables({ frequency: 'oneTime', currentMonth, currentYear: year, variables: customVariables, timeHorizon });

      // Track this month's contribution separately from total
      const monthlyContribution = addVariables(...activeMonthlyStart, ...activeOneTime);
      totalContributions += monthlyContribution;

      // End of the month
      const activeMonthlyEnd = getActiveVariables({ frequency: 'monthly', currentMonth: month, currentYear: year, variables: customVariables, timeHorizon, when: 'end' });
      const endOfMonthContribution = addVariables(...activeMonthlyEnd);

      // Only add THIS month's contributions to the balance (not the accumulated total)
      runningBalance = (runningBalance + monthlyContribution) * (1 + monthlyRate) + endOfMonthContribution;
      totalContributions += endOfMonthContribution;

      monthlyProjections.push({
        month: month + 1,
        year: year + 1,
        balance: runningBalance,
        contributions: totalContributions,
        interest: runningBalance * monthlyRate,
        salary: runningSalary,
      });
    }

    // End of the year
    const activeAnnualEnd = getActiveVariables({ frequency: 'annual', currentMonth, currentYear: year, variables: customVariables, timeHorizon, when: 'end' });
    const leftOverContributions = addVariables(...activeAnnualEnd);
    totalContributions += leftOverContributions;
    runningBalance += leftOverContributions;

    yearlyProjections.push({
      year: year + 1,
      balance: runningBalance,
      contributions: totalContributions,
      interest: runningBalance * interest.rate,
      salary: runningSalary,
    });

    currentMonth = 0;
    totalContributions = 0;
  }

  console.log({ finalBalance: runningBalance, totalContributions, totalGrowth: runningBalance - currentBalance });

  return {
    finalBalance: runningBalance,
    totalContributions,
    totalGrowth: runningBalance - currentBalance,
    yearlyProjections,
    monthlyProjections: monthlyProjections,
  };
}

interface GetActiveVariablesParams {
  frequency: FrequencyExtended;
  currentMonth: number;
  currentYear: number;
  variables: CustomVariablesByFrequency;
  timeHorizon: number;
  when?: 'start' | 'end';
}
function getActiveVariables(params: GetActiveVariablesParams) {
  const { frequency, variables, ...rest } = params;
  return variables[frequency].filter(v => isVariableActive({ ...rest, variable: v }));
}
function addVariables(...variables: CustomVariable[]) {
  return [...variables].reduce((acc, v) => acc + v.contribution.amount, 0);
}

function isMonth(target: Month, currentMonth: number) {
  return (currentMonth + MONTHS[target]) % MONTHS_PER_YEAR === 0;
}

/**
 * Calculate the number of months left in the time horizon, given the current month \
 * Assumes we're at the beginning of the current month, so still have the whole month to go (0-indexed)
 */
export function timeHorizonToMonths(timeHorizon: number, currentMonth: number) {
  return yearToMonths(timeHorizon) - currentMonth;
}
export function yearToMonths(year: number) {
  return year * MONTHS_PER_YEAR;
}
export function monthToYear(month: number) {
  return Math.floor(month / MONTHS_PER_YEAR);
}

export interface IsVariableActiveParams {
  variable: CustomVariable;
  currentYear: number;
  currentMonth: number;
  timeHorizon: number;
  when?: 'start' | 'end'; // for now, we only support start of month and end of month
}
export type IsVariableActiveFrequency = IsVariableActiveParams['variable']['timing']['frequency'];
// A variable is active if:
// it is enabled
// If it's a oneTime variable, the month & year must match
// If it's an annual variable, the month must match and the year must be within the range
// If it's a monthly variable, the year must be within the range
export function isVariableActive(params: IsVariableActiveParams) {
  const { variable, currentYear, currentMonth, timeHorizon } = params;

  if (!variable.enabled) return false;
  if (currentYear > timeHorizon) return false;

  if (variable.timing.frequency === 'oneTime') {
    return currentYear === variable.timing.year && currentMonth === variable.timing.month;
  }

  const isInRange = currentYear >= variable.timing.yearRange.start && currentYear <= variable.timing.yearRange.end;
  if (!isInRange) return false;

  if (params.when !== variable.timing.when) return false;

  if (variable.timing.frequency === 'annual') {
    return currentMonth === variable.timing.month;
  }

  // if (variable.timing.frequency === 'monthly')
  return true;
}

export function annualToMonthlyRate(annualRate: number) {
  return (1 + annualRate) ** (1 / MONTHS_PER_YEAR) - 1;
}
