use serde_json::json;

use super::{
    AccountProjection, Band, ScenarioProjection, WeightedSeries, WeightedYearlyRow,
    project_scenario, trace_account,
};
use crate::date::CalendarDate;
use crate::fixture::{
    Segment, Setup, date, doubling_daily_rate, flat, monthly, monthly_end, segments, traced_deposit,
};
use crate::project::{MonthlyRow, ProjectionError, Series, YearlyRow};
use crate::scenario::Scenario;
use crate::schedule::Bucket;

const DOUBLING_MONTHLY_RATE: f64 = 4095.0;

fn project(scenario: &Scenario) -> ScenarioProjection<'_> {
    project_scenario(scenario).unwrap()
}

fn month_row(year: i16, month: i8, balance: f64, contributions: f64, interest: f64) -> MonthlyRow {
    MonthlyRow {
        year,
        month,
        balance,
        contributions,
        interest,
    }
}

fn year_row(year: i16, balance: f64, contributions: f64, interest: f64) -> YearlyRow {
    YearlyRow {
        year,
        balance,
        contributions,
        interest,
    }
}

fn only_account<'p, 'a>(accounts: &'p [AccountProjection<'a>]) -> &'p AccountProjection<'a> {
    let [account] = accounts else {
        panic!("expected one account");
    };
    account
}

fn account_in<'p, 'a>(
    accounts: &'p [AccountProjection<'a>],
    id: &str,
) -> &'p AccountProjection<'a> {
    accounts
        .iter()
        .find(|account| account.account_id().as_str() == id)
        .unwrap()
}

/// The total with its weighted rates left out.
fn unweighted(total: &WeightedSeries) -> Series {
    Series {
        start_balance: total.start_balance(),
        final_balance: total.final_balance(),
        total_contributions: total.total_contributions(),
        total_interest: total.total_interest(),
        monthly: total.monthly().to_vec(),
        yearly: total.yearly().iter().map(|row| row.row()).collect(),
    }
}

fn weighted(rows: &[WeightedYearlyRow]) -> Vec<(YearlyRow, Option<f64>)> {
    rows.iter()
        .map(|row| (row.row(), row.weighted_rate()))
        .collect()
}

fn stale_list(projection: &ScenarioProjection<'_>) -> Vec<(String, String)> {
    projection
        .stale_accounts()
        .iter()
        .map(|stale| {
            (
                stale.account_id().to_string(),
                stale.balance_as_of().to_string(),
            )
        })
        .collect()
}

fn months(rows: &[MonthlyRow]) -> Vec<(i16, i8)> {
    rows.iter().map(|row| (row.year(), row.month())).collect()
}

fn years(rows: &[YearlyRow]) -> Vec<i16> {
    rows.iter().map(|row| row.year()).collect()
}

/// The total's start balance, first monthly balance and final balance.
fn total_of_balances(order: &[f64]) -> (f64, f64, f64) {
    let accounts = order
        .iter()
        .enumerate()
        .map(|(index, balance)| json!({ "id": format!("a{index}"), "balance": balance }))
        .collect();
    let scenario = Setup::new("2026-11-01", "2026-12-01", accounts).scenario();
    let projection = project(&scenario);
    let total = projection.bands().baseline().total();
    (
        total.start_balance(),
        total.monthly()[0].balance(),
        total.final_balance(),
    )
}

fn two_accounts(variance: f64, override_rate: f64) -> Setup {
    Setup {
        compounding: "daily",
        annual_rate: 0.05,
        variance,
        salary: Some(
            json!({ "annualBase": 80_000, "annualRaiseRate": 0.02, "asOf": "2026-01-01" }),
        ),
        ..Setup::new(
            "2026-11-16",
            "2036-01-01",
            vec![
                json!({
                    "id": "override",
                    "balance": 40_000,
                    "balanceAsOf": "2026-03-10",
                    "annualRate": override_rate,
                    "contributions": [flat("o", 300.0, json!({ "frequency": "monthly", "day": 28 }))]
                }),
                json!({
                    "id": "default",
                    "balance": 25_000,
                    "balanceAsOf": "2026-11-16",
                    "contributions": [{
                        "id": "d",
                        "type": "salaryPercent",
                        "amount": 5,
                        "salaryBasis": "monthly",
                        "timing": { "frequency": "monthly", "day": 1 }
                    }]
                }),
            ],
        )
    }
}

