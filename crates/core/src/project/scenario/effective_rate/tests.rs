use serde_json::{Value, json};

use super::{BISECTION_PASSES, Pool, bisect_rate};
use crate::fixture::{Setup, flat, monthly, monthly_end};
use crate::project::{AccountProjection, ScenarioProjection, YearlyRow, project_scenario};
use crate::scenario::{Account, Compounding, Scenario};

const DOUBLING_MONTHLY_RATE: f64 = 4095.0;
const MODES: [&str; 2] = ["monthly", "daily"];

fn project(scenario: &Scenario) -> ScenarioProjection<'_> {
    project_scenario(scenario).unwrap()
}

fn compounding(mode: &str) -> Compounding {
    match mode {
        "monthly" => Compounding::Monthly,
        _ => Compounding::Daily,
    }
}

fn included_pool(scenario: &Scenario) -> Pool {
    let accounts: Vec<&Account> = scenario
        .accounts()
        .iter()
        .filter(|account| account.included())
        .collect();
    let start_balance = project(scenario).bands().baseline().total().start_balance();
    Pool::of(scenario, &accounts, start_balance).unwrap()
}

fn relative_error(actual: f64, expected: f64) -> f64 {
    (actual - expected).abs() / expected
}

fn weighted_rates(projection: &ScenarioProjection<'_>) -> Vec<Option<f64>> {
    projection
        .bands()
        .baseline()
        .total()
        .yearly()
        .iter()
        .map(|row| row.weighted_rate())
        .collect()
}

fn readme() -> Setup {
    Setup {
        annual_rate: 0.06,
        ..Setup::new(
            "2026-01-01",
            "2056-01-01",
            vec![
                json!({ "id": "big", "balance": 180_000 }),
                json!({ "id": "small", "balance": 20_000, "annualRate": 0.1 }),
            ],
        )
    }
}

fn mixed_accounts() -> Vec<Value> {
    vec![
        json!({
            "id": "stale",
            "balance": 40_000,
            "balanceAsOf": "2025-03-10",
            "annualRate": 0.08,
            "contributions": [
                flat("day28", 300.0, json!({ "frequency": "monthly", "day": 28 })),
                flat("march", 2000.0, json!({ "frequency": "annual", "month": 3, "day": 1 })),
            ]
        }),
        json!({
            "id": "salary",
            "balance": 0,
            "annualRate": -0.02,
            "contributions": [{
                "id": "pct",
                "type": "salaryPercent",
                "amount": 6,
                "salaryBasis": "monthly",
                "timing": { "frequency": "monthly", "placement": "end" }
            }]
        }),
        json!({
            "id": "cash",
            "balance": 5000,
            "annualRate": 0.01,
            "contributions": [monthly("cash-in", 50.0)]
        }),
        json!({ "id": "excluded", "balance": 9e9, "annualRate": 0.9, "included": false }),
    ]
}

fn mixed_with(accounts: Vec<Value>) -> Setup {
    Setup {
        annual_rate: 0.05,
        salary: Some(
            json!({ "annualBase": 90_000, "annualRaiseRate": 0.03, "asOf": "2026-01-01" }),
        ),
        ..Setup::new("2026-11-16", "2041-07-20", accounts)
    }
}

fn mixed() -> Setup {
    mixed_with(mixed_accounts())
}

fn short() -> Setup {
    Setup {
        annual_rate: 0.2,
        ..Setup::new(
            "2026-02-27",
            "2027-02-03",
            vec![
                json!({
                    "id": "empty",
                    "annualRate": 0.5,
                    "contributions": [flat(
                        "once",
                        1000.0,
                        json!({ "frequency": "oneTime", "on": "2026-12-31" })
                    )]
                }),
                json!({
                    "id": "kept",
                    "balance": 1,
                    "annualRate": 0,
                    "contributions": [monthly_end("end", 7.0)]
                }),
            ],
        )
    }
}

