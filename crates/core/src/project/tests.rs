use serde_json::{Value, json};

use super::{MonthlyRow, ProjectionError, Series, YearlyRow, project_account};
use crate::date::CalendarDate;
use crate::fixture::{date, doubling_daily_rate, flat, one_time, only_account, scenario};
use crate::schedule::{Bucket, ScheduledMonth, build_account_schedule};

const DOUBLING_MONTHLY_RATE: f64 = 4095.0;

fn early_and_late() -> Value {
    json!([
        flat("early", 100.0, json!({ "frequency": "monthly", "day": 3 })),
        flat("late", 10.0, json!({ "frequency": "monthly", "day": 20 })),
    ])
}

fn monthly_placement(id: &str, amount: f64, placement: &str) -> Value {
    flat(
        id,
        amount,
        json!({ "frequency": "monthly", "placement": placement }),
    )
}

struct Run {
    compounding: &'static str,
    rules: Value,
    from: &'static str,
    to: &'static str,
    opening: f64,
    rate: f64,
}

fn run(compounding: &'static str, from: &'static str, to: &'static str, opening: f64) -> Run {
    let rate = match compounding {
        "monthly" => DOUBLING_MONTHLY_RATE,
        _ => doubling_daily_rate(365),
    };
    Run {
        compounding,
        rules: json!([]),
        from,
        to,
        opening,
        rate,
    }
}

impl Run {
    fn rules(self, rules: Value) -> Self {
        Self { rules, ..self }
    }

    fn rate(self, rate: f64) -> Self {
        Self { rate, ..self }
    }

    fn project(&self) -> Series {
        let scenario = scenario(self.compounding, self.rules.clone());
        project_account(
            &scenario,
            only_account(&scenario),
            date(self.from),
            date(self.to),
            self.opening,
            self.rate,
        )
        .unwrap()
    }

    fn final_balance(&self) -> f64 {
        self.project().final_balance()
    }

    fn balances(&self) -> Vec<f64> {
        self.project()
            .monthly()
            .iter()
            .map(|row| row.balance())
            .collect()
    }

    /// Each segment's `(from, to, days, days_in_month, days_in_year)`.
    fn segments(&self) -> Vec<(CalendarDate, CalendarDate, i8, i8, i16)> {
        let scenario = scenario(self.compounding, self.rules.clone());
        build_account_schedule(
            &scenario,
            only_account(&scenario),
            date(self.from),
            date(self.to),
        )
        .unwrap()
        .iter()
        .map(|month| {
            (
                month.from(),
                month.to(),
                month.days(),
                month.days_in_month(),
                month.days_in_year(),
            )
        })
        .collect()
    }

    /// Each kept deposit's `(rule_id, date, amount, bucket)`.
    fn deposits(&self) -> Vec<(String, CalendarDate, f64, Bucket)> {
        let scenario = scenario(self.compounding, self.rules.clone());
        build_account_schedule(
            &scenario,
            only_account(&scenario),
            date(self.from),
            date(self.to),
        )
        .unwrap()
        .iter()
        .flat_map(ScheduledMonth::deposits)
        .map(|deposit| {
            (
                deposit.rule_id().to_string(),
                deposit.date(),
                deposit.amount(),
                deposit.bucket(),
            )
        })
        .collect()
    }
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

fn days_from(from: &str, to: &str) -> Vec<CalendarDate> {
    let to = date(to);
    std::iter::successors(Some(date(from)), |&day| {
        if day.day() < day.days_in_month() {
            CalendarDate::new(day.year(), day.month(), day.day() + 1)
        } else {
            day.with_day_clamped(1).checked_add_months(1)
        }
    })
    .take_while(|&day| day < to)
    .collect()
}

mod compound_ported_from_compound_test {
    use super::*;

