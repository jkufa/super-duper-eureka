use std::fmt;

use serde::Deserialize;

use super::error::{ScenarioError, Subject};
use super::rates_are_valid;
use super::raw::AccountFile;
use super::rule::{ContributionRule, RuleId};
use crate::date::CalendarDate;

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct AccountId(String);

impl AccountId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for AccountId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

/// A label with no effect on the maths.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AccountKind {
    Pretax,
    Roth,
    Taxable,
    Other,
}

#[derive(Debug, PartialEq)]
pub struct Account {
    id: AccountId,
    name: String,
    kind: AccountKind,
    included: bool,
    balance: f64,
    balance_as_of: CalendarDate,
    annual_rate: Option<f64>,
    contributions: Vec<ContributionRule>,
}

impl Account {
    pub fn id(&self) -> &AccountId {
        &self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn kind(&self) -> AccountKind {
        self.kind
    }

    /// Whether the account counts towards the total.
    pub fn included(&self) -> bool {
        self.included
    }

    /// Dollars, at or above 0.
    pub fn balance(&self) -> f64 {
        self.balance
    }

    /// The balance is true at the start of this day, which is on or before today.
    pub fn balance_as_of(&self) -> CalendarDate {
        self.balance_as_of
    }

    /// Overrides the scenario's annual rate. A fraction: 0.06 is 6 percent.
    pub fn annual_rate(&self) -> Option<f64> {
        self.annual_rate
    }

    pub fn contributions(&self) -> &[ContributionRule] {
        &self.contributions
    }

    /// `earlier` holds the accounts before this one in the file, whose ids this one must not reuse.
    pub(super) fn parse(
        raw: AccountFile,
        today: CalendarDate,
        variance: f64,
        earlier: &[Self],
    ) -> Result<Self, ScenarioError> {
        let id = AccountId(raw.id);
        if earlier.iter().any(|account| account.id == id) {
            return Err(ScenarioError::DuplicateId(Subject::Account(id)));
        }
        let balance = raw.balance.get();
        if balance < 0.0 {
            return Err(ScenarioError::NegativeBalance { account: id });
        }
        let Some(balance_as_of) = CalendarDate::parse(&raw.balance_as_of) else {
            return Err(ScenarioError::InvalidDate(Subject::Account(id)));
        };
        if balance_as_of > today {
            return Err(ScenarioError::AsOfInFuture { account: id });
        }
        if let Some(rate) = raw.annual_rate
            && !rates_are_valid(rate, variance)
        {
            return Err(ScenarioError::InvalidRate(Subject::Account(id)));
        }

        let mut contributions = Vec::with_capacity(raw.contributions.len());
        for raw_rule in raw.contributions {
            let taken = earlier
                .iter()
                .flat_map(Self::contributions)
                .chain(&contributions)
                .any(|rule| rule.id().as_str() == raw_rule.id);
            if taken {
                let rule = RuleId(raw_rule.id);
                return Err(ScenarioError::DuplicateId(Subject::Rule {
                    account: id,
                    rule,
                }));
            }
            match ContributionRule::parse(raw_rule) {
                Ok(rule) => contributions.push(rule),
                Err(error) => return Err(error.in_account(id)),
            }
        }

        Ok(Self {
            id,
            name: raw.name,
            kind: raw.kind,
            included: raw.included,
            balance,
            balance_as_of,
            annual_rate: raw.annual_rate,
            contributions,
        })
    }
}
