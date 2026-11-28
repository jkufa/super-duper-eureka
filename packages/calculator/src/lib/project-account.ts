import { buildAccountSchedule } from './account-schedule';
import type { ScheduledMonth } from './account-schedule';
import { compoundMonth, totalByBucket } from './compound';
import { ScenarioError } from './parse-scenario';
import { addMonths, formatPlainDate } from './plain-date';
import type { PlainDate } from './plain-date';
import type { Account, PlainDateString, Scenario } from './scenario';
import type { DepositBucket } from './schedule';

const LAST_MONTH = 12;

export interface Row {
  /** Calendar year. */
  year: number;
  /** 1 to 12. Omitted on yearly rows. */
  month?: number;
  balance: number;
  /** Cumulative since the start of the range. */
  contributions: number;
  /** Cumulative since the start of the range. */
  interest: number;
}

export interface Series {
  /** Balance at the start of the range. */
  startBalance: number;
  finalBalance: number;
  totalContributions: number;
  totalInterest: number;
  monthly: Array<Row>;
  /** One row per calendar year, at its last counted month. */
  yearly: Array<Row>;
}

export interface TraceDeposit {
  ruleId: string;
  date: PlainDateString;
  amount: number;
  bucket: DepositBucket;
}

export interface TraceSegment {
  from: PlainDateString;
  /** Not included. */
  to: PlainDateString;
  days: number;
  daysInMonth: number;
  daysInYear: number;
  balanceStart: number;
  balanceEnd: number;
  /** The segment's contributions as compounded. */
  contributions: number;
  interest: number;
  annualRate: number;
  /** In schedule order. */
  deposits: Array<TraceDeposit>;
}

interface CompoundedMonth {
  month: ScheduledMonth;
  balanceStart: number;
  balanceEnd: number;
  contributions: number;
  interest: number;
  totalContributions: number;
  totalInterest: number;
}

export function projectAccount(
  scenario: Scenario,
  account: Account,
  from: PlainDate,
  to: PlainDate,
  openingBalance: number,
  annualRate: number
): Series {
  const compounded = compoundRange(scenario, account, from, to, openingBalance, annualRate);
  const monthly = compounded.map(
    ({ month, balanceEnd, totalContributions, totalInterest }): Row => ({
      year: month.start.year,
      month: month.start.month,
      balance: balanceEnd,
      contributions: totalContributions,
      interest: totalInterest
    })
  );
  const last = compounded.at(-1);

  return {
    startBalance: openingBalance,
    finalBalance: last ? last.balanceEnd : openingBalance,
    totalContributions: last ? last.totalContributions : 0,
    totalInterest: last ? last.totalInterest : 0,
    monthly,
    yearly: monthly.flatMap(({ year, month, balance, contributions, interest }, index) =>
      month === LAST_MONTH || index === monthly.length - 1
        ? [{ year, balance, contributions, interest }]
        : []
    )
  };
}

export function traceAccountRange(
  scenario: Scenario,
  account: Account,
  from: PlainDate,
  to: PlainDate,
  openingBalance: number,
  annualRate: number
): Array<TraceSegment> {
  return compoundRange(scenario, account, from, to, openingBalance, annualRate).map(
    ({ month, balanceStart, balanceEnd, contributions, interest }) => ({
      from: formatPlainDate(month.start),
      to: formatPlainDate(addMonths(month.start, 1)),
      days: month.daysInMonth,
      daysInMonth: month.daysInMonth,
      daysInYear: month.daysInYear,
      balanceStart,
      balanceEnd,
      contributions,
      interest,
      annualRate,
      deposits: month.deposits.map(({ ruleId, date, amount, bucket }) => ({
        ruleId,
        date: formatPlainDate(date),
        amount,
        bucket
      }))
    })
  );
}

function compoundRange(
  scenario: Scenario,
  account: Account,
  from: PlainDate,
  to: PlainDate,
  openingBalance: number,
  annualRate: number
): Array<CompoundedMonth> {
  checkFirstOfMonth('from', from);
  checkFirstOfMonth('to', to);
  const compounded: Array<CompoundedMonth> = [];
  let balance = openingBalance;
  let totalContributions = 0;
  let totalInterest = 0;

  for (const month of buildAccountSchedule(scenario, account, from, to)) {
    const result = compoundMonth(
      balance,
      totalByBucket(month.deposits),
      month,
      scenario.interest.compounding,
      annualRate
    );
    totalContributions += result.contributions;
    totalInterest += result.interest;
    checkFinite(account, month, { balance: result.balance, totalContributions, totalInterest });
    compounded.push({
      month,
      balanceStart: balance,
      balanceEnd: result.balance,
      contributions: result.contributions,
      interest: result.interest,
      totalContributions,
      totalInterest
    });
    balance = result.balance;
  }
  return compounded;
}

function checkFirstOfMonth(name: string, date: PlainDate) {
  if (date.day !== 1) {
    throw new RangeError(
      `${name} must be the 1st of a month until day-accurate ranges land (received ${formatPlainDate(date)}).`
    );
  }
}

function checkFinite(account: Account, month: ScheduledMonth, figures: Record<string, number>) {
  const overflowed = Object.entries(figures).find(([, value]) => !Number.isFinite(value));
  if (overflowed) {
    throw new ScenarioError(
      'not_finite',
      '',
      `the ${overflowed[0]} after ${formatPlainDate(month.start)} is ${String(overflowed[1])}`,
      { accountId: account.id }
    );
  }
}
