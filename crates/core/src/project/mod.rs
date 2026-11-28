//! An account's balance, contributions and interest over a range of days, month by month, and a
//! whole scenario's accounts, totals and rates.

mod error;
mod scenario;
mod trace;

use serde::Serialize;

use crate::compound::{BucketTotals, Compounded, compound_segment};
use crate::date::CalendarDate;
use crate::scenario::{Account, Scenario};
use crate::schedule::{ScheduledMonth, build_account_schedule};

pub use error::ProjectionError;
pub use scenario::{
    AccountProjection, Band, BandProjection, Bands, BaselineProjection, RolledForward,
    ScenarioProjection, StaleAccount, WeightedSeries, WeightedYearlyRow, YearSalary,
    project_scenario, trace_account,
};
pub use trace::TraceSegment;
pub(crate) use trace::trace_account_range;

const LAST_MONTH: i8 = 12;

/// The figures at the end of one month's segment.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyRow {
    year: i16,
    month: i8,
    balance: f64,
    contributions: f64,
    interest: f64,
}

impl MonthlyRow {
    pub fn year(self) -> i16 {
        self.year
    }

    /// 1 to 12.
    pub fn month(self) -> i8 {
        self.month
    }

    pub fn balance(self) -> f64 {
        self.balance
    }

    /// Cumulative since the start of the range.
    pub fn contributions(self) -> f64 {
        self.contributions
    }

    /// Cumulative since the start of the range.
    pub fn interest(self) -> f64 {
        self.interest
    }
}

/// The figures at the end of a calendar year's last counted segment.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YearlyRow {
    year: i16,
    balance: f64,
    contributions: f64,
    interest: f64,
}

impl YearlyRow {
    pub fn year(self) -> i16 {
        self.year
    }

    pub fn balance(self) -> f64 {
        self.balance
    }

    /// Cumulative since the start of the range.
    pub fn contributions(self) -> f64 {
        self.contributions
    }

    /// Cumulative since the start of the range.
    pub fn interest(self) -> f64 {
        self.interest
    }
}

impl From<MonthlyRow> for YearlyRow {
    fn from(row: MonthlyRow) -> Self {
        Self {
            year: row.year,
            balance: row.balance,
            contributions: row.contributions,
            interest: row.interest,
        }
    }
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Series {
    start_balance: f64,
    final_balance: f64,
    total_contributions: f64,
    total_interest: f64,
    monthly: Vec<MonthlyRow>,
    yearly: Vec<YearlyRow>,
}

impl Series {
    /// The totals and the yearly rows come from the last monthly row of each year. With no rows,
    /// the final balance is the start balance and the totals are 0.
    fn new(start_balance: f64, monthly: Vec<MonthlyRow>) -> Self {
        let last = monthly.last().copied();
        Self {
            start_balance,
            final_balance: last.map_or(start_balance, MonthlyRow::balance),
            total_contributions: last.map_or(0.0, MonthlyRow::contributions),
            total_interest: last.map_or(0.0, MonthlyRow::interest),
            yearly: yearly_rows(&monthly),
            monthly,
        }
    }

    /// The balance at the start of the range.
    pub fn start_balance(&self) -> f64 {
        self.start_balance
    }

    pub fn final_balance(&self) -> f64 {
        self.final_balance
    }

    pub fn total_contributions(&self) -> f64 {
        self.total_contributions
    }

    pub fn total_interest(&self) -> f64 {
        self.total_interest
    }

    /// One row per calendar month in the range.
    pub fn monthly(&self) -> &[MonthlyRow] {
        &self.monthly
    }

    /// One row per calendar year in the range, at its last counted segment.
    pub fn yearly(&self) -> &[YearlyRow] {
        &self.yearly
    }
}

fn yearly_rows(monthly: &[MonthlyRow]) -> Vec<YearlyRow> {
    let last_index = monthly.len().checked_sub(1);
    monthly
        .iter()
        .enumerate()
        .filter(|&(index, row)| row.month == LAST_MONTH || Some(index) == last_index)
        .map(|(_, &row)| row.into())
        .collect()
}

/// Projects `account` over the days from `from` up to, and not including, `to`, starting from
/// `opening_balance` at `annual_rate`. When `from` is not before `to`, the series has the opening
/// balance and no rows.
pub(crate) fn project_account<'a>(
    scenario: &Scenario,
    account: &'a Account,
    from: CalendarDate,
    to: CalendarDate,
    opening_balance: f64,
    annual_rate: f64,
) -> Result<Series, ProjectionError<'a>> {
    let monthly = compound_range(scenario, account, from, to, opening_balance, annual_rate)?
        .iter()
        .map(|compounded| MonthlyRow {
            year: compounded.month.from().year(),
            month: compounded.month.from().month(),
            balance: compounded.result.balance(),
            contributions: compounded.total_contributions,
            interest: compounded.total_interest,
        })
        .collect();
    Ok(Series::new(opening_balance, monthly))
}

/// One month's segment of a range and what compounding it did.
struct CompoundedMonth<'a> {
    month: ScheduledMonth<'a>,
    balance_start: f64,
    result: Compounded,
    /// Cumulative since the start of the range.
    total_contributions: f64,
    /// Cumulative since the start of the range.
    total_interest: f64,
}

/// `not_finite` with the account's id when a balance, cumulative contribution or cumulative
/// interest is not finite.
fn compound_range<'a>(
    scenario: &Scenario,
    account: &'a Account,
    from: CalendarDate,
    to: CalendarDate,
    opening_balance: f64,
    annual_rate: f64,
) -> Result<Vec<CompoundedMonth<'a>>, ProjectionError<'a>> {
    let compounding = scenario.interest().compounding();
    let mut balance = opening_balance;
    let mut total_contributions = 0.0;
    let mut total_interest = 0.0;
    let schedule = build_account_schedule(scenario, account, from, to)?;
    let mut compounded = Vec::with_capacity(schedule.len());

    for month in schedule {
        let totals = BucketTotals::of(month.deposits());
        let result = compound_segment(balance, &totals, &month, compounding, annual_rate);
        total_contributions += result.contributions();
        total_interest += result.interest();
        let figures_are_finite = result.balance().is_finite()
            && total_contributions.is_finite()
            && total_interest.is_finite();
        if !figures_are_finite {
            return Err(ProjectionError::NotFinite {
                account: account.id(),
            });
        }
        compounded.push(CompoundedMonth {
            month,
            balance_start: balance,
            result,
            total_contributions,
            total_interest,
        });
        balance = result.balance();
    }

    Ok(compounded)
}

#[cfg(test)]
mod tests;