/// The setup with only `account_id`, at `annual_rate` and no variance.
fn alone(setup: &Setup, account_id: &str, annual_rate: f64) -> Setup {
    Setup {
        today: setup.today,
        end_date: setup.end_date,
        compounding: setup.compounding,
        annual_rate: setup.annual_rate,
        variance: 0.0,
        salary: setup.salary.clone(),
        accounts: setup
            .accounts
            .iter()
            .filter(|account| account["id"] == account_id)
            .map(|account| {
                let mut account = account.clone();
                account["annualRate"] = json!(annual_rate);
                account
            })
            .collect(),
    }
}

mod a_stale_account {
    use super::*;

    fn monthly_setup() -> Setup {
        Setup {
            annual_rate: DOUBLING_MONTHLY_RATE,
            ..Setup::new(
                "2026-11-16",
                "2027-01-01",
                vec![json!({
                    "id": "stale",
                    "balance": 1000,
                    "balanceAsOf": "2026-09-01",
                    "contributions": [monthly("start", 100.0), monthly_end("end", 10.0)]
                })],
            )
        }
    }

    #[test]
    fn rolls_forward_to_today_in_monthly_mode_and_projects_from_today_september_1000_plus_100_x_2_plus_10_is_2210_october_4630_1_to_15_november_7095_then_10652_5_then_21515()
     {
        let scenario = monthly_setup().scenario();
        let projection = project(&scenario);
        let account = only_account(projection.bands().baseline().accounts());

        assert_eq!(
            (
                account.rolled_forward().contributions(),
                account.rolled_forward().interest()
            ),
            (320.0, 5775.0)
        );
        assert_eq!(
            account.series(),
            &Series {
                start_balance: 7095.0,
                final_balance: 21_515.0,
                total_contributions: 120.0,
                total_interest: 14_300.0,
                monthly: vec![
                    month_row(2026, 11, 10_652.5, 10.0, 3547.5),
                    month_row(2026, 12, 21_515.0, 120.0, 14_300.0),
                ],
                yearly: vec![year_row(2026, 21_515.0, 120.0, 14_300.0)],
            }
        );
        assert_eq!(
            stale_list(&projection),
            [("stale".to_owned(), "2026-09-01".to_owned())]
        );
    }

    #[test]
    fn rolls_forward_across_a_month_end_in_daily_mode_1000_to_2000_then_2010_to_4020_then_4120_to_8240()
     {
        let scenario = Setup {
            compounding: "daily",
            annual_rate: doubling_daily_rate(365),
            ..Setup::new(
                "2026-11-02",
                "2026-11-04",
                vec![json!({
                    "id": "stale",
                    "balance": 1000,
                    "balanceAsOf": "2026-10-30",
                    "contributions": [monthly("start", 100.0), monthly_end("end", 10.0)]
                })],
            )
        }
        .scenario();
        let projection = project(&scenario);
        let account = only_account(projection.bands().baseline().accounts());

        assert_eq!(
            (
                account.rolled_forward().contributions(),
                account.rolled_forward().interest()
            ),
            (110.0, 7130.0)
        );
        let series = account.series();
        assert_eq!(series.start_balance(), 8240.0);
        assert_eq!(series.final_balance(), 32_960.0);
        assert_eq!(series.total_contributions(), 0.0);
        assert_eq!(series.total_interest(), 24_720.0);
    }

    #[test]
    fn starts_at_balance_plus_contributions_plus_interest_added_in_that_order() {
        let scenario = monthly_setup().scenario();
        let projection = project(&scenario);
        let account = only_account(projection.bands().baseline().accounts());
        let rolled = account.rolled_forward();

        assert_eq!(
            account.series().start_balance(),
            1000.0 + rolled.contributions() + rolled.interest()
        );
    }

    #[test]
    fn starts_at_the_compounded_balance_which_can_differ_from_that_sum_after_rounding_2_pow_53_plus_1_rounds_to_2_pow_53()
     {
        let scenario = Setup::new(
            "2026-11-01",
            "2026-12-01",
            vec![json!({
                "id": "big",
                "balance": 2.0_f64.powi(53),
                "balanceAsOf": "2026-09-01",
                "contributions": [monthly("one", 1.0)]
            })],
        )
        .scenario();
        let projection = project(&scenario);
        let account = only_account(projection.bands().baseline().accounts());

        assert_eq!(
            (
                account.rolled_forward().contributions(),
                account.rolled_forward().interest()
            ),
            (2.0, 0.0)
        );
        assert_eq!(account.series().start_balance(), 2.0_f64.powi(53));
        assert_eq!(2.0_f64.powi(53) + 2.0 + 0.0, 9_007_199_254_740_994.0);
    }
}

