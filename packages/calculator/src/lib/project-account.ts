import { buildAccountSchedule } from './account-schedule';
import type { ScheduledMonth } from './account-schedule';
import { compoundMonth, totalByBucket } from './compound';
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
  /** Boundary. The last day counted is the day before it. */
  to: PlainDateString;
  days: number;
  daysInMonth: number;
  daysInYear: number;
  balanceStart: number;
  balanceEnd: number;
  contributions: number;
  interest: number;
  annualRate: number;
  /** In schedule order. */
  deposits: Array<TraceDeposit>;
}

export function projectAccount(
  scenario: Scenario,
  account: Account,
  from: PlainDate,
  to: PlainDate,
  annualRate: number
): Series {
  const monthly: Array<Row> = [];
  let balance = account.balance;
  let totalContributions = 0;
  let totalInterest = 0;

  for (const month of scheduleRange(scenario, account, from, to)) {
    const result = compoundScheduledMonth(scenario, balance, month, annualRate);
    balance = result.balance;
    totalContributions += result.contributions;
    totalInterest += result.interest;
    monthly.push({
      year: month.start.year,
      month: month.start.month,
      balance,
      contributions: totalContributions,
      interest: totalInterest
    });
  }

  return {
    startBalance: account.balance,
    finalBalance: balance,
    totalContributions,
    totalInterest,
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
  annualRate: number
): Array<TraceSegment> {
  const segments: Array<TraceSegment> = [];
  let balance = account.balance;

  for (const month of scheduleRange(scenario, account, from, to)) {
    const result = compoundScheduledMonth(scenario, balance, month, annualRate);
    segments.push({
      from: formatPlainDate(month.start),
      to: formatPlainDate(addMonths(month.start, 1)),
      days: month.daysInMonth,
      daysInMonth: month.daysInMonth,
      daysInYear: month.daysInYear,
      balanceStart: balance,
      balanceEnd: result.balance,
      contributions: result.contributions,
      interest: result.interest,
      annualRate,
      deposits: month.deposits.map(({ ruleId, date, amount, bucket }) => ({
        ruleId,
        date: formatPlainDate(date),
        amount,
        bucket
      }))
    });
    balance = result.balance;
  }

  return segments;
}

function scheduleRange(
  scenario: Scenario,
  account: Account,
  from: PlainDate,
  to: PlainDate
): Array<ScheduledMonth> {
  for (const [name, date] of [
    ['from', from],
    ['to', to]
  ] as const) {
    if (date.day !== 1) {
      throw new RangeError(
        `${name} must be the 1st of a month until day-accurate ranges land (received ${formatPlainDate(date)}).`
      );
    }
  }
  return buildAccountSchedule(scenario, account, from, to);
}

function compoundScheduledMonth(
  scenario: Scenario,
  balance: number,
  month: ScheduledMonth,
  annualRate: number
) {
  return compoundMonth(
    balance,
    totalByBucket(month.deposits),
    month,
    scenario.interest.compounding,
    annualRate
  );
}