    #[test]
    fn adds_start_deposits_before_a_month_of_interest_and_end_deposits_after_it() {
        let rules = json!([
            flat(
                "start-60",
                60.0,
                json!({ "frequency": "annual", "month": 1 })
            ),
            flat(
                "end-50",
                50.0,
                json!({ "frequency": "annual", "month": 1, "placement": "end" })
            ),
            flat(
                "start-40",
                40.0,
                json!({ "frequency": "annual", "month": 1 })
            ),
        ]);

        assert_eq!(
            run("monthly", "2026-01-01", "2026-03-01", 1000.0)
                .rules(rules)
                .project(),
            Series {
                start_balance: 1000.0,
                final_balance: 4500.0,
                total_contributions: 150.0,
                total_interest: 3350.0,
                monthly: vec![
                    month_row(2026, 1, 2250.0, 150.0, 1100.0),
                    month_row(2026, 2, 4500.0, 150.0, 3350.0),
                ],
                yearly: vec![year_row(2026, 4500.0, 150.0, 3350.0)],
            }
        );
    }

    #[test]
    fn adds_start_deposits_on_day_1_end_deposits_on_the_last_day_and_day_deposits_on_their_day_11_x_2_then_27_x_2_then_58_x_2_then_116_x_2_pow_26_then_plus_2_x_2()
     {
        let rules = json!([
            monthly_placement("start", 1.0, "start"),
            flat("day-3", 4.0, json!({ "frequency": "monthly", "day": 3 })),
            flat("day-2", 5.0, json!({ "frequency": "monthly", "day": 2 })),
            monthly_placement("end", 2.0, "end"),
        ]);
        let final_balance = (116.0 * 2.0_f64.powi(26) + 2.0) * 2.0;

        assert_eq!(final_balance, 15_569_256_452.0);
        assert_eq!(
            run("daily", "2026-11-01", "2026-12-01", 10.0)
                .rules(rules)
                .project()
                .monthly(),
            [month_row(
                2026,
                11,
                15_569_256_452.0,
                12.0,
                15_569_256_452.0 - 10.0 - 12.0
            )]
        );
    }

    #[test]
    fn adds_the_total_of_a_bucket_to_the_balance_once_in_both_modes() {
        let rules = json!([
            monthly_placement("first", 1.0, "start"),
            monthly_placement("second", 1.0, "start"),
        ]);

        for compounding in ["monthly", "daily"] {
            assert_eq!(
                run(compounding, "2026-11-01", "2026-12-01", 1e16)
                    .rules(rules.clone())
                    .rate(0.0)
                    .final_balance(),
                10_000_000_000_000_002.0,
                "{compounding}"
            );
        }
    }

    #[test]
    fn totals_a_bucket_in_rule_order_not_in_date_order() {
        let rules = json!([
            flat("big", 1e16, json!({ "frequency": "monthly", "day": 15 })),
            flat("third", 1.0, json!({ "frequency": "monthly", "day": 3 })),
            flat("second", 1.0, json!({ "frequency": "monthly", "day": 2 })),
        ]);

        assert_eq!(
            run("monthly", "2026-01-01", "2026-02-01", 0.0)
                .rules(rules)
                .rate(0.0)
                .final_balance(),
            10_000_000_000_000_000.0
        );
    }
}

mod project_account_ported_from_project_account_test {
    use super::*;

    #[test]
    fn compounds_each_month_from_the_opening_balance_it_is_given_and_keeps_one_yearly_row_per_calendar_year()
     {
        assert_eq!(
            run("monthly", "2026-11-01", "2027-02-01", 2000.0)
                .rules(early_and_late())
                .project(),
            Series {
                start_balance: 2000.0,
                final_balance: 17_470.0,
                total_contributions: 330.0,
                total_interest: 15_140.0,
                monthly: vec![
                    month_row(2026, 11, 4210.0, 110.0, 2100.0),
                    month_row(2026, 12, 8630.0, 220.0, 6410.0),
                    month_row(2027, 1, 17_470.0, 330.0, 15_140.0),
                ],
                yearly: vec![
                    year_row(2026, 8630.0, 220.0, 6410.0),
                    year_row(2027, 17_470.0, 330.0, 15_140.0),
                ],
            }
        );
    }

