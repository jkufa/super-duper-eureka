//! Spec 4 part G's properties, over valid scenarios from [`crate::arbitrary`]. The fifth, on the
//! pool, sits with the effective rate's tests, where the pool is visible.

use proptest::prelude::*;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::arbitrary::{
    Case, any_case, case_with_accounts, case_with_empty_pools, case_with_money_at_interest, check,
    fresh_case,
};
use crate::date::CalendarDate;
use crate::project::{
    AccountProjection, Band, MonthlyRow, Series, TraceSegment, YearlyRow, project_account,
    project_scenario, trace_account,
};
use crate::scenario::raw::ScenarioFile;
use crate::scenario::{
    AccountKind, Compounding, ContributionRule, ContributionType, GrowthCadence, GrowthKind,
    Placement, SalaryBasis, Scenario, Timing,
};

fn rate_of(scenario: &Scenario, index: usize) -> f64 {
    scenario.accounts()[index]
        .annual_rate()
        .unwrap_or(scenario.interest().annual_rate())
}

/// `(balance, contributions, interest)` summed from 0 over the included accounts in file order.
fn summed(
    accounts: &[AccountProjection<'_>],
    row: impl Fn(&Series) -> (f64, f64, f64),
) -> (f64, f64, f64) {
    accounts
        .iter()
        .filter(|account| account.included())
        .map(|account| row(account.series()))
        .fold((0.0, 0.0, 0.0), |(b, c, i), (row_b, row_c, row_i)| {
            (b + row_b, c + row_c, i + row_i)
        })
}

fn monthly_figures(row: MonthlyRow) -> (f64, f64, f64) {
    (row.balance(), row.contributions(), row.interest())
}

fn yearly_figures(row: YearlyRow) -> (f64, f64, f64) {
    (row.balance(), row.contributions(), row.interest())
}

/// The `(year, month)` of each month from today's to the one holding the day before the end
/// date.
fn months_of_range(scenario: &Scenario) -> Vec<(i16, i8)> {
    let mut first_of_month = scenario.today().with_day_clamped(1);
    let mut months = Vec::new();
    while first_of_month < scenario.end_date() {
        months.push((first_of_month.year(), first_of_month.month()));
        first_of_month = first_of_month.checked_add_months(1).unwrap();
    }
    months
}

/// Checks a band's total rows against the months of the range and against its accounts summed
/// row by row.
fn check_total(
    scenario: &Scenario,
    accounts: &[AccountProjection<'_>],
    monthly: &[MonthlyRow],
    yearly: &[YearlyRow],
) -> Result<(), TestCaseError> {
    let months: Vec<(i16, i8)> = monthly
        .iter()
        .map(|row| (row.year(), row.month()))
        .collect();
    prop_assert_eq!(&months, &months_of_range(scenario));
    let mut years: Vec<i16> = months.iter().map(|&(year, _)| year).collect();
    years.dedup();
    let yearly_years: Vec<i16> = yearly.iter().map(|row| row.year()).collect();
    prop_assert_eq!(yearly_years, years);
    for account in accounts {
        let series = account.series();
        prop_assert_eq!(
            (series.monthly().len(), series.yearly().len()),
            (monthly.len(), yearly.len())
        );
    }
    for (index, &row) in monthly.iter().enumerate() {
        let sum = summed(accounts, |series| monthly_figures(series.monthly()[index]));
        prop_assert_eq!(monthly_figures(row), sum, "monthly row {}", index);
    }
    for (index, &row) in yearly.iter().enumerate() {
        let sum = summed(accounts, |series| yearly_figures(series.yearly()[index]));
        prop_assert_eq!(yearly_figures(row), sum, "yearly row {}", index);
    }
    Ok(())
}

fn next_day(date: CalendarDate) -> CalendarDate {
    if date.day() < date.days_in_month() {
        CalendarDate::new(date.year(), date.month(), date.day() + 1).unwrap()
    } else {
        date.with_day_clamped(1).checked_add_months(1).unwrap()
    }
}

/// Every deposit in the account's trace from its balance's date to the end, sorted.
fn traced_deposits(scenario: &Scenario, account_id: &str) -> Vec<(String, String, u64)> {
    let mut deposits: Vec<_> = trace_account(scenario, account_id, Band::Baseline)
        .unwrap()
        .iter()
        .flat_map(TraceSegment::deposits)
        .map(|deposit| {
            (
                deposit.date().to_string(),
                deposit.rule_id().to_string(),
                deposit.amount().to_bits(),
            )
        })
        .collect();
    deposits.sort_unstable();
    deposits
}

fn compounding_name(compounding: Compounding) -> &'static str {
    match compounding {
        Compounding::Monthly => "monthly",
        Compounding::Daily => "daily",
    }
}

fn kind_name(kind: AccountKind) -> &'static str {
    match kind {
        AccountKind::Pretax => "pretax",
        AccountKind::Roth => "roth",
        AccountKind::Taxable => "taxable",
        AccountKind::Other => "other",
    }
}

