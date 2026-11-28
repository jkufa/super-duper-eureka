//! An account's month segments over a range with every figure compounding produced, from the
//! same arithmetic as its series.

use serde::Serialize;

use super::{ProjectionError, compound_range};
use crate::date::CalendarDate;
use crate::scenario::{Account, Scenario};
use crate::schedule::Deposit;

/// One month's segment of a range, as compounded.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceSegment<'a> {
    from: CalendarDate,
    to: CalendarDate,
    days: i8,
    days_in_month: i8,
    days_in_year: i16,
    balance_start: f64,
    balance_end: f64,
    contributions: f64,
    interest: f64,
    annual_rate: f64,
    deposits: Vec<Deposit<'a>>,
}

impl<'a> TraceSegment<'a> {
    /// The first day counted.
    pub fn from(&self) -> CalendarDate {
        self.from
    }

    /// The first day not counted.
    pub fn to(&self) -> CalendarDate {
        self.to
    }

    /// The number of days counted, 1 to `days_in_month`.
    pub fn days(&self) -> i8 {
        self.days
    }

    pub fn days_in_month(&self) -> i8 {
        self.days_in_month
    }

    /// The number of days in the month's calendar year.
    pub fn days_in_year(&self) -> i16 {
        self.days_in_year
    }

    pub fn balance_start(&self) -> f64 {
        self.balance_start
    }

    pub fn balance_end(&self) -> f64 {
        self.balance_end
    }

    /// The segment's deposits as compounded.
    pub fn contributions(&self) -> f64 {
        self.contributions
    }

    pub fn interest(&self) -> f64 {
        self.interest
    }

    /// A fraction: 0.06 is 6 percent.
    pub fn annual_rate(&self) -> f64 {
        self.annual_rate
    }

    /// In schedule order.
    pub fn deposits(&self) -> &[Deposit<'a>] {
        &self.deposits
    }
}

/// The segments behind [`project_account`](super::project_account) with the same arguments, one
/// per calendar month in the range. Empty when `from` is not before `to`.
pub(crate) fn trace_account_range<'a>(
    scenario: &Scenario,
    account: &'a Account,
    from: CalendarDate,
    to: CalendarDate,
    opening_balance: f64,
    annual_rate: f64,
) -> Result<Vec<TraceSegment<'a>>, ProjectionError<'a>> {
    Ok(
        compound_range(scenario, account, from, to, opening_balance, annual_rate)?
            .into_iter()
            .map(|compounded| TraceSegment {
                from: compounded.month.from(),
                to: compounded.month.to(),
                days: compounded.month.days(),
                days_in_month: compounded.month.days_in_month(),
                days_in_year: compounded.month.days_in_year(),
                balance_start: compounded.balance_start,
                balance_end: compounded.result.balance(),
                contributions: compounded.result.contributions(),
                interest: compounded.result.interest(),
                annual_rate,
                deposits: compounded.month.into_deposits(),
            })
            .collect(),
    )
}