    #[test]
    fn returns_the_opening_balance_and_no_rows_when_from_is_on_or_after_to() {
        for (from, to) in [
            ("2026-12-01", "2026-12-01"),
            ("2027-02-01", "2026-12-01"),
            ("2026-12-15", "2026-12-15"),
            ("2026-12-20", "2026-12-15"),
        ] {
            assert_eq!(
                run("daily", from, to, 500.0)
                    .rules(early_and_late())
                    .rate(0.05)
                    .project(),
                Series {
                    start_balance: 500.0,
                    final_balance: 500.0,
                    total_contributions: 0.0,
                    total_interest: 0.0,
                    monthly: vec![],
                    yearly: vec![],
                },
                "{from} to {to}"
            );
        }
    }

    #[test]
    fn fails_with_not_finite_and_the_account_id_for_a_deposit_that_overflows_into_infinity_times_a_zero_rate()
     {
        let monthly_rule = json!([flat("huge", 1e308, json!({ "frequency": "monthly" }))]);
        assert_eq!(1e308 + 1e308, f64::INFINITY);
        assert!((f64::INFINITY * 0.0).is_nan());

        for (rules, opening, rate) in [(monthly_rule, 1e308, 0.0), (json!([]), 1e300, 1e300)] {
            let scenario = scenario("monthly", rules);
            let account = only_account(&scenario);
            let error = project_account(
                &scenario,
                account,
                date("2026-11-01"),
                date("2027-02-01"),
                opening,
                rate,
            )
            .unwrap_err();

            assert_eq!(
                error,
                ProjectionError::NotFinite {
                    account: account.id()
                }
            );
            assert_eq!(
                (error.code(), error.account_id()),
                ("not_finite", Some("account"))
            );
        }
    }

    #[test]
    fn compounds_a_daily_month_with_its_deposits_on_their_days_1000_x_2_pow_30_plus_100_x_2_pow_28_plus_10_x_2_pow_11()
     {
        let final_balance =
            1000.0 * 2.0_f64.powi(30) + 100.0 * 2.0_f64.powi(28) + 10.0 * 2.0_f64.powi(11);

        assert_eq!(final_balance, 1_100_585_390_080.0);
        assert_eq!(
            run("daily", "2026-11-01", "2026-12-01", 1000.0)
                .rules(early_and_late())
                .project()
                .monthly(),
            [month_row(
                2026,
                11,
                1_100_585_390_080.0,
                110.0,
                1_100_585_388_970.0
            )]
        );
    }
}

mod project_account_over_part_of_a_month {
    use super::*;

    #[test]
    fn starts_on_the_27th_of_a_30_day_month_in_monthly_mode_3000_plus_3000_x_4_30_is_3400_then_december_3400_plus_100_x_2_plus_10_is_7010()
     {
        assert_eq!(
            run("monthly", "2026-11-27", "2027-01-01", 3000.0)
                .rules(early_and_late())
                .project()
                .monthly(),
            [
                month_row(2026, 11, 3400.0, 0.0, 400.0),
                month_row(2026, 12, 7010.0, 110.0, 3900.0),
            ]
        );
    }

    #[test]
    fn starts_on_the_27th_of_a_30_day_month_in_daily_mode_3000_x_2_pow_4_is_48000_then_48000_x_2_pow_31_plus_100_x_2_pow_29_plus_10_x_2_pow_12()
     {
        let december =
            48_000.0 * 2.0_f64.powi(31) + 100.0 * 2.0_f64.powi(29) + 10.0 * 2.0_f64.powi(12);

        assert_eq!(december, 103_132_902_236_160.0);
        assert_eq!(
            run("daily", "2026-11-27", "2027-01-01", 3000.0)
                .rules(early_and_late())
                .project()
                .monthly(),
            [
                month_row(2026, 11, 48_000.0, 0.0, 45_000.0),
                month_row(
                    2026,
                    12,
                    103_132_902_236_160.0,
                    110.0,
                    103_132_902_236_160.0 - 3110.0
                ),
            ]
        );
    }