mod accounts_and_the_total {
    use super::*;

    #[test]
    fn projects_an_excluded_account_but_leaves_it_out_of_the_total_and_the_stale_list_kept_1000_to_2000_excluded_50_to_100_then_200()
     {
        let scenario = Setup {
            annual_rate: DOUBLING_MONTHLY_RATE,
            ..Setup::new(
                "2026-11-01",
                "2026-12-01",
                vec![
                    json!({ "id": "kept", "balance": 1000 }),
                    json!({
                        "id": "excluded",
                        "balance": 50,
                        "balanceAsOf": "2026-10-01",
                        "included": false
                    }),
                ],
            )
        }
        .scenario();
        let projection = project(&scenario);
        let band = projection.bands().baseline();
        let [kept, excluded] = band.accounts() else {
            panic!("expected two accounts");
        };

        assert_eq!(
            [
                (kept.account_id().as_str(), kept.included()),
                (excluded.account_id().as_str(), excluded.included())
            ],
            [("kept", true), ("excluded", false)]
        );
        assert_eq!(excluded.series().final_balance(), 200.0);
        assert_eq!(&unweighted(band.total()), kept.series());
        assert_eq!(
            weighted(band.total().yearly()),
            [(year_row(2026, 2000.0, 0.0, 1000.0), Some(4095.0))]
        );
        assert_eq!(band.total().final_balance(), 2000.0);
        assert_eq!(stale_list(&projection), []);
    }

    #[test]
    fn sums_the_total_in_scenario_order_starting_from_0_1e16_plus_1_plus_1_is_1e16_and_1_plus_1_plus_1e16_is_1e16_plus_2()
     {
        let (start, first_month, _) = total_of_balances(&[1e16, 1.0, 1.0]);
        assert_eq!(start, 10_000_000_000_000_000.0);
        assert_eq!(first_month, 10_000_000_000_000_000.0);
        let (start, _, end) = total_of_balances(&[1.0, 1.0, 1e16]);
        assert_eq!(start, 10_000_000_000_000_002.0);
        assert_eq!(end, 10_000_000_000_000_002.0);
    }

    #[test]
    fn rolls_forward_accounts_with_different_as_of_dates_one_of_them_equal_to_today() {
        let scenario = Setup {
            annual_rate: DOUBLING_MONTHLY_RATE,
            ..Setup::new(
                "2026-11-16",
                "2026-12-01",
                vec![
                    json!({ "id": "sameMonth", "balance": 1000, "balanceAsOf": "2026-11-01" }),
                    json!({ "id": "fresh", "balance": 1000 }),
                    json!({ "id": "early", "balance": 1000, "balanceAsOf": "2026-10-01" }),
                ],
            )
        }
        .scenario();
        let projection = project(&scenario);
        let band = projection.bands().baseline();

        let figures: Vec<(&str, f64, f64, f64)> = band
            .accounts()
            .iter()
            .map(|account| {
                (
                    account.account_id().as_str(),
                    account.rolled_forward().interest(),
                    account.series().start_balance(),
                    account.series().final_balance(),
                )
            })
            .collect();
        assert_eq!(
            figures,
            [
                ("sameMonth", 500.0, 1500.0, 2250.0),
                ("fresh", 0.0, 1000.0, 1500.0),
                ("early", 2000.0, 3000.0, 4500.0),
            ]
        );
        let total = band.total();
        assert_eq!(
            [
                total.start_balance(),
                total.final_balance(),
                total.total_interest()
            ],
            [5500.0, 8250.0, 2750.0]
        );
        assert_eq!(
            stale_list(&projection),
            [
                ("sameMonth".to_owned(), "2026-11-01".to_owned()),
                ("early".to_owned(), "2026-10-01".to_owned()),
            ]
        );
    }

