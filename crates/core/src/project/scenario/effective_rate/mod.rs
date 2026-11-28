//! The one rate at which the included accounts, pooled at today, end on the baseline total.

use std::cmp;

use super::BaselineProjection;
use crate::compound::{BucketTotals, compound_segment};
use crate::project::ProjectionError;
use crate::scenario::{Account, Compounding, Scenario};
use crate::schedule::{Deposit, ScheduledMonth, build_account_schedule, month_segments};

const BISECTION_PASSES: usize = 60;

/// Relative to the pool's final balance at the lowest rate, which is finite.
const PARITY_TOLERANCE: f64 = 1e-9;

/// With no included account, or a pool with no balance and no deposits, the result is the
/// scenario's rate.
pub(super) fn effective_rate<'a>(
    scenario: &'a Scenario,
    baseline: &BaselineProjection<'a>,
) -> Result<f64, ProjectionError<'a>> {
    let default_rate = scenario.interest().annual_rate();
    let included: Vec<(&'a Account, f64)> = scenario
        .accounts()
        .iter()
        .zip(baseline.accounts())
        .filter(|(account, _)| account.included())
        .map(|(account, projection)| (account, projection.annual_rate))
        .collect();
    let mut rates = included.iter().map(|&(_, rate)| rate);
    let Some(first) = rates.next() else {
        return Ok(default_rate);
    };
    let (lowest, highest) = rates.fold((first, first), |(lowest, highest), rate| {
        (
            cmp::min_by(lowest, rate, f64::total_cmp),
            cmp::max_by(highest, rate, f64::total_cmp),
        )
    });
    if lowest == highest {
        return Ok(lowest);
    }

    let accounts: Vec<&'a Account> = included.iter().map(|&(account, _)| account).collect();
    let pool = Pool::of(scenario, &accounts, baseline.total().start_balance())?;
    if pool.opening_balance == 0.0 && !pool.has_deposits {
        return Ok(default_rate);
    }
    let compounding = scenario.interest().compounding();
    Ok(solve_rate(
        lowest,
        highest,
        baseline.total().final_balance(),
        |rate| pool.final_balance(compounding, rate),
    ))
}

/// `lowest` when the pool's final balance at `highest` exceeds the one at `lowest` by at most
/// [`PARITY_TOLERANCE`] of the latter, so the rate does not determine the result. Otherwise the
/// bisection. Compounds the pool twice before the bisection's passes.
fn solve_rate(
    lowest: f64,
    highest: f64,
    target: f64,
    mut final_balance_at: impl FnMut(f64) -> f64,
) -> f64 {
    let at_lowest = final_balance_at(lowest);
    let at_highest = final_balance_at(highest);
    if at_highest - at_lowest <= PARITY_TOLERANCE * at_lowest {
        return lowest;
    }
    bisect_rate(lowest, highest, target, final_balance_at)
}

/// Exactly [`BISECTION_PASSES`] passes. A result that is not below the target, including an
/// infinite or NaN one, moves `hi` down.
fn bisect_rate(
    lowest: f64,
    highest: f64,
    target: f64,
    mut final_balance_at: impl FnMut(f64) -> f64,
) -> f64 {
    let mut lo = lowest;
    let mut hi = highest;
    for _ in 0..BISECTION_PASSES {
        let mid = lo + (hi - lo) / 2.0;
        if final_balance_at(mid) < target {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    lo + (hi - lo) / 2.0
}

/// Several accounts' schedules from today to the end date, compounded as one balance.
struct Pool {
    opening_balance: f64,
    has_deposits: bool,
    months: Vec<PooledMonth>,
}

struct PooledMonth {
    /// Has no deposits: `totals` holds them.
    segment: ScheduledMonth<'static>,
    totals: BucketTotals,
}

impl Pool {
    /// Each month's deposits are taken account by account in the order of `accounts`, and inside
    /// an account in rule order.
    fn of<'a>(
        scenario: &Scenario,
        accounts: &[&'a Account],
        opening_balance: f64,
    ) -> Result<Self, ProjectionError<'a>> {
        let (today, end_date) = (scenario.today(), scenario.end_date());
        let mut schedules = Vec::with_capacity(accounts.len());
        for &account in accounts {
            schedules.push(build_account_schedule(scenario, account, today, end_date)?.into_iter());
        }
        let mut has_deposits = false;
        let months = month_segments(today, end_date)
            .map(|segment| {
                let deposits: Vec<Deposit<'a>> = schedules
                    .iter_mut()
                    .filter_map(Iterator::next)
                    .flat_map(ScheduledMonth::into_deposits)
                    .collect();
                has_deposits |= !deposits.is_empty();
                PooledMonth {
                    segment,
                    totals: BucketTotals::of(&deposits),
                }
            })
            .collect();
        Ok(Self {
            opening_balance,
            has_deposits,
            months,
        })
    }

    fn final_balance(&self, compounding: Compounding, annual_rate: f64) -> f64 {
        let mut balance = self.opening_balance;
        for month in &self.months {
            balance = compound_segment(
                balance,
                &month.totals,
                &month.segment,
                compounding,
                annual_rate,
            )
            .balance();
        }
        balance
    }
}

#[cfg(test)]
mod tests;
