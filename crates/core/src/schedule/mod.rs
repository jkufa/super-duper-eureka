//! An account's deposits over a range of days, month by month, before any interest is added.

mod amount;

use std::iter;

use crate::date::CalendarDate;
use crate::project::ProjectionError;
use crate::scenario::{
    Account, Compounding, ContributionRule, Placement, RuleId, Scenario, Timing,
};

pub use amount::salary_in_year;

/// Where compounding adds a deposit within its month.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bucket {
    Start,
    End,
    /// A day of the month, 1 to 31. Only in daily compounding.
    Day(i8),
}

impl From<Placement> for Bucket {
    fn from(placement: Placement) -> Self {
        match placement {
            Placement::Start => Self::Start,
            Placement::End => Self::End,
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct Deposit<'a> {
    rule_id: &'a RuleId,
    date: CalendarDate,
    amount: f64,
    bucket: Bucket,
}

impl<'a> Deposit<'a> {
    pub fn rule_id(&self) -> &'a RuleId {
        self.rule_id
    }

    /// Inside its month's segment.
    pub fn date(&self) -> CalendarDate {
        self.date
    }

    /// Dollars, finite and never 0.
    pub fn amount(&self) -> f64 {
        self.amount
    }

    pub fn bucket(&self) -> Bucket {
        self.bucket
    }
}

/// The days of one calendar month inside a range, and the deposits dated on them.
#[derive(Debug, PartialEq)]
pub struct ScheduledMonth<'a> {
    from: CalendarDate,
    to: CalendarDate,
    days: i8,
    days_in_month: i8,
    days_in_year: i16,
    deposits: Vec<Deposit<'a>>,
}

impl<'a> ScheduledMonth<'a> {
    /// The first day counted.
    pub fn from(&self) -> CalendarDate {
        self.from
    }

    /// The first day not counted: the range's end or the 1st of the next month.
    pub fn to(&self) -> CalendarDate {
        self.to
    }

    /// The day of the month of `from`.
    pub fn first_day(&self) -> i8 {
        self.from.day()
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

    /// In the order of the rules in the account.
    pub fn deposits(&self) -> &[Deposit<'a>] {
        &self.deposits
    }
}

/// One month per calendar month from `from` up to, and not including, `to`. Empty when `from` is
/// not before `to`. `not_finite` with the account's id when a deposit's amount is not finite.
pub fn build_account_schedule<'a>(
    scenario: &Scenario,
    account: &'a Account,
    from: CalendarDate,
    to: CalendarDate,
) -> Result<Vec<ScheduledMonth<'a>>, ProjectionError<'a>> {
    month_segments(from, to)
        .map(|segment| {
            let deposits = month_deposits(scenario, account, segment.from, segment.to)?;
            Ok(ScheduledMonth {
                deposits,
                ..segment
            })
        })
        .collect()
}

/// The months of [`build_account_schedule`] with no deposits.
pub(crate) fn month_segments<'a>(
    from: CalendarDate,
    to: CalendarDate,
) -> impl Iterator<Item = ScheduledMonth<'a>> {
    let first_month = (from < to).then_some(from.with_day_clamped(1));
    iter::successors(first_month, |first| first.checked_add_months(1))
        .take_while(move |&first| first < to)
        .map(move |first| month_segment(first, from, to))
}

fn month_segment<'a>(
    first: CalendarDate,
    from: CalendarDate,
    to: CalendarDate,
) -> ScheduledMonth<'a> {
    let next_month = first.checked_add_months(1).filter(|&next| next <= to);
    let segment_from = from.max(first);
    let (segment_to, last_day) = match next_month {
        Some(next) => (next, first.days_in_month()),
        None => (to, to.day() - 1),
    };
    ScheduledMonth {
        from: segment_from,
        to: segment_to,
        days: last_day - segment_from.day() + 1,
        days_in_month: first.days_in_month(),
        days_in_year: first.days_in_year(),
        deposits: Vec::new(),
    }
}

fn month_deposits<'a>(
    scenario: &Scenario,
    account: &'a Account,
    from: CalendarDate,
    to: CalendarDate,
) -> Result<Vec<Deposit<'a>>, ProjectionError<'a>> {
    let compounding = scenario.interest().compounding();
    let mut deposits = Vec::new();
    for rule in account.contributions().iter().filter(|rule| rule.enabled()) {
        let Some(date) = deposit_date(rule, from).filter(|date| (from..to).contains(date)) else {
            continue;
        };
        let amount = amount::deposit_amount(scenario, rule, date);
        if !amount.is_finite() {
            return Err(ProjectionError::NotFinite {
                account: account.id(),
            });
        }
        if amount != 0.0 {
            deposits.push(Deposit {
                rule_id: rule.id(),
                date,
                amount,
                bucket: deposit_bucket(rule.timing(), date, compounding),
            });
        }
    }
    Ok(deposits)
}

/// `in_month` is any day of the month.
fn deposit_date(rule: &ContributionRule, in_month: CalendarDate) -> Option<CalendarDate> {
    let (day, placement) = match rule.timing() {
        Timing::OneTime(on) => {
            let same_month = on.year() == in_month.year() && on.month() == in_month.month();
            return same_month.then_some(on);
        }
        Timing::Annual(timing) if timing.month() != in_month.month() => return None,
        Timing::Annual(timing) => (timing.day(), timing.placement()),
        Timing::Monthly(timing) => (timing.day(), timing.placement()),
    };
    let day = day.unwrap_or(match placement {
        Placement::Start => 1,
        Placement::End => in_month.days_in_month(),
    });
    let date = in_month.with_day_clamped(day);
    let after_start = rule.start_date().is_none_or(|start| date >= start);
    let before_end = rule.end_date().is_none_or(|end| date <= end);
    (after_start && before_end).then_some(date)
}

fn deposit_bucket(timing: Timing, date: CalendarDate, compounding: Compounding) -> Bucket {
    let (day, placement) = match timing {
        Timing::OneTime(_) => {
            return match compounding {
                Compounding::Daily => Bucket::Day(date.day()),
                Compounding::Monthly => Bucket::Start,
            };
        }
        Timing::Monthly(timing) => (timing.day(), timing.placement()),
        Timing::Annual(timing) => (timing.day(), timing.placement()),
    };
    match (day, compounding) {
        (None, _) => placement.into(),
        (Some(_), Compounding::Daily) => Bucket::Day(date.day()),
        (Some(_), Compounding::Monthly) if date.day() <= (date.days_in_month() + 1) / 2 => {
            Bucket::Start
        }
        (Some(_), Compounding::Monthly) => Bucket::End,
    }
}

#[cfg(test)]
mod tests;
