//! The scenario file as written, before validation. Text that does not deserialise into these
//! types is the caller's `invalid_field`.

use serde::de::Error as _;
use serde::{Deserialize, Deserializer};

use super::Compounding;
use super::account::AccountKind;
use super::error::ScenarioError;
use super::rule::{ContributionType, GrowthCadence, GrowthKind, Placement, SalaryBasis};

/// A whole number. Deserialising anything else fails.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(try_from = "f64")]
pub struct Version(f64);

impl Version {
    /// `unsupported_version` for any version but 1.
    pub fn check(self) -> Result<(), ScenarioError> {
        if self.0 == 1.0 {
            Ok(())
        } else {
            Err(ScenarioError::UnsupportedVersion)
        }
    }
}

impl TryFrom<f64> for Version {
    type Error = &'static str;

    fn try_from(value: f64) -> Result<Self, Self::Error> {
        if value.is_finite() && value.fract() == 0.0 {
            Ok(Self(value))
        } else {
            Err("expected a whole number")
        }
    }
}

/// A finite number. Deserialising NaN or an infinity fails.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(try_from = "f64")]
pub struct Finite(f64);

impl Finite {
    pub fn get(self) -> f64 {
        self.0
    }
}

impl TryFrom<f64> for Finite {
    type Error = &'static str;

    fn try_from(value: f64) -> Result<Self, Self::Error> {
        if value.is_finite() {
            Ok(Self(value))
        } else {
            Err("expected a finite number")
        }
    }
}

/// The one field read before the rest of the file, so that a file from another version reports
/// `unsupported_version` whatever its shape.
#[derive(Debug, Deserialize)]
pub struct VersionFile {
    pub version: Version,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScenarioFile {
    pub(super) version: Version,
    /// `YYYY-MM-DD`. A boundary: the last day counted is the day before it.
    pub(super) end_date: String,
    pub(super) interest: InterestFile,
    pub(super) salary: SalaryFile,
    pub(super) accounts: Vec<AccountFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InterestFile {
    pub(super) annual_rate: f64,
    #[serde(default, deserialize_with = "present")]
    pub(super) variance: Option<f64>,
    #[serde(default, deserialize_with = "present")]
    pub(super) compounding: Option<Compounding>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SalaryFile {
    pub(super) annual_base: Finite,
    #[serde(default, deserialize_with = "present")]
    pub(super) annual_raise_rate: Option<f64>,
    /// `YYYY-MM-DD`. The date `annual_base` was true.
    pub(super) as_of: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountFile {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) kind: AccountKind,
    pub(super) included: bool,
    pub(super) balance: Finite,
    /// `YYYY-MM-DD`. The balance is true at the start of this day.
    pub(super) balance_as_of: String,
    #[serde(default, deserialize_with = "present")]
    pub(super) annual_rate: Option<f64>,
    pub(super) contributions: Vec<ContributionRuleFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, remote = "Self")]
pub struct ContributionRuleFile {
    pub(super) id: String,
    #[serde(default, deserialize_with = "present")]
    pub(super) name: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub(super) enabled: Option<bool>,
    #[serde(rename = "type")]
    pub(super) contribution_type: ContributionType,
    pub(super) amount: Finite,
    #[serde(default, deserialize_with = "present")]
    pub(super) salary_basis: Option<SalaryBasis>,
    #[serde(default, deserialize_with = "present")]
    pub(super) growth: Option<GrowthFile>,
    pub(super) timing: TimingFile,
    /// `YYYY-MM-DD`. Recurring rules only.
    #[serde(default, deserialize_with = "present")]
    pub(super) start_date: Option<String>,
    /// `YYYY-MM-DD`. Recurring rules only.
    #[serde(default, deserialize_with = "present")]
    pub(super) end_date: Option<String>,
}

impl<'de> Deserialize<'de> for ContributionRuleFile {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let rule = Self::deserialize(deserializer)?;
        let has_bounds = rule.start_date.is_some() || rule.end_date.is_some();
        if has_bounds && matches!(rule.timing, TimingFile::OneTime { .. }) {
            return Err(D::Error::custom(
                "startDate and endDate belong to recurring rules only",
            ));
        }
        Ok(rule)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GrowthFile {
    #[serde(rename = "type")]
    pub(super) kind: GrowthKind,
    pub(super) amount: Finite,
    pub(super) cadence: GrowthCadence,
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "frequency",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum TimingFile {
    OneTime {
        /// `YYYY-MM-DD`.
        on: String,
    },
    Monthly {
        #[serde(default, deserialize_with = "present")]
        day: Option<Finite>,
        #[serde(default, deserialize_with = "present")]
        placement: Option<Placement>,
    },
    Annual {
        month: Finite,
        #[serde(default, deserialize_with = "present")]
        day: Option<Finite>,
        #[serde(default, deserialize_with = "present")]
        placement: Option<Placement>,
    },
}

fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<T>, D::Error> {
    T::deserialize(deserializer).map(Some)
}
