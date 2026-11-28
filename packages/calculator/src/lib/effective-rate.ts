import { buildAccountSchedule, monthSegments } from './account-schedule';
import type { ScheduledDeposit } from './account-schedule';
import { compoundSegment, totalByBucket } from './compound';
import type { BucketTotals, SegmentDays } from './compound';
import type { Series } from './project-account';
import type { Account, Compounding, Scenario } from './scenario';

export const BISECTION_PASSES = 60;

export interface PooledMonth {
  segment: SegmentDays;
  totals: BucketTotals;
}

export interface Pool {
  openingBalance: number;
  hasDeposits: boolean;
  months: Array<PooledMonth>;
}

export interface RatedAccount {
  account: Account;
  annualRate: number;
}

/** The accounts' schedules from today to endDate, merged by month, then account order, then rule order. */
export function poolAccounts(
  scenario: Scenario,
  accounts: ReadonlyArray<Account>,
  openingBalance: number
): Pool {
  const schedules = accounts.map((account) =>
    buildAccountSchedule(scenario, account, scenario.today, scenario.endDate)
  );
  let hasDeposits = false;
  const months = monthSegments(scenario.today, scenario.endDate).map((segment, index) => {
    const deposits: Array<ScheduledDeposit> = schedules.flatMap(
      (schedule) => schedule[index]?.deposits ?? []
    );
    hasDeposits ||= deposits.length > 0;
    return { segment, totals: totalByBucket(deposits) };
  });
  return { openingBalance, hasDeposits, months };
}

export function poolFinalBalance(pool: Pool, compounding: Compounding, annualRate: number): number {
  let balance = pool.openingBalance;
  for (const { segment, totals } of pool.months) {
    balance = compoundSegment(balance, totals, segment, compounding, annualRate).balance;
  }
  return balance;
}

export function bisectRate(
  lowest: number,
  highest: number,
  target: number,
  finalBalanceAt: (annualRate: number) => number
): number {
  let lo = lowest;
  let hi = highest;
  for (let pass = 0; pass < BISECTION_PASSES; pass++) {
    const mid = lo + (hi - lo) / 2;
    if (finalBalanceAt(mid) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo + (hi - lo) / 2;
}

export function effectiveRate(
  scenario: Scenario,
  included: ReadonlyArray<RatedAccount>,
  total: Series
): number {
  if (included.length === 0) {
    return scenario.interest.annualRate;
  }
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (const { annualRate } of included) {
    lowest = Math.min(lowest, annualRate);
    highest = Math.max(highest, annualRate);
  }
  if (lowest === highest) {
    return lowest;
  }
  const pool = poolAccounts(
    scenario,
    included.map(({ account }) => account),
    total.startBalance
  );
  if (pool.openingBalance === 0 && !pool.hasDeposits) {
    return scenario.interest.annualRate;
  }
  const { compounding } = scenario.interest;
  const atLo = poolFinalBalance(pool, compounding, lowest);
  const atHi = poolFinalBalance(pool, compounding, highest);
  if (atHi - atLo <= 1e-9 * atLo) {
    return lowest;
  }
  return bisectRate(lowest, highest, total.finalBalance, (rate) =>
    poolFinalBalance(pool, compounding, rate)
  );
}