    #[test]
    fn ends_mid_month_on_the_16th_keeping_the_deposit_on_the_3rd_and_not_the_one_on_the_20th() {
        let monthly_interest = (1000.0 + 100.0) * 1.0 * (15.0 / 30.0);
        let daily_interest = 1000.0 * 2.0_f64.powi(15) + 100.0 * 2.0_f64.powi(13) - 1100.0;

        for (compounding, interest, balance) in [
            ("monthly", monthly_interest, 1650.0),
            ("daily", daily_interest, 33_587_200.0),
        ] {
            assert_eq!(
                run(compounding, "2026-11-01", "2026-11-16", 1000.0)
                    .rules(early_and_late())
                    .project(),
                Series {
                    start_balance: 1000.0,
                    final_balance: balance,
                    total_contributions: 100.0,
                    total_interest: interest,
                    monthly: vec![month_row(2026, 11, balance, 100.0, interest)],
                    yearly: vec![year_row(2026, balance, 100.0, interest)],
                },
                "{compounding}"
            );
        }
    }

    #[test]
    fn starts_and_ends_inside_one_month_10th_to_25th_keeping_only_the_deposit_on_the_20th() {
        for (compounding, expected, balance) in [
            ("monthly", 1000.0 + 1000.0 * (15.0 / 30.0) + 10.0, 1510.0),
            (
                "daily",
                1000.0 * 2.0_f64.powi(15) + 10.0 * 2.0_f64.powi(5),
                32_768_320.0,
            ),
        ] {
            assert_eq!(expected, balance);
            assert_eq!(
                run(compounding, "2026-11-10", "2026-11-25", 1000.0)
                    .rules(early_and_late())
                    .final_balance(),
                balance,
                "{compounding}"
            );
        }
    }

    #[test]
    fn keeps_a_deposit_on_the_range_start_and_drops_ones_before_it_on_the_end_and_after_it() {
        let rules = json!([
            one_time("before", 1.0, "2026-11-09"),
            one_time("on-start", 10.0, "2026-11-10"),
            one_time("on-end", 100.0, "2026-11-25"),
            one_time("after", 1000.0, "2026-11-26"),
        ]);

        for (compounding, expected, balance, bucket) in [
            ("monthly", (1000.0 + 10.0) * 1.5, 1515.0, Bucket::Start),
            (
                "daily",
                (1000.0 + 10.0) * 2.0_f64.powi(15),
                33_095_680.0,
                Bucket::Day(10),
            ),
        ] {
            let run = run(compounding, "2026-11-10", "2026-11-25", 1000.0).rules(rules.clone());

            assert_eq!(expected, balance);
            assert_eq!(run.final_balance(), balance, "{compounding}");
            assert_eq!(
                run.deposits(),
                [("on-start".to_owned(), date("2026-11-10"), 10.0, bucket)]
            );
        }
    }

    #[test]
    fn starts_on_29_february_monthly_2900_plus_2900_x_1_29_is_3000_then_3000_plus_3100_x_1_31_is_3200_and_daily_1000_x_2_is_2000_then_2100_x_2_is_4200()
     {
        let rules = json!([flat(
            "first",
            100.0,
            json!({ "frequency": "monthly", "day": 1 })
        )]);

        for (compounding, rate, opening, balances) in [
            ("monthly", DOUBLING_MONTHLY_RATE, 2900.0, [3000.0, 3200.0]),
            ("daily", doubling_daily_rate(366), 1000.0, [2000.0, 4200.0]),
        ] {
            let run = run(compounding, "2028-02-29", "2028-03-02", opening)
                .rules(rules.clone())
                .rate(rate);

            assert_eq!(run.balances(), balances, "{compounding}");
            assert_eq!(
                run.segments(),
                [
                    (date("2028-02-29"), date("2028-03-01"), 1, 29, 366),
                    (date("2028-03-01"), date("2028-03-02"), 1, 31, 366),
                ]
            );
        }
    }