fn placement_name(placement: Placement) -> &'static str {
    match placement {
        Placement::Start => "start",
        Placement::End => "end",
    }
}

fn basis_name(basis: SalaryBasis) -> &'static str {
    match basis {
        SalaryBasis::Annual => "annual",
        SalaryBasis::Monthly => "monthly",
        SalaryBasis::Biweekly => "biweekly",
        SalaryBasis::Weekly => "weekly",
        SalaryBasis::Daily => "daily",
        SalaryBasis::PerContribution => "perContribution",
    }
}

fn timing_file(timing: Timing) -> Value {
    match timing {
        Timing::OneTime(on) => json!({ "frequency": "oneTime", "on": on.to_string() }),
        Timing::Monthly(monthly) => json!({
            "frequency": "monthly",
            "day": monthly.day(),
            "placement": placement_name(monthly.placement())
        }),
        Timing::Annual(annual) => json!({
            "frequency": "annual",
            "month": annual.month(),
            "day": annual.day(),
            "placement": placement_name(annual.placement())
        }),
    }
}

fn without_nulls(mut value: Value) -> Value {
    if let Some(object) = value.as_object_mut() {
        object.retain(|_, field| !field.is_null());
        for field in object.values_mut() {
            *field = without_nulls(field.take());
        }
    }
    if let Some(items) = value.as_array_mut() {
        for item in items.iter_mut() {
            *item = without_nulls(item.take());
        }
    }
    value
}

fn rule_file(rule: &ContributionRule) -> Value {
    let recurring = !matches!(rule.timing(), Timing::OneTime(_));
    json!({
        "id": rule.id().as_str(),
        "name": rule.name(),
        "enabled": rule.enabled(),
        "type": match rule.contribution_type() {
            ContributionType::Flat => "flat",
            ContributionType::SalaryPercent => "salaryPercent",
        },
        "amount": rule.amount(),
        "salaryBasis": (recurring || rule.salary_basis() != SalaryBasis::PerContribution)
            .then(|| basis_name(rule.salary_basis())),
        "growth": rule.growth().map(|growth| json!({
            "type": match growth.kind() {
                GrowthKind::Percent => "percent",
                GrowthKind::Flat => "flat",
            },
            "amount": growth.amount(),
            "cadence": match growth.cadence() {
                GrowthCadence::Annual => "annual",
                GrowthCadence::Monthly => "monthly",
            }
        })),
        "timing": timing_file(rule.timing()),
        "startDate": rule.start_date().map(|date| date.to_string()),
        "endDate": rule.end_date().map(|date| date.to_string())
    })
}

/// A scenario file that states every field of `scenario`, defaults included.
fn file_of(scenario: &Scenario) -> Value {
    let interest = scenario.interest();
    let salary = scenario.salary();
    without_nulls(json!({
        "version": 1,
        "endDate": scenario.end_date().to_string(),
        "interest": {
            "annualRate": interest.annual_rate(),
            "variance": interest.variance(),
            "compounding": compounding_name(interest.compounding())
        },
        "salary": {
            "annualBase": salary.annual_base(),
            "annualRaiseRate": salary.annual_raise_rate(),
            "asOf": salary.as_of().to_string()
        },
        "accounts": scenario.accounts().iter().map(|account| json!({
            "id": account.id().as_str(),
            "name": account.name(),
            "kind": kind_name(account.kind()),
            "included": account.included(),
            "balance": account.balance(),
            "balanceAsOf": account.balance_as_of().to_string(),
            "annualRate": account.annual_rate(),
            "contributions": account.contributions().iter().map(rule_file).collect::<Vec<_>>()
        })).collect::<Vec<_>>()
    }))
}

/// The case with one account's rate raised by `raise`.
fn with_raised_rate(case: &Case, scenario: &Scenario, index: usize, raise: f64) -> Scenario {
    let mut file = case.file.clone();
    file["accounts"][index]["annualRate"] = json!(rate_of(scenario, index) + raise);
    Scenario::parse(ScenarioFile::deserialize(&file).unwrap(), case.today).unwrap()
}

#[test]
fn one_fresh_account_projects_as_project_account() {
    check(&fresh_case(), |case| {
        let scenario = case.scenario();
        let projection = project_scenario(&scenario).unwrap();
        let account = &scenario.accounts()[0];
        let alone = project_account(
            &scenario,
            account,
            scenario.today(),
            scenario.end_date(),
            account.balance(),
            rate_of(&scenario, 0),
        )
        .unwrap();
        prop_assert_eq!(projection.bands().baseline().accounts()[0].series(), &alone);
        Ok(())
    });
}