    #[test]
    fn lines_up_the_total_rows_with_every_account_from_a_mid_month_today_to_a_mid_month_end() {
        let scenario = Setup::new(
            "2026-11-16",
            "2028-03-10",
            vec![
                json!({
                    "id": "a",
                    "balance": 1000,
                    "balanceAsOf": "2026-10-01",
                    "contributions": [flat("a20", 100.0, json!({ "frequency": "monthly", "day": 20 }))]
                }),
                json!({
                    "id": "b",
                    "balance": 500,
                    "contributions": [flat("b5", 10.0, json!({ "frequency": "monthly", "day": 5 }))]
                }),
                json!({
                    "id": "c",
                    "contributions": [flat(
                        "c",
                        7.0,
                        json!({ "frequency": "annual", "month": 3, "day": 1 })
                    )]
                }),
            ],
        )
        .scenario();
        let projection = project(&scenario);
        let band = projection.bands().baseline();
        let total = unweighted(band.total());

        assert_eq!(total.monthly().len(), 17);
        assert_eq!(total.monthly()[0], month_row(2026, 11, 1700.0, 100.0, 0.0));
        assert_eq!(
            total.monthly().last(),
            Some(&month_row(2028, 3, 3374.0, 1774.0, 0.0))
        );
        assert_eq!(
            weighted(band.total().yearly()),
            [
                (year_row(2026, 1810.0, 210.0, 0.0), Some(0.0)),
                (year_row(2027, 3137.0, 1537.0, 0.0), Some(0.0)),
                (year_row(2028, 3374.0, 1774.0, 0.0), Some(0.0)),
            ]
        );
        for account in band.accounts() {
            assert_eq!(months(account.series().monthly()), months(total.monthly()));
            assert_eq!(years(account.series().yearly()), years(total.yearly()));
        }
    }

    #[test]
    fn gives_a_zero_total_with_a_row_per_month_when_there_are_no_accounts_or_only_excluded_ones() {
        for accounts in [
            vec![],
            vec![json!({ "id": "excluded", "balance": 100, "included": false })],
        ] {
            let scenario = Setup::new("2026-11-16", "2027-02-01", accounts).scenario();
            let projection = project(&scenario);

            let total = projection.bands().baseline().total();
            assert_eq!(
                unweighted(total),
                Series {
                    start_balance: 0.0,
                    final_balance: 0.0,
                    total_contributions: 0.0,
                    total_interest: 0.0,
                    monthly: vec![
                        month_row(2026, 11, 0.0, 0.0, 0.0),
                        month_row(2026, 12, 0.0, 0.0, 0.0),
                        month_row(2027, 1, 0.0, 0.0, 0.0),
                    ],
                    yearly: vec![year_row(2026, 0.0, 0.0, 0.0), year_row(2027, 0.0, 0.0, 0.0)],
                }
            );
            let rates: Vec<Option<f64>> = total
                .yearly()
                .iter()
                .map(|row| row.weighted_rate())
                .collect();
            assert_eq!(rates, [None, None]);
            let salary_years: Vec<i16> = projection
                .salary_by_year()
                .iter()
                .map(|salary| salary.year())
                .collect();
            assert_eq!(salary_years, [2026, 2027]);
        }
    }

    #[test]
    fn splits_into_three_accounts_with_the_rules_divided_and_totals_the_same_within_1e_9() {
        let rules = [
            flat(
                "monthly",
                500.0,
                json!({ "frequency": "monthly", "day": 15 }),
            ),
            flat(
                "annual",
                2000.0,
                json!({ "frequency": "annual", "month": 6 }),
            ),
            json!({
                "id": "salary",
                "type": "salaryPercent",
                "amount": 6,
                "salaryBasis": "monthly",
                "timing": { "frequency": "monthly", "placement": "end" }
            }),
        ];
        let base = |compounding, accounts| Setup {
            compounding,
            annual_rate: 0.06,
            variance: 0.02,
            salary: Some(
                json!({ "annualBase": 90_000, "annualRaiseRate": 0.03, "asOf": "2026-01-01" }),
            ),
            ..Setup::new("2026-11-16", "2036-11-16", accounts)
        };

        for compounding in ["monthly", "daily"] {
            let single = base(
                compounding,
                vec![json!({
                    "id": "one",
                    "balance": 100_000,
                    "balanceAsOf": "2026-06-01",
                    "contributions": rules
                })],
            )
            .scenario();
            let split = base(
                compounding,
                [50_000, 30_000, 20_000]
                    .iter()
                    .zip(&rules)
                    .enumerate()
                    .map(|(index, (balance, rule))| {
                        json!({
                            "id": format!("part{index}"),
                            "balance": balance,
                            "balanceAsOf": "2026-06-01",
                            "contributions": [rule]
                        })
                    })
                    .collect(),
            )
            .scenario();
            let single = project(&single);
            let split = project(&split);
            let (single, split) = (single.bands(), split.bands());
            for (expected, actual, months) in [
                (
                    single.baseline().total().final_balance(),
                    split.baseline().total().final_balance(),
                    split.baseline().total().monthly().len(),
                ),
                (
                    single.positive().total().final_balance(),
                    split.positive().total().final_balance(),
                    split.positive().total().monthly().len(),
                ),
                (
                    single.negative().total().final_balance(),
                    split.negative().total().final_balance(),
                    split.negative().total().monthly().len(),
                ),
            ] {
                assert!(
                    ((actual - expected).abs() / expected) < 1e-9,
                    "{compounding}"
                );
                assert_eq!(months, 121);
            }
        }
    }
}

