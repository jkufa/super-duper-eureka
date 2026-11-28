import type { Deposit, Schedule, ScheduleMonth } from './schedule';
import type { CompoundingFrequency } from './types';

const MONTHS_PER_YEAR = 12;

export interface CompoundedMonth {
  month: ScheduleMonth;
  balance: number;
  contributions: number;
  interest: number;
}

export interface Compounded {
  finalBalance: number;
  totalContributions: number;
  totalInterest: number;
  monthly: Array<CompoundedMonth>;
}

export interface MonthDeposits {
  month: ScheduleMonth;
  deposits: Array<Deposit>;
}

type MonthDays = Pick<ScheduleMonth, 'daysInMonth' | 'daysInYear'>;
type BucketedAmount = Pick<Deposit, 'amount' | 'bucket'>;

export interface BucketTotals {
  start: number;
  end: number;
  byDay: Map<string, number>;
}

export function compound(startBalance: number, schedule: Schedule, annualRate: number): Compounded {
  const monthly: Array<CompoundedMonth> = [];
  let balance = startBalance;
  let totalContributions = 0;
  let totalInterest = 0;

  for (const { month, deposits } of groupByMonth(schedule)) {
    const result = compoundMonth(
      balance,
      totalByBucket(deposits),
      month,
      schedule.compounding,
      annualRate
    );
    balance = result.balance;
    totalContributions += result.contributions;
    totalInterest += result.interest;
    monthly.push({ month, balance, contributions: totalContributions, interest: totalInterest });
  }

  return { finalBalance: balance, totalContributions, totalInterest, monthly };
}

export function groupByMonth(schedule: Schedule): Array<MonthDeposits> {
  const groups = schedule.months.map((month): MonthDeposits => ({ month, deposits: [] }));
  for (const deposit of schedule.deposits) {
    const group = groups[deposit.monthOffset];
    if (!group) {
      throw new Error(
        `Deposit for rule "${deposit.ruleId}" is in month ${String(deposit.monthOffset)}, outside the schedule.`
      );
    }
    group.deposits.push(deposit);
  }
  return groups;
}

export function totalByBucket(deposits: ReadonlyArray<BucketedAmount>): BucketTotals {
  const totals: BucketTotals = { start: 0, end: 0, byDay: new Map() };
  for (const deposit of deposits) {
    if (deposit.bucket === 'start') {
      totals.start += deposit.amount;
    } else if (deposit.bucket === 'end') {
      totals.end += deposit.amount;
    } else {
      const day = String(deposit.bucket);
      totals.byDay.set(day, (totals.byDay.get(day) ?? 0) + deposit.amount);
    }
  }
  return totals;
}

export function compoundMonth(
  balance: number,
  totals: BucketTotals,
  month: MonthDays,
  compounding: CompoundingFrequency,
  annualRate: number
) {
  return compounding === 'daily'
    ? compoundDaily(balance, totals, month, annualRate)
    : compoundMonthly(balance, totals, annualRate);
}

function compoundMonthly(balance: number, totals: BucketTotals, annualRate: number) {
  const monthlyRate = (1 + annualRate) ** (1 / MONTHS_PER_YEAR) - 1;
  const balanceAfterStart = balance + totals.start;
  const interest = balanceAfterStart * monthlyRate;

  return {
    balance: balanceAfterStart + interest + totals.end,
    contributions: totals.start + totals.end,
    interest
  };
}

function compoundDaily(
  startBalance: number,
  totals: BucketTotals,
  month: MonthDays,
  annualRate: number
) {
  const dailyRate = (1 + annualRate) ** (1 / month.daysInYear) - 1;
  let balance = startBalance;
  let contributions = 0;
  let interest = 0;

  for (let day = 1; day <= month.daysInMonth; day++) {
    const added = depositOn(day, totals, month.daysInMonth);
    if (added) {
      balance += added;
      contributions += added;
    }
    const dailyInterest = balance * dailyRate;
    balance += dailyInterest;
    interest += dailyInterest;
  }

  return { balance, contributions, interest };
}

function depositOn(day: number, totals: BucketTotals, daysInMonth: number) {
  let deposit = totals.byDay.get(String(day)) ?? 0;
  if (day === 1 && totals.start) {
    deposit += totals.start;
  }
  if (day === daysInMonth && totals.end) {
    deposit += totals.end;
  }
  return deposit;
}