    #[test]
    fn dates_a_day_31_rule_on_30_november_kept_only_when_the_30th_is_counted() {
        let rules = json!([flat(
            "thirty-first",
            100.0,
            json!({ "frequency": "monthly", "day": 31 })
        )]);

        for (compounding, to, expected, balance) in [
            (
                "monthly",
                "2026-12-01",
                1000.0 + 1000.0 * (15.0 / 30.0) + 100.0,
                1600.0,
            ),
            (
                "daily",
                "2026-12-01",
                1000.0 * 2.0_f64.powi(15) + 100.0 * 2.0,
                32_768_200.0,
            ),
            (
                "monthly",
                "2026-11-30",
                1000.0 + 1000.0 * (14.0 / 30.0),
                1_466.666_666_666_666_7,
            ),
            (
                "daily",
                "2026-11-30",
                1000.0 * 2.0_f64.powi(14),
                16_384_000.0,
            ),
        ] {
            assert_eq!(expected, balance);
            assert_eq!(
                run(compounding, "2026-11-16", to, 1000.0)
                    .rules(rules.clone())
                    .final_balance(),
                balance,
                "{compounding} to {to}"
            );
        }
    }

    #[test]
    fn multiplies_monthly_segment_interest_by_the_day_fraction_last_1000_x_1_x_11_30_is_366_666_666_666_666_63_not_1000_x_11_30()
     {
        assert_eq!(1000.0 * 1.0 * (11.0 / 30.0), 366.666_666_666_666_63);
        assert_eq!((1000.0 * 11.0) / 30.0, 366.666_666_666_666_7);
        assert_eq!(
            run("monthly", "2026-11-01", "2026-11-12", 1000.0)
                .project()
                .total_interest(),
            366.666_666_666_666_63
        );
    }

    #[test]
    fn keeps_a_one_time_deposit_on_the_28th_in_the_start_bucket_of_a_monthly_segment_from_the_27th_2500_plus_500_x_4_30_is_400()
     {
        let run = run("monthly", "2026-11-27", "2026-12-01", 2500.0).rules(json!([one_time(
            "once",
            500.0,
            "2026-11-28"
        )]));

        assert_eq!(
            run.project().monthly(),
            [month_row(2026, 11, 3400.0, 500.0, 400.0)]
        );
        assert_eq!(
            run.segments(),
            [(date("2026-11-27"), date("2026-12-01"), 4, 30, 365)]
        );
        assert_eq!(
            run.deposits(),
            [("once".to_owned(), date("2026-11-28"), 500.0, Bucket::Start)]
        );
    }

    #[test]
    fn drops_a_one_time_deposit_on_the_28th_from_a_monthly_segment_that_starts_on_the_29th_3000_x_2_30_is_200()
     {
        assert_eq!(
            run("monthly", "2026-11-29", "2026-12-01", 3000.0)
                .rules(json!([one_time("once", 500.0, "2026-11-28")]))
                .project()
                .monthly(),
            [month_row(2026, 11, 3200.0, 0.0, 200.0)]
        );
    }

    #[test]
    fn drops_a_start_placement_dated_day_1_from_a_daily_range_that_starts_on_the_2nd_and_keeps_it_the_next_month_1000_x_2_pow_31_plus_100_x_2_pow_2()
     {
        let series = run("daily", "2026-11-02", "2026-12-03", 1000.0)
            .rules(json!([monthly_placement("placed-start", 100.0, "start")]))
            .project();
        let contributions: Vec<f64> = series
            .monthly()
            .iter()
            .map(|row| row.contributions())
            .collect();

        assert_eq!(contributions, [0.0, 100.0]);
        assert_eq!(
            series.final_balance(),
            1000.0 * 2.0_f64.powi(31) + 100.0 * 2.0_f64.powi(2)
        );
        assert_eq!(series.final_balance(), 2_147_483_648_400.0);
    }

    #[test]
    fn drops_an_end_placement_dated_the_last_day_from_a_daily_range_that_ends_on_that_day_1000_x_2_pow_29()
     {
        let series = run("daily", "2026-11-01", "2026-11-30", 1000.0)
            .rules(json!([monthly_placement("placed-end", 100.0, "end")]))
            .project();

        assert_eq!(series.total_contributions(), 0.0);
        assert_eq!(series.final_balance(), 536_870_912_000.0);
    }