mod bands {
    use super::*;

    fn account_alone(setup: &Setup, account_id: &str, annual_rate: f64) -> Scenario {
        alone(setup, account_id, annual_rate).scenario()
    }

    #[test]
    fn projects_each_account_of_a_two_rate_scenario_exactly_as_it_projects_alone() {
        let setup = two_accounts(0.0, 0.08);
        let scenario = setup.scenario();
        let projection = project(&scenario);
        let override_alone = account_alone(&setup, "override", 0.08);
        let default_alone = account_alone(&setup, "default", 0.05);

        assert_eq!(
            &projection.bands().baseline().accounts()[0],
            account_in(
                project(&override_alone).bands().baseline().accounts(),
                "override"
            )
        );
        assert_eq!(
            &projection.bands().baseline().accounts()[1],
            account_in(
                project(&default_alone).bands().baseline().accounts(),
                "default"
            )
        );
    }

    #[test]
    fn moves_every_account_rate_by_the_variance_the_roll_forward_included() {
        let setup = two_accounts(0.01, 0.08);
        let scenario = setup.scenario();
        let projection = project(&scenario);
        let bands = projection.bands();
        let rates = |accounts: &[AccountProjection<'_>]| -> Vec<f64> {
            accounts
                .iter()
                .map(AccountProjection::annual_rate)
                .collect()
        };

        assert_eq!(rates(bands.baseline().accounts()), [0.08, 0.05]);
        assert_eq!(
            rates(bands.positive().accounts()),
            [0.08 + 0.01, 0.05 + 0.01]
        );
        assert_eq!(
            rates(bands.negative().accounts()),
            [0.08 - 0.01, 0.05 - 0.01]
        );
        for (band, offset) in [
            (bands.positive().accounts(), 0.01),
            (bands.negative().accounts(), -0.01),
        ] {
            let override_alone = account_alone(&setup, "override", 0.08 + offset);
            let default_alone = account_alone(&setup, "default", 0.05 + offset);
            assert_eq!(
                account_in(band, "override"),
                account_in(
                    project(&override_alone).bands().baseline().accounts(),
                    "override"
                )
            );
            assert_eq!(
                account_in(band, "default"),
                account_in(
                    project(&default_alone).bands().baseline().accounts(),
                    "default"
                )
            );
        }
        assert!(
            account_in(bands.positive().accounts(), "override")
                .rolled_forward()
                .interest()
                > account_in(bands.baseline().accounts(), "override")
                    .rolled_forward()
                    .interest()
        );
    }

    #[test]
    fn holds_the_same_numbers_in_all_three_bands_when_there_is_no_variance() {
        let scenario = two_accounts(0.0, 0.08).scenario();
        let projection = project(&scenario);
        let bands = projection.bands();

        let baseline_total = unweighted(bands.baseline().total());
        for band in [bands.positive(), bands.negative()] {
            assert_eq!(band.total(), &baseline_total);
            assert_eq!(band.accounts(), bands.baseline().accounts());
        }
    }
}

mod salary_and_dates {
    use super::*;

    fn salary_by_year(end_date: &'static str) -> Vec<(i16, f64)> {
        let scenario = Setup {
            salary: Some(
                json!({ "annualBase": 100_000, "annualRaiseRate": 0.5, "asOf": "2025-06-01" }),
            ),
            ..Setup::new("2026-11-16", end_date, vec![])
        }
        .scenario();
        project(&scenario)
            .salary_by_year()
            .iter()
            .map(|salary| (salary.year(), salary.salary()))
            .collect()
    }