mod short_cuts {
    use super::*;

    #[test]
    fn returns_the_shared_rate_exactly_when_every_included_account_has_it() {
        let scenario = Setup {
            annual_rate: 0.1,
            ..Setup::new(
                "2026-01-01",
                "2036-01-01",
                vec![
                    json!({ "id": "default", "balance": 1, "contributions": [monthly("a", 3.0)] }),
                    json!({ "id": "override", "balance": 2, "annualRate": 0.1 }),
                    json!({ "id": "excluded", "balance": 5, "annualRate": 0.3, "included": false }),
                ],
            )
        }
        .scenario();
        let projection = project(&scenario);

        assert_eq!(projection.effective_rate(), 0.1);
        assert_eq!(weighted_rates(&projection), [Some(0.1); 10]);
    }

    #[test]
    fn returns_the_default_rate_when_there_are_no_accounts_or_only_excluded_ones() {
        for accounts in [
            vec![],
            vec![json!({ "id": "out", "balance": 100, "annualRate": 0.2, "included": false })],
        ] {
            let scenario = Setup {
                annual_rate: 0.042,
                ..Setup::new("2026-01-01", "2030-01-01", accounts)
            }
            .scenario();

            assert_eq!(project(&scenario).effective_rate(), 0.042);
        }
    }

    #[test]
    fn returns_the_default_rate_when_the_pool_has_no_balance_and_no_deposits() {
        let mut disabled = monthly("off", 100.0);
        disabled["enabled"] = json!(false);
        let scenario = Setup {
            annual_rate: 0.05,
            ..Setup::new(
                "2026-01-01",
                "2030-01-01",
                vec![
                    json!({
                        "id": "low",
                        "annualRate": 0.03,
                        "contributions": [monthly("zero", 0.0)]
                    }),
                    json!({ "id": "high", "annualRate": 0.09, "contributions": [disabled] }),
                ],
            )
        }
        .scenario();
        let projection = project(&scenario);

        assert_eq!(projection.effective_rate(), 0.05);
        assert_eq!(weighted_rates(&projection), [None; 4]);
    }
}

mod the_solve {
    use super::*;

    #[test]
    fn matches_the_readme_example_6_66_percent_effective_7_0_percent_weighted_in_the_last_year() {
        let scenario = readme().scenario();
        let projection = project(&scenario);
        let last_year = weighted_rates(&projection).last().copied().flatten();

        assert_eq!(format!("{:.4}", projection.effective_rate()), "0.0666");
        assert_eq!(format!("{:.3}", last_year.unwrap()), "0.070");
    }

    #[test]
    fn regression_pin_not_a_derivation_the_readme_example_to_full_precision() {
        let scenario = readme().scenario();
        let projection = project(&scenario);

        assert_eq!(projection.effective_rate(), 0.066_574_390_059_404_58);
        assert_eq!(
            weighted_rates(&projection).last(),
            Some(&Some(0.070_094_992_541_830_38))
        );
    }

    #[test]
    fn lies_within_the_included_rates_and_reproduces_the_total_in_both_modes() {
        for mode in MODES {
            for setup in [readme(), mixed(), short()] {
                let scenario = Setup {
                    compounding: mode,
                    ..setup
                }
                .scenario();
                let projection = project(&scenario);
                let rates: Vec<f64> = projection
                    .bands()
                    .baseline()
                    .accounts()
                    .iter()
                    .filter(|account| account.included())
                    .map(AccountProjection::annual_rate)
                    .collect();
                let effective_rate = projection.effective_rate();
                let pooled =
                    included_pool(&scenario).final_balance(compounding(mode), effective_rate);

                let lowest = rates.iter().copied().fold(f64::INFINITY, f64::min);
                let highest = rates.iter().copied().fold(f64::NEG_INFINITY, f64::max);
                assert!(effective_rate >= lowest, "{mode}");
                assert!(effective_rate <= highest, "{mode}");
                assert!(
                    relative_error(
                        pooled,
                        projection.bands().baseline().total().final_balance()
                    ) < 1e-9,
                    "{mode}"
                );
            }
        }
    }