    #[test]
    fn totals_the_kept_deposits_of_a_partial_monthly_segment_in_rule_order_1e16_plus_1_plus_1_is_1e16_not_1_plus_1_plus_1e16()
     {
        let rules = json!([
            one_time("big", 1e16, "2026-11-25"),
            one_time("first-small", 1.0, "2026-11-17"),
            one_time("second-small", 1.0, "2026-11-18"),
        ]);

        assert_eq!(1e16 + 1.0 + 1.0, 10_000_000_000_000_000.0);
        assert_eq!(1.0 + 1.0 + 1e16, 10_000_000_000_000_002.0);
        assert_eq!(
            run("monthly", "2026-11-16", "2026-12-01", 0.0)
                .rules(rules)
                .project()
                .monthly(),
            [month_row(
                2026,
                11,
                15_000_000_000_000_000.0,
                10_000_000_000_000_000.0,
                5_000_000_000_000_000.0
            )]
        );
    }

    #[test]
    fn adds_the_numbered_day_total_before_the_start_total_on_day_1_of_a_partial_daily_segment_1e16_plus_1_plus_1_x_2_pow_15()
     {
        let rules = json!([
            monthly_placement("first-start", 1.0, "start"),
            one_time("big", 1e16, "2026-11-01"),
            monthly_placement("second-start", 1.0, "start"),
        ]);
        let series = run("daily", "2026-11-01", "2026-11-16", 0.0)
            .rules(rules)
            .project();

        assert_eq!(1e16 + (1.0 + 1.0), 10_000_000_000_000_002.0);
        assert_eq!(series.total_contributions(), 10_000_000_000_000_002.0);
        assert_eq!(
            series.final_balance(),
            10_000_000_000_000_002.0 * 2.0_f64.powi(15)
        );
    }

    #[test]
    fn switches_the_daily_rate_from_365_to_366_days_at_a_year_end_1000_x_2_x_2_is_4000_then_4000_x_2_pow_365_366()
     {
        let run = run("daily", "2027-12-30", "2028-01-02", 1000.0);
        let leap_daily_rate = 2.0_f64.powi(365).powf(1.0 / 366.0) - 1.0;

        assert_eq!(leap_daily_rate, 0.996_215_894_873_588_6);
        assert_eq!(run.balances(), [4000.0, 4000.0 + 4000.0 * leap_daily_rate]);
        assert_eq!(4000.0 + 4000.0 * leap_daily_rate, 7_984.863_579_494_355);
        let days_in_year: Vec<i16> = run
            .segments()
            .iter()
            .map(|&(.., days_in_year)| days_in_year)
            .collect();
        assert_eq!(days_in_year, [365, 366]);
    }

    #[test]
    fn counts_29_february_in_a_daily_range_that_crosses_it_at_the_366_day_rate_1000_x_2_pow_3() {
        assert_eq!(
            run("daily", "2028-02-28", "2028-03-02", 1000.0)
                .rate(doubling_daily_rate(366))
                .final_balance(),
            8000.0
        );
    }
}

mod splitting_a_range {
    use super::*;

    fn contributions() -> Value {
        json!([
            flat("early", 100.0, json!({ "frequency": "monthly", "day": 3 })),
            flat("late", 10.0, json!({ "frequency": "monthly", "day": 20 })),
            monthly_placement("placed-end", 7.0, "end"),
            one_time("once", 250.0, "2027-01-17"),
        ])
    }

    fn whole(compounding: &'static str) -> f64 {
        run(compounding, "2026-11-27", "2027-03-10", 1234.5)
            .rules(contributions())
            .rate(0.07)
            .final_balance()
    }

    fn split(compounding: &'static str, middle: CalendarDate) -> f64 {
        let scenario = scenario(compounding, contributions());
        let account = only_account(&scenario);
        let first =
            project_account(&scenario, account, date("2026-11-27"), middle, 1234.5, 0.07).unwrap();
        project_account(
            &scenario,
            account,
            middle,
            date("2027-03-10"),
            first.final_balance(),
            0.07,
        )
        .unwrap()
        .final_balance()
    }

    #[test]
    fn gives_exactly_the_same_final_balance_in_daily_mode_wherever_the_range_is_split() {
        let whole = whole("daily");
        let middles = days_from("2026-11-28", "2027-03-10");

        assert_eq!(middles.len(), 102);
        for middle in middles {
            assert_eq!(split("daily", middle), whole, "split on {middle}");
        }
    }

