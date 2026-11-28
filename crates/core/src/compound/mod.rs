//! Interest on one month's segment of a schedule, in the order of arithmetic the TypeScript
//! engine uses.

use crate::scenario::Compounding;
use crate::schedule::{Bucket, Deposit, ScheduledMonth};

const MONTHS_PER_YEAR: f64 = 12.0;
const MAX_DAY: usize = 31;

/// A month's deposits totalled by bucket. Each total is summed from 0 in schedule order.
#[derive(Debug, PartialEq)]
pub(crate) struct BucketTotals {
    start: f64,
    end: f64,
    /// Indexed by day of the month minus 1.
    by_day: [f64; MAX_DAY],
}

impl BucketTotals {
    pub(crate) fn of(deposits: &[Deposit<'_>]) -> Self {
        let mut totals = Self {
            start: 0.0,
            end: 0.0,
            by_day: [0.0; MAX_DAY],
        };
        for deposit in deposits {
            let total = match deposit.bucket() {
                Bucket::Start => Some(&mut totals.start),
                Bucket::End => Some(&mut totals.end),
                Bucket::Day(day) => day_index(day).and_then(|index| totals.by_day.get_mut(index)),
            };
            if let Some(total) = total {
                *total += deposit.amount();
            }
        }
        totals
    }

    fn on_day(&self, day: i8) -> f64 {
        day_index(day)
            .and_then(|index| self.by_day.get(index))
            .copied()
            .unwrap_or(0.0)
    }
}

fn day_index(day: i8) -> Option<usize> {
    usize::try_from(day).ok()?.checked_sub(1)
}

/// What one segment did to the balance.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Compounded {
    balance: f64,
    contributions: f64,
    interest: f64,
}

impl Compounded {
    /// The balance at the end of the segment.
    pub(crate) fn balance(self) -> f64 {
        self.balance
    }

    /// The segment's deposits as compounded.
    pub(crate) fn contributions(self) -> f64 {
        self.contributions
    }

    pub(crate) fn interest(self) -> f64 {
        self.interest
    }
}

/// `month` supplies the segment's days. Its deposits are not read: `totals` holds them.
pub(crate) fn compound_segment(
    balance: f64,
    totals: &BucketTotals,
    month: &ScheduledMonth<'_>,
    compounding: Compounding,
    annual_rate: f64,
) -> Compounded {
    match compounding {
        Compounding::Monthly => compound_monthly(balance, totals, month, annual_rate),
        Compounding::Daily => compound_daily(balance, totals, month, annual_rate),
    }
}

fn compound_monthly(
    balance: f64,
    totals: &BucketTotals,
    month: &ScheduledMonth<'_>,
    annual_rate: f64,
) -> Compounded {
    let monthly_rate = (1.0 + annual_rate).powf(1.0 / MONTHS_PER_YEAR) - 1.0;
    let balance_after_start = balance + totals.start;
    let interest = balance_after_start
        * monthly_rate
        * (f64::from(month.days()) / f64::from(month.days_in_month()));

    Compounded {
        balance: balance_after_start + interest + totals.end,
        contributions: totals.start + totals.end,
        interest,
    }
}

fn compound_daily(
    start_balance: f64,
    totals: &BucketTotals,
    month: &ScheduledMonth<'_>,
    annual_rate: f64,
) -> Compounded {
    let daily_rate = (1.0 + annual_rate).powf(1.0 / f64::from(month.days_in_year())) - 1.0;
    let mut compounded = Compounded {
        balance: start_balance,
        contributions: 0.0,
        interest: 0.0,
    };

    for day in month.first_day()..month.first_day() + month.days() {
        let added = deposit_on(day, totals, month.days_in_month());
        if added != 0.0 {
            compounded.balance += added;
            compounded.contributions += added;
        }
        let daily_interest = compounded.balance * daily_rate;
        compounded.balance += daily_interest;
        compounded.interest += daily_interest;
    }

    compounded
}

fn deposit_on(day: i8, totals: &BucketTotals, days_in_month: i8) -> f64 {
    let mut deposit = totals.on_day(day);
    if day == 1 && totals.start != 0.0 {
        deposit += totals.start;
    }
    if day == days_in_month && totals.end != 0.0 {
        deposit += totals.end;
    }
    deposit
}

#[cfg(test)]
mod tests;