    #[test]
    fn pools_a_stale_account_from_its_balance_at_today_not_its_stored_balance_5000_to_9000_is_r_1_8_pow_12_minus_1()
     {
        let scenario = Setup::new(
            "2026-12-01",
            "2027-01-01",
            vec![
                json!({
                    "id": "stale",
                    "balance": 1000,
                    "balanceAsOf": "2026-10-01",
                    "annualRate": DOUBLING_MONTHLY_RATE
                }),
                json!({ "id": "fresh", "balance": 1000 }),
            ],
        )
        .scenario();
        let projection = project(&scenario);
        let total = projection.bands().baseline().total();

        assert_eq!(total.start_balance(), 5000.0);
        assert_eq!(total.final_balance(), 9000.0);
        assert!(relative_error(projection.effective_rate(), 1.8_f64.powi(12) - 1.0) < 1e-9);
    }

    #[test]
    fn ignores_excluded_accounts_their_balance_rate_and_deposits() {
        let without = mixed_with(
            mixed_accounts()
                .into_iter()
                .filter(|account| account["id"] != "excluded")
                .collect(),
        )
        .scenario();
        let with_excluded = mixed_with(
            mixed_accounts()
                .into_iter()
                .map(|mut account| {
                    if account["id"] == "excluded" {
                        account["contributions"] = json!([monthly("ex", 1e6)]);
                    }
                    account
                })
                .collect(),
        )
        .scenario();
        let without = project(&without);
        let with_excluded = project(&with_excluded);

        assert_eq!(with_excluded.effective_rate(), without.effective_rate());
        assert_eq!(
            with_excluded.bands().baseline().total().yearly(),
            without.bands().baseline().total().yearly()
        );
    }

    #[test]
    fn stays_finite_and_inside_the_rates_when_the_pool_overflows_at_the_first_midpoint_2047_5() {
        let scenario = Setup::new(
            "2026-12-01",
            "2027-01-01",
            vec![
                json!({ "id": "huge", "balance": 1e308 }),
                json!({ "id": "fast", "balance": 1, "annualRate": DOUBLING_MONTHLY_RATE }),
            ],
        )
        .scenario();
        let projection = project(&scenario);
        let pool = included_pool(&scenario);
        let effective_rate = projection.effective_rate();

        assert_eq!(
            pool.final_balance(Compounding::Monthly, 2047.5),
            f64::INFINITY
        );
        assert!(effective_rate.is_finite());
        assert!(effective_rate >= 0.0);
        assert!(effective_rate <= DOUBLING_MONTHLY_RATE);
        assert!(
            relative_error(
                pool.final_balance(Compounding::Monthly, effective_rate),
                1e308
            ) < 1e-9
        );
    }
}

mod bisect {
    use super::*;

    #[test]
    fn compounds_exactly_60_times_at_midpoints_written_lo_plus_hi_minus_lo_over_2() {
        let mut calls = Vec::new();
        let rate = bisect_rate(0.0, 1.0, 0.3, |midpoint| {
            calls.push(midpoint);
            midpoint
        });

        assert_eq!(BISECTION_PASSES, 60);
        assert_eq!(calls.len(), 60);
        assert_eq!(calls[..3], [0.5, 0.25, 0.375]);
        assert!((rate - 0.3).abs() < 1e-15);
    }

    #[test]
    fn moves_hi_down_when_the_result_equals_the_target_and_lo_up_only_when_it_is_below() {
        let mut calls = Vec::new();
        bisect_rate(0.0, 1.0, 0.5, |midpoint| {
            calls.push(midpoint);
            midpoint
        });

        assert_eq!(calls[..3], [0.5, 0.25, 0.375]);
    }