    #[test]
    fn gives_exactly_the_same_final_balance_in_monthly_mode_when_the_range_is_split_on_the_1st_of_a_month()
     {
        let whole = whole("monthly");

        for middle in ["2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01"] {
            assert_eq!(split("monthly", date(middle)), whole, "split on {middle}");
        }
    }

    #[test]
    fn compounds_a_monthly_split_mid_month_twice_1000_x_2_is_2000_whole_1000_x_1_5_x_1_5_is_2250_split_on_the_16th()
     {
        assert_eq!(
            run("monthly", "2026-11-01", "2026-12-01", 1000.0).final_balance(),
            2000.0
        );
        let first = run("monthly", "2026-11-01", "2026-11-16", 1000.0).final_balance();
        assert_eq!(first, 1500.0);
        assert_eq!(
            run("monthly", "2026-11-16", "2026-12-01", first).final_balance(),
            2250.0
        );
    }
}

mod yearly_rows_over_a_range_that_starts_mid_year_and_ends_mid_month {
    use super::*;

    #[test]
    fn puts_each_calendar_year_at_its_last_counted_segment_1000_plus_10_then_plus_5_x_110_then_plus_12_x_110_then_plus_110_plus_100()
     {
        for compounding in ["monthly", "daily"] {
            let series = run(compounding, "2026-07-15", "2028-02-10", 1000.0)
                .rules(early_and_late())
                .rate(0.0)
                .project();

            assert_eq!(series.monthly().len(), 20, "{compounding}");
            assert_eq!(
                series.monthly().first(),
                Some(&month_row(2026, 7, 1010.0, 10.0, 0.0))
            );
            assert_eq!(
                series.yearly(),
                [
                    year_row(2026, 1560.0, 560.0, 0.0),
                    year_row(2027, 2880.0, 1880.0, 0.0),
                    year_row(2028, 3090.0, 2090.0, 0.0),
                ],
                "{compounding}"
            );
        }
    }
}

mod deposit_amounts_that_are_not_finite {
    use super::*;

    /// A zero amount grown by `(1 + 10000)^months` for over 77 months is `0 × ∞`, which is NaN.
    fn nan_deposit() -> Value {
        json!([{
            "id": "nan",
            "type": "flat",
            "amount": 0,
            "growth": { "type": "percent", "amount": 1_000_000, "cadence": "monthly" },
            "timing": { "frequency": "monthly", "day": 5 },
            "startDate": "2010-01-01"
        }])
    }

    /// One grown by `(1 + 10000)^months` for over 77 months is infinite.
    fn infinite_deposit() -> Value {
        json!([{
            "id": "infinite",
            "type": "flat",
            "amount": 1,
            "growth": { "type": "percent", "amount": 1_000_000, "cadence": "monthly" },
            "timing": { "frequency": "monthly", "placement": "end" },
            "startDate": "2010-01-01"
        }])
    }

    #[test]
    fn fails_with_not_finite_and_the_account_id_in_both_modes() {
        for compounding in ["monthly", "daily"] {
            for rules in [nan_deposit(), infinite_deposit()] {
                let scenario = scenario(compounding, rules);
                let account = only_account(&scenario);

                assert_eq!(
                    build_account_schedule(
                        &scenario,
                        account,
                        date("2026-11-01"),
                        date("2026-12-01")
                    ),
                    Err(ProjectionError::NotFinite {
                        account: account.id()
                    }),
                    "{compounding}"
                );
                assert_eq!(
                    project_account(
                        &scenario,
                        account,
                        date("2026-11-01"),
                        date("2026-12-01"),
                        1000.0,
                        0.05
                    ),
                    Err(ProjectionError::NotFinite {
                        account: account.id()
                    }),
                    "{compounding}"
                );
            }
        }
    }

    #[test]
    fn schedules_the_same_rules_before_their_amounts_overflow() {
        for compounding in ["monthly", "daily"] {
            let scenario = scenario(compounding, infinite_deposit());
            let account = only_account(&scenario);

            assert!(
                build_account_schedule(&scenario, account, date("2010-01-01"), date("2010-03-01"))
                    .is_ok(),
                "{compounding}"
            );
        }
    }
}
