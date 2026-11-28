import { ScenarioError } from './parse-scenario';
import { addMonths, compareDates, daysInMonth, daysInYear, formatPlainDate } from './plain-date';
import type { PlainDate } from './plain-date';
import type { Account, Compounding, Rule, Scenario, Timing } from './scenario';
import type { DepositBucket } from './compound';

const MONTHS_PER_YEAR = 12;
const PERIODS_PER_YEAR = { monthly: 12, biweekly: 26, weekly: 52, daily: 365 } as const;

export interface ScheduledDeposit {
  ruleId: string;
  date: PlainDate;
  amount: number;
  bucket: DepositBucket;
}

export interface ScheduledMonth {
  /** The first day counted. */
  from: PlainDate;
  /** The first day not counted. */
  to: PlainDate;
  /** The first day of the month counted. */
  firstDay: number;
  days: number;
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
  const months = monthSegments(from, to);
  for (const month of months) {
    for (const rule of rules) {
      const date = depositDate(rule, month);
      if (!date || compareDates(date, month.from) < 0 || compareDates(date, month.to) >= 0) {
        continue;
      }
      const amount = depositAmount(scenario, rule, date);
      if (!Number.isFinite(amount)) {
        throw new ScenarioError(
          'not_finite',
          '',
          `the deposit of rule ${rule.id} on ${formatPlainDate(date)} is ${String(amount)}`,
          { accountId: account.id }
        );
      }
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
  }
  return months;
}

/** One segment per calendar month from `from` up to `to`, with no deposits. Empty when `from` is on or after `to`. */
export function monthSegments(from: PlainDate, to: PlainDate): Array<ScheduledMonth> {
  const months: Array<ScheduledMonth> = [];
  if (compareDates(from, to) >= 0) {
    return months;
  }
  for (let first = { ...from, day: 1 }; compareDates(first, to) < 0; first = addMonths(first, 1)) {
    months.push(monthSegment(first, from, to));
  }
  return months;
}

function monthSegment(first: PlainDate, from: PlainDate, to: PlainDate): ScheduledMonth {
  const next = addMonths(first, 1);
  const segmentFrom = compareDates(from, first) > 0 ? from : first;
  const endsInMonth = compareDates(to, next) < 0;
  const monthDays = daysInMonth(first.year, first.month);
  const lastDay = endsInMonth ? to.day - 1 : monthDays;
  return {
    from: segmentFrom,
    to: endsInMonth ? to : next,
    firstDay: segmentFrom.day,
    days: lastDay - segmentFrom.day + 1,
    daysInMonth: monthDays,
    daysInYear: daysInYear(first.year),
    deposits: []
  };
}

function depositDate(rule: Rule, month: ScheduledMonth): PlainDate | undefined {
  const { timing } = rule;
  const { year, month: monthNumber } = month.from;
  if (timing.frequency === 'oneTime') {
    const { on } = timing;
    return on.year === year && on.month === monthNumber ? on : undefined;
  }
  if (timing.frequency === 'annual' && timing.month !== monthNumber) {
    return undefined;
  }

  const date = { year, month: monthNumber, day: recurringDay(timing, month.daysInMonth) };
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
  const grown = grownAmount(rule, date);
  if (rule.type === 'flat') {
    return grown;
  }
  const salary = salaryInYear(scenario, date.year);
  const divisor = salaryDivisor(rule);
  return divisor === undefined ? salary * (grown / 100) : (salary / divisor) * (grown / 100);
}

function salaryDivisor(rule: Rule): number | undefined {
  const { salaryBasis } = rule;
  if (salaryBasis === 'perContribution') {
    return rule.timing.frequency === 'monthly' ? PERIODS_PER_YEAR.monthly : undefined;
  }
  return salaryBasis === 'annual' ? undefined : PERIODS_PER_YEAR[salaryBasis];
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

export function wholeMonthsBetween(start: PlainDate, end: PlainDate): number {
  const months = (end.year - start.year) * MONTHS_PER_YEAR + end.month - start.month;
  return compareDates(addMonths(start, months), end) > 0 ? months - 1 : months;
}