    #[test]
    fn treats_an_infinite_or_nan_result_as_above_the_target_and_stays_inside_the_bracket() {
        for overflow in [f64::INFINITY, f64::NAN] {
            let mut calls = Vec::new();
            let rate = bisect_rate(0.0, 1.0, 0.2, |midpoint| {
                calls.push(midpoint);
                if midpoint > 0.3 { overflow } else { midpoint }
            });

            assert_eq!(calls[..3], [0.5, 0.25, 0.125], "{overflow}");
            assert!((rate - 0.2).abs() < 1e-15, "{overflow}");
        }
    }
}

mod the_pool {
    use super::*;

    #[test]
    fn merges_by_month_then_account_order_then_rule_order_1_plus_1_plus_1e16_is_1e16_plus_2() {
        let scenario = Setup::new(
            "2026-12-01",
            "2027-01-01",
            vec![
                json!({
                    "id": "ones",
                    "contributions": [monthly("one", 1.0), monthly("another", 1.0)]
                }),
                json!({
                    "id": "big",
                    "annualRate": 0.5,
                    "contributions": [monthly("big", 1e16)]
                }),
            ],
        )
        .scenario();

        assert_eq!(
            included_pool(&scenario).final_balance(Compounding::Monthly, 0.0),
            10_000_000_000_000_002.0
        );
    }

    #[test]
    fn gives_the_same_final_balance_as_the_series_for_one_account_in_both_modes() {
        for mode in MODES {
            let scenario = Setup {
                compounding: mode,
                ..mixed()
            }
            .scenario();
            let projection = project(&scenario);

            for (account, projected) in scenario
                .accounts()
                .iter()
                .zip(projection.bands().baseline().accounts())
            {
                let pool =
                    Pool::of(&scenario, &[account], projected.series().start_balance()).unwrap();
                assert_eq!(
                    pool.final_balance(compounding(mode), projected.annual_rate()),
                    projected.series().final_balance(),
                    "{mode} {}",
                    account.id()
                );
            }
        }
    }

    #[test]
    fn does_not_shrink_as_the_rate_rises_in_both_modes() {
        for mode in MODES {
            let scenario = Setup {
                compounding: mode,
                ..mixed()
            }
            .scenario();
            let pool = included_pool(&scenario);
            let balances: Vec<f64> = (0..61)
                .map(|step| pool.final_balance(compounding(mode), -0.5 + f64::from(step) * 0.025))
                .collect();

            for pair in balances.windows(2) {
                assert!(pair[1] >= pair[0], "{mode}");
            }
        }
    }
}

mod weighted_rate {
    use super::*;

    #[test]
    fn weights_each_included_rate_by_its_balance_on_the_row_0_x_1000_plus_4095_x_2000_over_3000_is_2730()
     {
        let scenario = Setup::new(
            "2026-12-01",
            "2027-01-01",
            vec![
                json!({ "id": "zero", "balance": 1000 }),
                json!({ "id": "doubling", "balance": 1000, "annualRate": DOUBLING_MONTHLY_RATE }),
                json!({ "id": "excluded", "balance": 1000, "annualRate": 7, "included": false }),
            ],
        )
        .scenario();
        let projection = project(&scenario);
        let rows: Vec<(YearlyRow, Option<f64>)> = projection
            .bands()
            .baseline()
            .total()
            .yearly()
            .iter()
            .map(|row| (row.row(), row.weighted_rate()))
            .collect();

        assert_eq!(
            rows,
            [(
                YearlyRow {
                    year: 2026,
                    balance: 3000.0,
                    contributions: 0.0,
                    interest: 1000.0
                },
                Some(2730.0)
            )]
        );
    }

    #[test]
    fn is_present_on_every_baseline_total_yearly_row_with_a_balance() {
        let scenario = Setup {
            variance: 0.01,
            ..mixed()
        }
        .scenario();
        let projection = project(&scenario);

        assert!(weighted_rates(&projection).iter().all(Option::is_some));
    }
}
