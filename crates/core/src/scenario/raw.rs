//! The scenario file as written, before validation. Text that does not deserialise into these
//! types is the caller's `invalid_field`.

use std::fmt;
use std::marker::PhantomData;

use serde::de::value::MapAccessDeserializer;
use serde::de::{Error as _, MapAccess, Visitor};
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
pub(super) struct Finite(f64);

impl Finite {
    pub(super) fn get(self) -> f64 {
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
/// `unsupported_version` whatever its other keys. Reads from a JSON object only.
#[derive(Debug, Deserialize)]
#[serde(transparent)]
pub struct VersionFile(VersionFields);

impl VersionFile {
    pub fn version(&self) -> Version {
        self.0.version
    }
}

#[derive(Debug, Deserialize)]
#[serde(remote = "Self")]
struct VersionFields {
    version: Version,
}

/// The whole file as written. Reads from a JSON object only, as does every object in it.
#[derive(Debug, Deserialize)]
#[serde(transparent)]
pub struct ScenarioFile(pub(super) ScenarioFields);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, remote = "Self")]
pub(super) struct ScenarioFields {
    pub(super) version: Version,
    /// `YYYY-MM-DD`. A boundary: the last day counted is the day before it.
    pub(super) end_date: String,
    pub(super) interest: InterestFile,
    pub(super) salary: SalaryFile,
    pub(super) accounts: Vec<AccountFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, remote = "Self")]
pub(super) struct InterestFile {
    pub(super) annual_rate: f64,
    #[serde(default, deserialize_with = "present")]
    pub(super) variance: Option<f64>,
    #[serde(default, deserialize_with = "present")]
    pub(super) compounding: Option<Compounding>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, remote = "Self")]
pub(super) struct SalaryFile {
    pub(super) annual_base: Finite,
    #[serde(default, deserialize_with = "present")]
    pub(super) annual_raise_rate: Option<f64>,
    /// `YYYY-MM-DD`. The date `annual_base` was true.
    pub(super) as_of: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, remote = "Self")]
pub(super) struct AccountFile {
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
pub(super) struct ContributionRuleFile {
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

impl<'de> Derived<'de> for ContributionRuleFile {
    fn derived<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
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
#[serde(rename_all = "camelCase", deny_unknown_fields, remote = "Self")]
pub(super) struct GrowthFile {
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
    deny_unknown_fields,
    remote = "Self"
)]
pub(super) enum TimingFile {
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

/// A raw type's reader built on the one `#[derive(Deserialize)]` writes, which accepts a
/// sequence of the fields in order as well as a map.
trait Derived<'de>: Sized {
    fn derived<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error>;
}

struct ObjectOnly<T>(PhantomData<T>);

impl<'de, T: Derived<'de>> Visitor<'de> for ObjectOnly<T> {
    type Value = T;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("an object")
    }

    fn visit_map<A: MapAccess<'de>>(self, map: A) -> Result<T, A::Error> {
        T::derived(MapAccessDeserializer::new(map))
    }
}

/// Each type's [`Derived`] reader is the one serde derives, unchanged.
macro_rules! derived_unchanged {
    ($($file:ty),+) => {$(
        impl<'de> Derived<'de> for $file {
            fn derived<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                Self::deserialize(deserializer)
            }
        }
    )+};
}

/// Each type reads from a map only, through its [`Derived`] reader.
macro_rules! from_objects_only {
    ($($file:ty),+) => {$(
        impl<'de> Deserialize<'de> for $file {
            fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                deserializer.deserialize_map(ObjectOnly(PhantomData))
            }
        }
    )+};
}

derived_unchanged!(
    VersionFields,
    ScenarioFields,
    InterestFile,
    SalaryFile,
    AccountFile,
    GrowthFile,
    TimingFile
);

from_objects_only!(
    VersionFields,
    ScenarioFields,
    InterestFile,
    SalaryFile,
    AccountFile,
    ContributionRuleFile,
    GrowthFile,
    TimingFile
);

fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<T>, D::Error> {
    T::deserialize(deserializer).map(Some)
}
