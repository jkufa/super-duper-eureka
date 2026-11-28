use crate::scenario::AccountId;

/// A projection of a valid scenario that cannot be completed.
#[derive(Debug, PartialEq, thiserror::Error)]
pub enum ProjectionError<'a> {
    #[error(
        "not_finite in account {account}: a balance, contribution or interest figure is not finite"
    )]
    NotFinite { account: &'a AccountId },
    #[error(
        "not_finite in the total: a balance, contribution or interest figure is not finite \
         although every account's is"
    )]
    TotalNotFinite,
}

impl<'a> ProjectionError<'a> {
    /// The same code the TypeScript engine reports.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFinite { .. } | Self::TotalNotFinite => "not_finite",
        }
    }

    pub fn account_id(&self) -> Option<&'a str> {
        match self {
            Self::NotFinite { account } => Some(account.as_str()),
            Self::TotalNotFinite => None,
        }
    }
}