    #[test]
    fn gives_the_salary_for_each_calendar_year_from_today_to_the_last_counted_day() {
        assert_eq!(
            salary_by_year("2028-03-10"),
            [(2026, 150_000.0), (2027, 225_000.0), (2028, 337_500.0)]
        );
        let years: Vec<i16> = salary_by_year("2029-01-01")
            .iter()
            .map(|&(year, _)| year)
            .collect();
        assert_eq!(years, [2026, 2027, 2028]);
    }

    #[test]
    fn reports_today_and_the_end_date_as_written() {
        let scenario = Setup::new("2026-11-16", "2028-03-10", vec![]).scenario();
        let projection = project(&scenario);

        assert_eq!(
            (projection.today(), projection.end_date()),
            (date("2026-11-16"), date("2028-03-10"))
        );
    }
}

mod traces {
    use super::*;

    const BANDS: [Band; 3] = [Band::Baseline, Band::Positive, Band::Negative];

    fn trace(scenario: &Scenario, account_id: &str, band: Band) -> Vec<Segment> {
        segments(&trace_account(scenario, account_id, band).unwrap())
    }

    fn segment(from: &str, to: &str, days: i8, days_in_month: i8) -> Segment {
        Segment {
            from: from.to_owned(),
            to: to.to_owned(),
            days,
            days_in_month,
            days_in_year: 365,
            balance_start: 0.0,
            balance_end: 0.0,
            contributions: 0.0,
            interest: 0.0,
            annual_rate: 0.0,
            deposits: vec![],
        }
    }

    fn stale_setup() -> Setup {
        Setup {
            annual_rate: DOUBLING_MONTHLY_RATE,
            variance: DOUBLING_MONTHLY_RATE,
            ..Setup::new(
                "2026-11-16",
                "2026-12-01",
                vec![json!({
                    "id": "stale",
                    "balance": 1000,
                    "balanceAsOf": "2026-10-01",
                    "contributions": [monthly("start", 100.0)]
                })],
            )
        }
    }

    #[test]
    fn traces_the_roll_forward_from_balance_as_of_and_then_the_projection_from_today_2200_then_3450_at_today_then_5175()
     {
        let scenario = stale_setup().scenario();

        assert_eq!(
            trace(&scenario, "stale", Band::Baseline),
            [
                Segment {
                    balance_start: 1000.0,
                    balance_end: 2200.0,
                    contributions: 100.0,
                    interest: 1100.0,
                    annual_rate: DOUBLING_MONTHLY_RATE,
                    deposits: vec![traced_deposit("start", "2026-10-01", 100.0, Bucket::Start)],
                    ..segment("2026-10-01", "2026-11-01", 31, 31)
                },
                Segment {
                    balance_start: 2200.0,
                    balance_end: 3450.0,
                    contributions: 100.0,
                    interest: 1150.0,
                    annual_rate: DOUBLING_MONTHLY_RATE,
                    deposits: vec![traced_deposit("start", "2026-11-01", 100.0, Bucket::Start)],
                    ..segment("2026-11-01", "2026-11-16", 15, 30)
                },
                Segment {
                    balance_start: 3450.0,
                    balance_end: 5175.0,
                    contributions: 0.0,
                    interest: 1725.0,
                    annual_rate: DOUBLING_MONTHLY_RATE,
                    deposits: vec![],
                    ..segment("2026-11-16", "2026-12-01", 15, 30)
                },
            ]
        );
    }

    #[test]
    fn traces_the_negative_band_at_a_rate_of_0_1000_then_1100_then_1200() {
        let scenario = stale_setup().scenario();
        let figures: Vec<(f64, f64, f64)> = trace(&scenario, "stale", Band::Negative)
            .iter()
            .map(|segment| {
                (
                    segment.balance_start,
                    segment.balance_end,
                    segment.annual_rate,
                )
            })
            .collect();

        assert_eq!(
            figures,
            [
                (1000.0, 1100.0, 0.0),
                (1100.0, 1200.0, 0.0),
                (1200.0, 1200.0, 0.0)
            ]
        );
    }

