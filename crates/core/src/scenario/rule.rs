use std::fmt;

use serde::Deserialize;

use super::account::AccountId;
use super::error::{ScenarioError, Subject};
use super::raw::{ContributionRuleFile, Finite, GrowthFile, TimingFile};
use crate::date::CalendarDate;

const ANY_LEAP_YEAR: i16 = 2000;
const MONTHS_PER_YEAR: i8 = 12;
const MAX_DAY: i8 = 31;

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct RuleId(String);

impl RuleId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RuleId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ContributionType {
    Flat,
    SalaryPercent,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SalaryBasis {
    Annual,
    Monthly,
    Biweekly,
    Weekly,
    Daily,
    PerContribution,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Placement {
    Start,
    End,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GrowthKind {
    Percent,
    Flat,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GrowthCadence {
    Annual,
    Monthly,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Growth {
    kind: GrowthKind,
    amount: f64,
    cadence: GrowthCadence,
    start: CalendarDate,
}

impl Growth {
    pub fn kind(self) -> GrowthKind {
        self.kind
    }

    /// A percent per period for percent growth, dollars per period for flat growth.
    pub fn amount(self) -> f64 {
        self.amount
    }

    pub fn cadence(self) -> GrowthCadence {
        self.cadence
    }

    /// The rule's start date, from which whole periods are counted.
    pub fn start(self) -> CalendarDate {
        self.start
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Timing {
    OneTime(CalendarDate),
    Monthly(MonthlyTiming),
    Annual(AnnualTiming),
}

impl Timing {
    fn bounds(self) -> Option<Bounds> {
        match self {
            Self::OneTime(_) => None,
            Self::Monthly(timing) => Some(timing.bounds),
            Self::Annual(timing) => Some(timing.bounds),
        }
    }
}

/// The days a recurring rule can deposit on, both ends inclusive.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Bounds {
    start: Option<CalendarDate>,
    end: Option<CalendarDate>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MonthlyTiming {
    day: Option<i8>,
    placement: Placement,
    bounds: Bounds,
}

impl MonthlyTiming {
    /// 1 to 31. A day past the end of a month means its last day.
    pub fn day(self) -> Option<i8> {
        self.day
    }

    pub fn placement(self) -> Placement {
        self.placement
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AnnualTiming {
    month: i8,
    day: Option<i8>,
    placement: Placement,
    bounds: Bounds,
}

impl AnnualTiming {
    /// 1 to 12.
    pub fn month(self) -> i8 {
        self.month
    }

    /// A day the month has in a leap year. 29 February means 28 February in other years.
    pub fn day(self) -> Option<i8> {
        self.day
    }

    pub fn placement(self) -> Placement {
        self.placement
    }
}

#[derive(Debug, PartialEq)]
pub struct ContributionRule {
    id: RuleId,
    name: Option<String>,
    enabled: bool,
    contribution_type: ContributionType,
    amount: f64,
    salary_basis: SalaryBasis,
    growth: Option<Growth>,
    timing: Timing,
}

impl ContributionRule {
    pub fn id(&self) -> &RuleId {
        &self.id
    }

    pub fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }

    pub fn enabled(&self) -> bool {
        self.enabled
    }

    pub fn contribution_type(&self) -> ContributionType {
        self.contribution_type
    }

    /// Dollars for a flat rule, a percent of salary for a salary-percent rule. The amount on the
    /// start date when the rule grows.
    pub fn amount(&self) -> f64 {
        self.amount
    }

    pub fn salary_basis(&self) -> SalaryBasis {
        self.salary_basis
    }

    pub fn growth(&self) -> Option<Growth> {
        self.growth
    }

    pub fn timing(&self) -> Timing {
        self.timing
    }

    /// The first day a recurring rule can deposit. Always `None` on a one-time rule.
    pub fn start_date(&self) -> Option<CalendarDate> {
        self.timing.bounds().and_then(|bounds| bounds.start)
    }

    /// The last day a recurring rule can deposit, inclusive. Always `None` on a one-time rule.
    pub fn end_date(&self) -> Option<CalendarDate> {
        self.timing.bounds().and_then(|bounds| bounds.end)
    }

    /// `id_taken` when an earlier rule in the scenario has this rule's id.
    pub(super) fn parse(raw: ContributionRuleFile, id_taken: bool) -> Result<Self, RuleError> {
        let checked = if id_taken {
            Err(Fault::DuplicateId)
        } else {
            Checked::from_file(&raw)
        };
        match checked {
            Ok(checked) => Ok(Self {
                id: RuleId(raw.id),
                name: raw.name,
                enabled: raw.enabled.unwrap_or(true),
                contribution_type: raw.contribution_type,
                amount: raw.amount.get(),
                salary_basis: checked.salary_basis,
                growth: checked.growth,
                timing: checked.timing,
            }),
            Err(fault) => Err(RuleError {
                fault,
                rule: RuleId(raw.id),
            }),
        }
    }
}

/// A rule's fault, before the account that holds the rule is attached.
pub(super) struct RuleError {
    fault: Fault,
    rule: RuleId,
}

impl RuleError {
    pub(super) fn in_account(self, account: AccountId) -> ScenarioError {
        let rule = self.rule;
        match self.fault {
            Fault::DuplicateId => ScenarioError::DuplicateId(Subject::Rule { account, rule }),
            Fault::InvalidDate => ScenarioError::InvalidDate(Subject::Rule { account, rule }),
            Fault::NegativeAmount => ScenarioError::NegativeAmount(Subject::Rule { account, rule }),
            Fault::InvalidDay => ScenarioError::InvalidDay { account, rule },
            Fault::GrowthWithoutStart => ScenarioError::GrowthWithoutStart { account, rule },
            Fault::GrowthOnOneTime => ScenarioError::GrowthOnOneTime { account, rule },
            Fault::EndBeforeStart => ScenarioError::RuleEndBeforeStart { account, rule },
            Fault::PerContributionOnOneTime => {
                ScenarioError::PerContributionOnOneTime { account, rule }
            }
        }
    }
}

enum Fault {
    DuplicateId,
    InvalidDate,
    NegativeAmount,
    InvalidDay,
    GrowthWithoutStart,
    GrowthOnOneTime,
    EndBeforeStart,
    PerContributionOnOneTime,
}

struct Checked {
    salary_basis: SalaryBasis,
    growth: Option<Growth>,
    timing: Timing,
}

impl Checked {
    fn from_file(raw: &ContributionRuleFile) -> Result<Self, Fault> {
        let timing = parse_timing(raw)?;
        let bounds = timing.bounds();
        let start_date = bounds.and_then(|bounds| bounds.start);
        let salary_basis = raw.salary_basis.unwrap_or(SalaryBasis::Annual);
        let is_one_time = matches!(timing, Timing::OneTime(_));

        if raw.amount.get() < 0.0 {
            return Err(Fault::NegativeAmount);
        }
        if is_one_time && salary_basis == SalaryBasis::PerContribution {
            return Err(Fault::PerContributionOnOneTime);
        }
        if let Some(Bounds {
            start: Some(start),
            end: Some(end),
        }) = bounds
            && end < start
        {
            return Err(Fault::EndBeforeStart);
        }
        let growth = match (&raw.growth, start_date) {
            (None, _) => None,
            (Some(_), _) if is_one_time => return Err(Fault::GrowthOnOneTime),
            (Some(_), None) => return Err(Fault::GrowthWithoutStart),
            (Some(growth), Some(start)) => Some(parse_growth(growth, start)?),
        };

        Ok(Self {
            salary_basis,
            growth,
            timing,
        })
    }
}

fn parse_date(text: &str) -> Result<CalendarDate, Fault> {
    CalendarDate::parse(text).ok_or(Fault::InvalidDate)
}

fn parse_growth(raw: &GrowthFile, start: CalendarDate) -> Result<Growth, Fault> {
    if raw.amount.get() < 0.0 {
        return Err(Fault::NegativeAmount);
    }
    Ok(Growth {
        kind: raw.kind,
        amount: raw.amount.get(),
        cadence: raw.cadence,
        start,
    })
}

fn parse_timing(raw: &ContributionRuleFile) -> Result<Timing, Fault> {
    match raw.timing {
        TimingFile::OneTime { ref on } => parse_date(on).map(Timing::OneTime),
        TimingFile::Monthly { day, placement } => Ok(Timing::Monthly(MonthlyTiming {
            day: day.map(|day| whole_number(day, MAX_DAY)).transpose()?,
            placement: placement.unwrap_or(Placement::Start),
            bounds: parse_bounds(raw)?,
        })),
        TimingFile::Annual {
            month,
            day,
            placement,
        } => {
            let month = whole_number(month, MONTHS_PER_YEAR)?;
            let day = day.map(|day| whole_number(day, MAX_DAY)).transpose()?;
            if let Some(day) = day
                && CalendarDate::new(ANY_LEAP_YEAR, month, day).is_none()
            {
                return Err(Fault::InvalidDay);
            }
            Ok(Timing::Annual(AnnualTiming {
                month,
                day,
                placement: placement.unwrap_or(Placement::Start),
                bounds: parse_bounds(raw)?,
            }))
        }
    }
}

fn parse_bounds(raw: &ContributionRuleFile) -> Result<Bounds, Fault> {
    Ok(Bounds {
        start: raw.start_date.as_deref().map(parse_date).transpose()?,
        end: raw.end_date.as_deref().map(parse_date).transpose()?,
    })
}

fn whole_number(value: Finite, max: i8) -> Result<i8, Fault> {
    (1..=max)
        .find(|&candidate| f64::from(candidate) == value.get())
        .ok_or(Fault::InvalidDay)
}
