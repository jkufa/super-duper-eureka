use crate::scenario::AccountId;

/// A projection or trace of a valid scenario that cannot be completed.
#[derive(Debug, PartialEq, thiserror::Error)]
pub enum ProjectionError<'a> {
    #[error(
        "not_finite in account {account}: a balance, contribution or interest figure is not finite"
    )]
    NotFinite { account: &'a AccountId },
    #[error(
        "not_finite in the scenario: a total, salary or weighted rate is not finite although \
         every account's figures are"
    )]
    ScenarioNotFinite,
    #[error("unknown_account {account}: the scenario has no account with this id")]
    UnknownAccount { account: &'a str },
}

impl<'a> ProjectionError<'a> {
    /// The same code the TypeScript engine reported.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFinite { .. } | Self::ScenarioNotFinite => "not_finite",
            Self::UnknownAccount { .. } => "unknown_account",
        }
    }

    pub fn account_id(&self) -> Option<&'a str> {
        match self {
            Self::NotFinite { account } => Some(account.as_str()),
            Self::UnknownAccount { account } => Some(account),
            Self::ScenarioNotFinite => None,
        }
    }
}