    #[test]
    fn traces_the_positive_band_at_twice_the_rate_ending_on_its_series() {
        let scenario = stale_setup().scenario();
        let positive = trace(&scenario, "stale", Band::Positive);
        let projection = project(&scenario);
        let series = only_account(projection.bands().positive().accounts()).series();
        let [rolled_october, rolled_november, projected] = positive.as_slice() else {
            panic!("expected three segments");
        };

        assert_eq!(
            positive
                .iter()
                .map(|segment| (segment.from.as_str(), segment.to.as_str()))
                .collect::<Vec<_>>(),
            [
                ("2026-10-01", "2026-11-01"),
                ("2026-11-01", "2026-11-16"),
                ("2026-11-16", "2026-12-01")
            ]
        );
        assert!(
            positive
                .iter()
                .all(|segment| segment.annual_rate == 2.0 * DOUBLING_MONTHLY_RATE)
        );
        assert_eq!(rolled_october.balance_start, 1000.0);
        assert_eq!(rolled_november.balance_start, rolled_october.balance_end);
        assert_eq!(projected.balance_start, rolled_november.balance_end);
        assert_eq!(projected.balance_start, series.start_balance());
        assert_eq!(projected.balance_end, series.final_balance());
    }

    #[test]
    fn splits_a_mid_month_today_into_two_segments_that_meet_on_today() {
        let scenario = stale_setup().scenario();

        for band in BANDS {
            let trace = trace(&scenario, "stale", band);
            let november: Vec<(&str, &str, i8)> = trace
                .iter()
                .filter(|segment| segment.from.starts_with("2026-11"))
                .map(|segment| (segment.from.as_str(), segment.to.as_str(), segment.days))
                .collect();

            assert_eq!(
                november,
                [
                    ("2026-11-01", "2026-11-16", 15),
                    ("2026-11-16", "2026-12-01", 15)
                ],
                "{band:?}"
            );
        }
    }

    fn mixed_setup(compounding: &'static str, annual_rate: f64) -> Setup {
        Setup {
            compounding,
            annual_rate,
            variance: 0.02,
            salary: Some(
                json!({ "annualBase": 90_000, "annualRaiseRate": 0.03, "asOf": "2026-01-01" }),
            ),
            ..Setup::new(
                "2026-11-16",
                "2031-07-10",
                vec![
                    json!({
                        "id": "stale",
                        "balance": 25_000.5,
                        "balanceAsOf": "2025-02-28",
                        "contributions": [
                            monthly("start", 100.0),
                            monthly_end("end", 37.25),
                            flat("thirty-first", 12.5, json!({ "frequency": "monthly", "day": 31 })),
                            {
                                "id": "percent",
                                "type": "salaryPercent",
                                "amount": 6,
                                "salaryBasis": "perContribution",
                                "timing": { "frequency": "monthly", "day": 15 }
                            }
                        ]
                    }),
                    json!({
                        "id": "fresh",
                        "balance": 1234.56,
                        "annualRate": 0.09,
                        "included": false,
                        "contributions": [
                            flat("yearly", 500.0, json!({ "frequency": "annual", "month": 2, "day": 29 }))
                        ]
                    }),
                ],
            )
        }
    }

    #[test]
    fn ends_on_each_account_series_final_balance_bit_for_bit_in_both_modes_and_all_three_bands() {
        for compounding in ["monthly", "daily"] {
            let scenario = mixed_setup(compounding, 0.055).scenario();
            let projection = project(&scenario);

            for band in BANDS {
                let accounts = match band {
                    Band::Baseline => projection.bands().baseline().accounts(),
                    Band::Positive => projection.bands().positive().accounts(),
                    Band::Negative => projection.bands().negative().accounts(),
                };
                for account in accounts {
                    let id = account.account_id().as_str();
                    let trace = trace(&scenario, id, band);
                    let today = trace
                        .iter()
                        .position(|segment| segment.from == "2026-11-16")
                        .unwrap();

                    assert_eq!(
                        trace.last().map(|segment| segment.balance_end.to_bits()),
                        Some(account.series().final_balance().to_bits()),
                        "{compounding} {band:?} {id}"
                    );
                    assert_eq!(
                        trace[today].balance_start.to_bits(),
                        account.series().start_balance().to_bits(),
                        "{compounding} {band:?} {id}"
                    );
                    assert!(
                        trace
                            .iter()
                            .all(|segment| segment.annual_rate == account.annual_rate())
                    );
                }
            }
        }
    }

