//! The scenario the engine runs on. A [`raw::ScenarioFile`] becomes a [`Scenario`] only through
//! [`Scenario::parse`], so every value the engine reads has passed validation.

mod account;
mod error;
pub mod raw;
mod rule;

use serde::Deserialize;

pub use account::{Account, AccountId, AccountKind};
pub use error::{ScenarioError, Subject};
pub use rule::{
    AnnualTiming, ContributionRule, ContributionType, Growth, GrowthCadence, GrowthKind,
    MonthlyTiming, Placement, RuleId, SalaryBasis, Timing,
};

use crate::date::CalendarDate;
use raw::ScenarioFile;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Compounding {
    Monthly,
    Daily,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Interest {
    annual_rate: f64,
    variance: f64,
    compounding: Compounding,
}

impl Interest {
    /// A fraction: 0.06 is 6 percent.
    pub fn annual_rate(self) -> f64 {
        self.annual_rate
    }

    /// At or above 0. Every rate minus the variance is above -1, and plus it is finite.
    pub fn variance(self) -> f64 {
        self.variance
    }

    pub fn compounding(self) -> Compounding {
        self.compounding
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Salary {
    annual_base: f64,
    annual_raise_rate: f64,
    as_of: CalendarDate,
}

impl Salary {
    /// Dollars a year, at or above 0, true on `as_of`.
    pub fn annual_base(self) -> f64 {
        self.annual_base
    }

    /// A fraction above -1, applied on each 1 January after `as_of`.
    pub fn annual_raise_rate(self) -> f64 {
        self.annual_raise_rate
    }

    pub fn as_of(self) -> CalendarDate {
        self.as_of
    }
}

#[derive(Debug, PartialEq)]
pub struct Scenario {
    end_date: CalendarDate,
    interest: Interest,
    salary: Salary,
    accounts: Vec<Account>,
}

impl Scenario {
    /// A boundary after today: the last day counted is the day before it.
    pub fn end_date(&self) -> CalendarDate {
        self.end_date
    }

    pub fn interest(&self) -> Interest {
        self.interest
    }

    pub fn salary(&self) -> Salary {
        self.salary
    }

    /// Ids are unique among accounts, and among rules across all accounts.
    pub fn accounts(&self) -> &[Account] {
        &self.accounts
    }

    /// `today` is the first day of the results.
    pub fn parse(raw: ScenarioFile, today: CalendarDate) -> Result<Self, ScenarioError> {
        raw.version.check()?;
        let interest = parse_interest(&raw.interest)?;
        let salary = parse_salary(&raw.salary)?;
        let Some(end_date) = CalendarDate::parse(&raw.end_date) else {
            return Err(ScenarioError::InvalidDate(Subject::Scenario));
        };
        if end_date <= today {
            return Err(ScenarioError::EndNotAfterToday);
        }

        let mut accounts = Vec::with_capacity(raw.accounts.len());
        for raw_account in raw.accounts {
            let account = Account::parse(raw_account, today, interest.variance, &accounts)?;
            accounts.push(account);
        }

        Ok(Self {
            end_date,
            interest,
            salary,
            accounts,
        })
    }
}

fn parse_interest(raw: &raw::InterestFile) -> Result<Interest, ScenarioError> {
    let variance = raw.variance.unwrap_or(0.0);
    let variance_is_valid = variance.is_finite() && variance >= 0.0;
    if !variance_is_valid || !rates_are_valid(raw.annual_rate, variance) {
        return Err(ScenarioError::InvalidRate(Subject::Scenario));
    }
    Ok(Interest {
        annual_rate: raw.annual_rate,
        variance,
        compounding: raw.compounding.unwrap_or(Compounding::Monthly),
    })
}

fn parse_salary(raw: &raw::SalaryFile) -> Result<Salary, ScenarioError> {
    let annual_base = raw.annual_base.get();
    if annual_base < 0.0 {
        return Err(ScenarioError::NegativeAmount(Subject::Scenario));
    }
    let annual_raise_rate = raw.annual_raise_rate.unwrap_or(0.0);
    if !(annual_raise_rate.is_finite() && annual_raise_rate > -1.0) {
        return Err(ScenarioError::InvalidRate(Subject::Scenario));
    }
    let Some(as_of) = CalendarDate::parse(&raw.as_of) else {
        return Err(ScenarioError::InvalidDate(Subject::Scenario));
    };
    Ok(Salary {
        annual_base,
        annual_raise_rate,
        as_of,
    })
}

/// True when the rate is finite, the rate minus the variance is above -1 and the rate plus the
/// variance is finite.
fn rates_are_valid(rate: f64, variance: f64) -> bool {
    rate.is_finite() && rate - variance > -1.0 && (rate + variance).is_finite()
}

#[cfg(test)]
mod tests;
