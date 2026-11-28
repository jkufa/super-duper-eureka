use std::fmt;

use super::account::AccountId;
use super::rule::RuleId;

/// Where in the scenario a fault sits.
#[derive(Debug, PartialEq)]
pub enum Subject {
    Scenario,
    Account(AccountId),
    Rule { account: AccountId, rule: RuleId },
}

impl Subject {
    fn account_id(&self) -> Option<&AccountId> {
        match self {
            Self::Scenario => None,
            Self::Account(account) | Self::Rule { account, .. } => Some(account),
        }
    }

    fn rule_id(&self) -> Option<&RuleId> {
        match self {
            Self::Scenario | Self::Account(_) => None,
            Self::Rule { rule, .. } => Some(rule),
        }
    }
}

impl fmt::Display for Subject {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Scenario => formatter.write_str("the scenario"),
            Self::Account(account) => write!(formatter, "account {account}"),
            Self::Rule { account, rule } => write!(formatter, "rule {rule} of account {account}"),
        }
    }
}

/// A well-shaped scenario file that breaks a rule of the contract.
#[derive(Debug, PartialEq, thiserror::Error)]
pub enum ScenarioError {
    #[error("unsupported_version: expected version 1")]
    UnsupportedVersion,
    #[error("invalid_date in {0}: not a real YYYY-MM-DD date")]
    InvalidDate(Subject),
    #[error("end_not_after_today: the end date is on or before today")]
    EndNotAfterToday,
    #[error("as_of_in_future in account {account}: the balance is dated after today")]
    AsOfInFuture { account: AccountId },
    #[error("negative_balance in account {account}: the balance is below 0")]
    NegativeBalance { account: AccountId },
    #[error("invalid_rate in {0}: a rate, raise or variance is out of range")]
    InvalidRate(Subject),
    #[error("negative_amount in {0}: an amount is below 0")]
    NegativeAmount(Subject),
    #[error("duplicate_id in {0}: an earlier account or rule has this id")]
    DuplicateId(Subject),
    #[error("invalid_day in rule {rule} of account {account}: no such day or month")]
    InvalidDay { account: AccountId, rule: RuleId },
    #[error("growth_without_start in rule {rule} of account {account}: growth needs a start date")]
    GrowthWithoutStart { account: AccountId, rule: RuleId },
    #[error("growth_on_one_time in rule {rule} of account {account}: a one-time rule cannot grow")]
    GrowthOnOneTime { account: AccountId, rule: RuleId },
    #[error("rule_end_before_start in rule {rule} of account {account}: ends before it starts")]
    RuleEndBeforeStart { account: AccountId, rule: RuleId },
    #[error(
        "per_contribution_on_one_time in rule {rule} of account {account}: \
         a one-time rule cannot use perContribution"
    )]
    PerContributionOnOneTime { account: AccountId, rule: RuleId },
}

impl ScenarioError {
    /// The same code the TypeScript engine reported.
    pub fn code(&self) -> &'static str {
        match self {
            Self::UnsupportedVersion => "unsupported_version",
            Self::InvalidDate(_) => "invalid_date",
            Self::EndNotAfterToday => "end_not_after_today",
            Self::AsOfInFuture { .. } => "as_of_in_future",
            Self::NegativeBalance { .. } => "negative_balance",
            Self::InvalidRate(_) => "invalid_rate",
            Self::NegativeAmount(_) => "negative_amount",
            Self::DuplicateId(_) => "duplicate_id",
            Self::InvalidDay { .. } => "invalid_day",
            Self::GrowthWithoutStart { .. } => "growth_without_start",
            Self::GrowthOnOneTime { .. } => "growth_on_one_time",
            Self::RuleEndBeforeStart { .. } => "rule_end_before_start",
            Self::PerContributionOnOneTime { .. } => "per_contribution_on_one_time",
        }
    }

    pub fn account_id(&self) -> Option<&AccountId> {
        match self {
            Self::UnsupportedVersion | Self::EndNotAfterToday => None,
            Self::InvalidDate(subject)
            | Self::InvalidRate(subject)
            | Self::NegativeAmount(subject)
            | Self::DuplicateId(subject) => subject.account_id(),
            Self::AsOfInFuture { account }
            | Self::NegativeBalance { account }
            | Self::InvalidDay { account, .. }
            | Self::GrowthWithoutStart { account, .. }
            | Self::GrowthOnOneTime { account, .. }
            | Self::RuleEndBeforeStart { account, .. }
            | Self::PerContributionOnOneTime { account, .. } => Some(account),
        }
    }

    pub fn rule_id(&self) -> Option<&RuleId> {
        match self {
            Self::UnsupportedVersion
            | Self::EndNotAfterToday
            | Self::AsOfInFuture { .. }
            | Self::NegativeBalance { .. } => None,
            Self::InvalidDate(subject)
            | Self::InvalidRate(subject)
            | Self::NegativeAmount(subject)
            | Self::DuplicateId(subject) => subject.rule_id(),
            Self::InvalidDay { rule, .. }
            | Self::GrowthWithoutStart { rule, .. }
            | Self::GrowthOnOneTime { rule, .. }
            | Self::RuleEndBeforeStart { rule, .. }
            | Self::PerContributionOnOneTime { rule, .. } => Some(rule),
        }
    }
}
