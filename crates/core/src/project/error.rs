use crate::scenario::AccountId;

/// A projection of a valid scenario that cannot be completed.
#[derive(Debug, PartialEq, thiserror::Error)]
pub enum ProjectionError<'a> {
    #[error(
        "not_finite in account {account}: a balance, contribution or interest figure is not finite"
    )]
    NotFinite { account: &'a AccountId },
}

impl<'a> ProjectionError<'a> {
    /// The same code the TypeScript engine reports.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFinite { .. } => "not_finite",
        }
    }

    pub fn account_id(&self) -> Option<&'a str> {
        match self {
            Self::NotFinite { account } => Some(account.as_str()),
        }
    }
}