#[test]
fn total_is_the_sum_of_included_accounts_on_every_row() {
    check(&any_case(), |case| {
        let scenario = case.scenario();
        let projection = project_scenario(&scenario).unwrap();
        let bands = projection.bands();
        let baseline = bands.baseline();
        let yearly: Vec<YearlyRow> = baseline
            .total()
            .yearly()
            .iter()
            .map(|row| row.row())
            .collect();
        check_total(
            &scenario,
            baseline.accounts(),
            baseline.total().monthly(),
            &yearly,
        )?;
        for band in [bands.positive(), bands.negative()] {
            check_total(
                &scenario,
                band.accounts(),
                band.total().monthly(),
                band.total().yearly(),
            )?;
        }
        Ok(())
    });
}

#[test]
fn raising_the_rate_of_an_account_with_money_never_lowers_the_final_total() {
    let strategy = (
        case_with_money_at_interest(),
        any::<prop::sample::Index>(),
        0.0001..0.1_f64,
    );
    check(&strategy, |((case, earning), pick, raise)| {
        let scenario = case.scenario();
        let index = earning[pick.index(earning.len())];
        let raised = with_raised_rate(&case, &scenario, index, raise);
        let before = project_scenario(&scenario).unwrap();
        let after = project_scenario(&raised).unwrap();
        let before = before.bands().baseline().total().final_balance();
        let after = after.bands().baseline().total().final_balance();
        prop_assert!(
            after >= before,
            "raising a{} by {} moved the final total from {} to {}",
            index,
            raise,
            before,
            after
        );
        Ok(())
    });
}

#[test]
fn effective_rate_is_the_default_without_a_pool_and_otherwise_within_the_included_rates() {
    check(&case_with_empty_pools(), |case| {
        let scenario = case.scenario();
        let projection = project_scenario(&scenario).unwrap();
        let rates: Vec<f64> = (0..scenario.accounts().len())
            .filter(|&index| scenario.accounts()[index].included())
            .map(|index| rate_of(&scenario, index))
            .collect();
        let total = projection.bands().baseline().total();
        let empty_pool = total.start_balance() == 0.0 && total.total_contributions() == 0.0;
        let rate = projection.effective_rate();
        let default_rate = scenario.interest().annual_rate();
        let lowest = rates.iter().copied().min_by(f64::total_cmp);
        let highest = rates.iter().copied().max_by(f64::total_cmp);
        match lowest.zip(highest) {
            None => prop_assert!(
                rate.to_bits() == default_rate.to_bits(),
                "rate {} is not the default {} with no included account",
                rate,
                default_rate
            ),
            Some((lowest, highest)) if lowest == highest => prop_assert!(
                rate.to_bits() == lowest.to_bits(),
                "rate {} is not {}, the rate of every included account",
                rate,
                lowest
            ),
            Some(_) if empty_pool => prop_assert!(
                rate.to_bits() == default_rate.to_bits(),
                "rate {} is not the default {} with an empty pool",
                rate,
                default_rate
            ),
            Some((lowest, highest)) => prop_assert!(
                lowest <= rate && rate <= highest,
                "rate {} outside {}..={}",
                rate,
                lowest,
                highest
            ),
        }
        Ok(())
    });
}

#[test]
fn an_account_that_is_not_stale_rolls_forward_nothing() {
    check(&case_with_accounts(), |case| {
        let scenario = case.scenario();
        let projection = project_scenario(&scenario).unwrap();
        let bands = projection.bands();
        for accounts in [
            bands.baseline().accounts(),
            bands.positive().accounts(),
            bands.negative().accounts(),
        ] {
            for (account, projected) in scenario.accounts().iter().zip(accounts) {
                if account.balance_as_of() == scenario.today() {
                    let rolled = projected.rolled_forward();
                    prop_assert_eq!((rolled.contributions(), rolled.interest()), (0.0, 0.0));
                }
            }
        }
        Ok(())
    });
}

#[test]
fn moving_today_one_day_later_keeps_every_deposit() {
    check(&case_with_accounts(), |case| {
        let later = next_day(case.today);
        let scenario = case.scenario();
        prop_assume!(later < scenario.end_date());
        let moved = case.scenario_on(later);
        for account in scenario.accounts() {
            let id = account.id().as_str();
            prop_assert_eq!(traced_deposits(&scenario, id), traced_deposits(&moved, id));
        }
        Ok(())
    });
}

#[test]
fn parsing_a_serialised_scenario_gives_it_back() {
    check(&any_case(), |case| {
        let scenario = case.scenario();
        let text = file_of(&scenario).to_string();
        let file: ScenarioFile = serde_json::from_str(&text).unwrap();
        prop_assert_eq!(Scenario::parse(file, case.today).unwrap(), scenario);
        Ok(())
    });
}