    #[test]
    fn counts_every_day_from_the_balance_date_to_the_end_date_once() {
        let scenario = mixed_setup("daily", 0.055).scenario();

        for (id, from) in [("stale", date("2025-02-28")), ("fresh", date("2026-11-16"))] {
            let trace = trace(&scenario, id, Band::Baseline);
            let days: i64 = trace.iter().map(|segment| i64::from(segment.days)).sum();
            let first_and_last = (
                trace.first().map(|segment| date(&segment.from)),
                trace.last().map(|segment| date(&segment.to)),
            );

            assert_eq!(
                first_and_last,
                (Some(from), Some(date("2031-07-10"))),
                "{id}"
            );
            assert_eq!(days, days_between(from, date("2031-07-10")), "{id}");
            for pair in trace.windows(2) {
                assert_eq!(pair[0].to, pair[1].from, "{id}");
            }
        }
    }

    fn days_between(from: CalendarDate, to: CalendarDate) -> i64 {
        std::iter::successors(Some(from), |&day| {
            CalendarDate::new(day.year(), day.month(), day.day() + 1)
                .or_else(|| day.with_day_clamped(1).checked_add_months(1))
        })
        .take_while(|&day| day < to)
        .count()
        .try_into()
        .unwrap()
    }

    #[test]
    fn fails_with_not_finite_and_the_account_id_as_a_projection_does() {
        let scenario = Setup {
            annual_rate: 1e300,
            ..Setup::new(
                "2026-11-01",
                "2027-02-01",
                vec![json!({ "id": "huge", "balance": 1e300 })],
            )
        }
        .scenario();
        let error = trace_account(&scenario, "huge", Band::Baseline).unwrap_err();

        assert_eq!(project_scenario(&scenario).unwrap_err(), error);
        assert_eq!(
            (error.code(), error.account_id()),
            ("not_finite", Some("huge"))
        );
    }
}

mod errors {
    use super::*;

    #[test]
    fn names_the_unknown_account_a_trace_asks_for() {
        let scenario =
            Setup::new("2026-11-01", "2027-01-01", vec![json!({ "id": "known" })]).scenario();
        let error = trace_account(&scenario, "missing", Band::Baseline).unwrap_err();

        assert_eq!(
            error,
            ProjectionError::UnknownAccount { account: "missing" }
        );
        assert_eq!(
            (error.code(), error.account_id()),
            ("unknown_account", Some("missing"))
        );
        assert_eq!(
            error.to_string(),
            "unknown_account missing: the scenario has no account with this id"
        );
    }

    #[test]
    fn fails_with_not_finite_and_no_account_id_when_finite_accounts_overflow_the_total() {
        let scenario = Setup::new(
            "2026-11-01",
            "2026-12-01",
            vec![
                json!({ "id": "a", "balance": 1e308 }),
                json!({ "id": "b", "balance": 1e308 }),
            ],
        )
        .scenario();
        let error = project_scenario(&scenario).unwrap_err();

        assert_eq!(error, ProjectionError::ScenarioNotFinite);
        assert_eq!((error.code(), error.account_id()), ("not_finite", None));
    }

    #[test]
    fn fails_with_not_finite_and_no_account_id_when_a_salary_overflows_1e308_doubled_in_2027() {
        let scenario = Setup {
            salary: Some(
                json!({ "annualBase": 1e308, "annualRaiseRate": 1, "asOf": "2026-01-01" }),
            ),
            ..Setup::new("2026-01-01", "2028-01-01", vec![])
        }
        .scenario();

        assert_eq!(
            project_scenario(&scenario),
            Err(ProjectionError::ScenarioNotFinite)
        );
    }

    #[test]
    fn fails_with_not_finite_and_no_account_id_when_a_rate_times_a_balance_overflows_the_weighted_rate()
     {
        let scenario = Setup::new(
            "2026-12-01",
            "2027-01-01",
            vec![
                json!({ "id": "big", "balance": 1e306, "annualRate": 1000 }),
                json!({ "id": "small", "balance": 1 }),
            ],
        )
        .scenario();
        let big = scenario.accounts()[0].balance() * 1001.0_f64.powf(1.0 / 12.0);

        assert!(big.is_finite());
        assert_eq!(1000.0 * big, f64::INFINITY);
        assert_eq!(
            project_scenario(&scenario),
            Err(ProjectionError::ScenarioNotFinite)
        );
    }
}
