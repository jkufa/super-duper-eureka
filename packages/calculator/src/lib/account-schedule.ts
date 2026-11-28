import { addMonths, compareDates, daysInMonth, daysInYear } from './plain-date';
import type { PlainDate } from './plain-date';
import type { Account, Compounding, Rule, Scenario, Timing } from './scenario';
import type { DepositBucket } from './schedule';

const MONTHS_PER_YEAR = 12;
const PERIODS_PER_YEAR = { monthly: 12, biweekly: 26, weekly: 52, daily: 365 } as const;

export interface ScheduledDeposit {
  ruleId: string;
  date: PlainDate;
  amount: number;
  bucket: DepositBucket;
}

export interface ScheduledMonth {
  /** The 1st of the month. */
  start: PlainDate;
  daysInMonth: number;
  daysInYear: number;
  deposits: Array<ScheduledDeposit>;
}

export function salaryInYear(scenario: Scenario, year: number): number {
  const { annualBase, annualRaiseRate, asOf } = scenario.salary;
  return annualBase * (1 + annualRaiseRate) ** (year - asOf.year);
}

export function buildAccountSchedule(
  scenario: Scenario,
  account: Account,
  from: PlainDate,
  to: PlainDate
): Array<ScheduledMonth> {
  const rules = account.contributions.filter((rule) => rule.enabled);
  const months: Array<ScheduledMonth> = [];
  for (let start = { ...from, day: 1 }; compareDates(start, to) < 0; start = addMonths(start, 1)) {
    const month: ScheduledMonth = {
      start,
      daysInMonth: daysInMonth(start.year, start.month),
      daysInYear: daysInYear(start.year),
      deposits: []
    };
    for (const rule of rules) {
      const date = depositDate(rule, month);
      if (!date || compareDates(date, from) < 0 || compareDates(date, to) >= 0) {
        continue;
      }
      const amount = depositAmount(scenario, rule, date);
      if (amount === 0) {
        continue;
      }
      month.deposits.push({
        ruleId: rule.id,
        date,
        amount,
        bucket: depositBucket(rule.timing, date, scenario.interest.compounding, month.daysInMonth)
      });
    }
    months.push(month);
  }
  return months;
}

function depositDate(rule: Rule, month: ScheduledMonth): PlainDate | undefined {
  const { timing } = rule;
  if (timing.frequency === 'oneTime') {
    const { on } = timing;
    return on.year === month.start.year && on.month === month.start.month ? on : undefined;
  }
  if (timing.frequency === 'annual' && timing.month !== month.start.month) {
    return undefined;
  }

  const date = { ...month.start, day: recurringDay(timing, month.daysInMonth) };
  const afterStart = !rule.startDate || compareDates(date, rule.startDate) >= 0;
  const beforeEnd = !rule.endDate || compareDates(date, rule.endDate) <= 0;
  return afterStart && beforeEnd ? date : undefined;
}

function recurringDay(timing: Exclude<Timing, { frequency: 'oneTime' }>, monthDays: number) {
  if (timing.day !== undefined) {
    return Math.min(timing.day, monthDays);
  }
  return timing.placement === 'end' ? monthDays : 1;
}

function depositBucket(
  timing: Timing,
  date: PlainDate,
  compounding: Compounding,
  monthDays: number
): DepositBucket {
  if (timing.frequency === 'oneTime') {
    return compounding === 'daily' ? date.day : 'start';
  }
  if (timing.day === undefined) {
    return timing.placement;
  }
  if (compounding === 'daily') {
    return date.day;
  }
  return date.day <= Math.ceil(monthDays / 2) ? 'start' : 'end';
}

function depositAmount(scenario: Scenario, rule: Rule, date: PlainDate): number {
  const amount = grownAmount(rule, date);
  if (rule.type === 'flat') {
    return amount;
  }
  return salaryShare(salaryInYear(scenario, date.year), rule) * (amount / 100);
}

function salaryShare(salary: number, rule: Rule): number {
  const basis =
    rule.salaryBasis === 'perContribution'
      ? rule.timing.frequency === 'monthly'
        ? 'monthly'
        : 'annual'
      : rule.salaryBasis;
  return basis === 'annual' ? salary : salary / PERIODS_PER_YEAR[basis];
}

function grownAmount(rule: Rule, date: PlainDate): number {
  const { growth, startDate } = rule;
  if (!growth || !startDate) {
    return rule.amount;
  }
  const months = wholeMonthsBetween(startDate, date);
  const periods = growth.cadence === 'annual' ? Math.floor(months / MONTHS_PER_YEAR) : months;
  if (growth.type === 'percent') {
    return rule.amount * (1 + growth.amount / 100) ** periods;
  }
  return rule.amount + growth.amount * periods;
}

function wholeMonthsBetween(start: PlainDate, end: PlainDate): number {
  const months = (end.year - start.year) * MONTHS_PER_YEAR + end.month - start.month;
  return compareDates(addMonths(start, months), end) > 0 ? months - 1 : months;
}
