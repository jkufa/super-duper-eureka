import type { Compounding } from './scenario';

/** A numbered bucket is a day of the month, used in daily mode only. */
export type DepositBucket = 'start' | 'end' | number;

const MONTHS_PER_YEAR = 12;

export interface SegmentDays {
  /** The first day of the month counted. */
  firstDay: number;
  /** How many days from firstDay are counted. */
  days: number;
  daysInMonth: number;
  daysInYear: number;
}

interface BucketedAmount {
  amount: number;
  bucket: DepositBucket;
}

export interface BucketTotals {
  start: number;
  end: number;
  byDay: Map<number, number>;
}

export function totalByBucket(deposits: ReadonlyArray<BucketedAmount>): BucketTotals {
  const totals: BucketTotals = { start: 0, end: 0, byDay: new Map() };
  for (const deposit of deposits) {
    if (deposit.bucket === 'start') {
      totals.start += deposit.amount;
    } else if (deposit.bucket === 'end') {
      totals.end += deposit.amount;
    } else {
      totals.byDay.set(deposit.bucket, (totals.byDay.get(deposit.bucket) ?? 0) + deposit.amount);
    }
  }
  return totals;
}

export function compoundSegment(
  balance: number,
  totals: BucketTotals,
  segment: SegmentDays,
  compounding: Compounding,
  annualRate: number
) {
  return compounding === 'daily'
    ? compoundDaily(balance, totals, segment, annualRate)
    : compoundMonthly(balance, totals, segment, annualRate);
}

function compoundMonthly(
  balance: number,
  totals: BucketTotals,
  segment: SegmentDays,
  annualRate: number
) {
  const monthlyRate = (1 + annualRate) ** (1 / MONTHS_PER_YEAR) - 1;
  const balanceAfterStart = balance + totals.start;
  const interest = balanceAfterStart * monthlyRate * (segment.days / segment.daysInMonth);

  return {
    balance: balanceAfterStart + interest + totals.end,
    contributions: totals.start + totals.end,
    interest
  };
}

function compoundDaily(
  startBalance: number,
  totals: BucketTotals,
  segment: SegmentDays,
  annualRate: number
) {
  const dailyRate = (1 + annualRate) ** (1 / segment.daysInYear) - 1;
  let balance = startBalance;
  let contributions = 0;
  let interest = 0;

  for (let day = segment.firstDay; day < segment.firstDay + segment.days; day++) {
    const added = depositOn(day, totals, segment.daysInMonth);
    if (added !== 0) {
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
  let deposit = totals.byDay.get(day) ?? 0;
  if (day === 1 && totals.start !== 0) {
    deposit += totals.start;
  }
  if (day === daysInMonth && totals.end !== 0) {
    deposit += totals.end;
  }
  return deposit;
}
