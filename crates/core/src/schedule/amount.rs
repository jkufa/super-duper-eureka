use crate::date::CalendarDate;
use crate::scenario::{
    ContributionRule, ContributionType, GrowthCadence, GrowthKind, SalaryBasis, Scenario, Timing,
};

const MONTHS_PER_YEAR: i32 = 12;

/// Dollars a year. In a year before `salary.as_of`, the raises are undone by dividing by a
/// positive whole power.
pub fn salary_in_year(scenario: &Scenario, year: i16) -> f64 {
    let salary = scenario.salary();
    let raise = 1.0 + salary.annual_raise_rate();
    let years_after_as_of = i32::from(year) - i32::from(salary.as_of().year());
    if years_after_as_of >= 0 {
        salary.annual_base() * raise.powi(years_after_as_of)
    } else {
        salary.annual_base() / raise.powi(-years_after_as_of)
    }
}

pub(super) fn deposit_amount(
    scenario: &Scenario,
    rule: &ContributionRule,
    date: CalendarDate,
) -> f64 {
    let grown = grown_amount(rule, date);
    match rule.contribution_type() {
        ContributionType::Flat => grown,
        ContributionType::SalaryPercent => {
            let salary = salary_in_year(scenario, date.year());
            match salary_divisor(rule) {
                Some(divisor) => (salary / divisor) * (grown / 100.0),
                None => salary * (grown / 100.0),
            }
        }
    }
}

fn salary_divisor(rule: &ContributionRule) -> Option<f64> {
    match (rule.salary_basis(), rule.timing()) {
        (SalaryBasis::Monthly, _) | (SalaryBasis::PerContribution, Timing::Monthly(_)) => {
            Some(12.0)
        }
        (SalaryBasis::Biweekly, _) => Some(26.0),
        (SalaryBasis::Weekly, _) => Some(52.0),
        (SalaryBasis::Daily, _) => Some(365.0),
        (SalaryBasis::Annual | SalaryBasis::PerContribution, _) => None,
    }
}

fn grown_amount(rule: &ContributionRule, date: CalendarDate) -> f64 {
    let Some(growth) = rule.growth() else {
        return rule.amount();
    };
    let months = whole_months_between(growth.start(), date);
    let periods = match growth.cadence() {
        GrowthCadence::Annual => months.div_euclid(MONTHS_PER_YEAR),
        GrowthCadence::Monthly => months,
    };
    match growth.kind() {
        GrowthKind::Percent => rule.amount() * (1.0 + growth.amount() / 100.0).powi(periods),
        GrowthKind::Flat => rule.amount() + growth.amount() * f64::from(periods),
    }
}

/// The largest `n` for which `start` plus `n` months, the day clamped, is on or before `end`.
fn whole_months_between(start: CalendarDate, end: CalendarDate) -> i32 {
    let months = (i32::from(end.year()) - i32::from(start.year())) * MONTHS_PER_YEAR
        + i32::from(end.month())
        - i32::from(start.month());
    let start_plus_months = end.with_day_clamped(start.day());
    if start_plus_months > end {
        months - 1
    } else {
        months
    }
}
