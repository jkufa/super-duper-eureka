use serde_json::{Value, json};

use super::{Bucket, ScheduledMonth, build_account_schedule, salary_in_year};
use crate::date::CalendarDate;
use crate::project::project_account;
use crate::scenario::Scenario;

const TODAY: &str = "2026-01-01";

struct Setup {
    rules: Value,
    compounding: &'static str,
    salary: Value,
}

impl Setup {
    fn new(rules: Value) -> Self {
        Self {
            rules,
            compounding: "monthly",
            salary: json!({ "annualBase": 0, "asOf": TODAY }),
        }
    }

    fn daily(self) -> Self {
        Self {
            compounding: "daily",
            ..self
        }
    }

    fn with_compounding(self, compounding: &'static str) -> Self {
        Self {
            compounding,
            ..self
        }
    }

    fn with_salary(self, salary: Value) -> Self {
        Self { salary, ..self }
    }

    fn scenario(&self) -> Scenario {
        let file = json!({
            "version": 1,
            "endDate": "2031-01-01",
            "interest": { "annualRate": 0, "compounding": self.compounding },
            "salary": self.salary,
            "accounts": [{
                "id": "account",
                "name": "Account",
                "kind": "other",
                "included": true,
                "balance": 0,
                "balanceAsOf": TODAY,
                "contributions": self.rules
            }]
        });
        Scenario::parse(serde_json::from_value(file).unwrap(), date(TODAY)).unwrap()
    }

    fn deposits(&self, from: &str, to: &str) -> Vec<Listed> {
        let scenario = self.scenario();
        let [account] = scenario.accounts() else {
            panic!("expected one account");
        };
        build_account_schedule(&scenario, account, date(from), date(to))
            .iter()
            .flat_map(ScheduledMonth::deposits)
            .map(|deposit| Listed {
                rule_id: deposit.rule_id().to_string(),
                date: deposit.date().to_string(),
                amount: deposit.amount(),
                bucket: deposit.bucket(),
            })
            .collect()
    }

    /// At a rate of 0 from an opening balance of 0.
    fn final_balance(&self, from: &str, to: &str) -> f64 {
        let scenario = self.scenario();
        let [account] = scenario.accounts() else {
            panic!("expected one account");
        };
        project_account(&scenario, account, date(from), date(to), 0.0, 0.0)
            .unwrap()
            .final_balance()
    }
}

#[derive(Debug, PartialEq)]
struct Listed {
    rule_id: String,
    date: String,
    amount: f64,
    bucket: Bucket,
}

fn listed(rule_id: &str, date: &str, amount: f64, bucket: Bucket) -> Listed {
    Listed {
        rule_id: rule_id.to_owned(),
        date: date.to_owned(),
        amount,
        bucket,
    }
}

#[derive(Debug, PartialEq)]
struct Segment {
    from: CalendarDate,
    to: CalendarDate,
    first_day: i8,
    days: i8,
    days_in_month: i8,
    days_in_year: i16,
}

fn segments(from: &str, to: &str) -> Vec<Segment> {
    let scenario = Setup::new(json!([])).scenario();
    let [account] = scenario.accounts() else {
        panic!("expected one account");
    };
    build_account_schedule(&scenario, account, date(from), date(to))
        .iter()
        .map(|month| {
            assert_eq!(month.deposits(), []);
            Segment {
                from: month.from(),
                to: month.to(),
                first_day: month.first_day(),
                days: month.days(),
                days_in_month: month.days_in_month(),
                days_in_year: month.days_in_year(),
            }
        })
        .collect()
}

fn date(text: &str) -> CalendarDate {
    CalendarDate::parse(text).unwrap()
}

fn flat(id: &str, timing: Value) -> Value {
    json!({ "id": id, "type": "flat", "amount": 100, "timing": timing })
}

fn flat_with(id: &str, timing: Value, extra: Value) -> Value {
    let mut rule = flat(id, timing);
    let Value::Object(extra) = extra else {
        panic!("extra fields must be an object");
    };
    rule.as_object_mut().unwrap().extend(extra);
    rule
}

fn percent_of_salary(id: &str, extra: Value) -> Value {
    let mut rule = json!({
        "id": id,
        "type": "salaryPercent",
        "amount": 50,
        "timing": { "frequency": "annual", "month": 1 }
    });
    let Value::Object(extra) = extra else {
        panic!("extra fields must be an object");
    };
    rule.as_object_mut().unwrap().extend(extra);
    rule
}

#[test]
fn lists_the_months_of_the_range_with_their_calendar_facts() {
    assert_eq!(
        segments("2027-12-01", "2028-03-01"),
        [
            Segment {
                from: date("2027-12-01"),
                to: date("2028-01-01"),
                first_day: 1,
                days: 31,
                days_in_month: 31,
                days_in_year: 365,
            },
            Segment {
                from: date("2028-01-01"),
                to: date("2028-02-01"),
                first_day: 1,
                days: 31,
                days_in_month: 31,
                days_in_year: 366,
            },
            Segment {
                from: date("2028-02-01"),
                to: date("2028-03-01"),
                first_day: 1,
                days: 29,
                days_in_month: 29,
                days_in_year: 366,
            },
        ]
    );
}

#[test]
fn cuts_the_first_and_last_months_to_the_days_of_the_range() {
    assert_eq!(
        segments("2027-12-27", "2028-02-10"),
        [
            Segment {
                from: date("2027-12-27"),
                to: date("2028-01-01"),
                first_day: 27,
                days: 5,
                days_in_month: 31,
                days_in_year: 365,
            },
            Segment {
                from: date("2028-01-01"),
                to: date("2028-02-01"),
                first_day: 1,
                days: 31,
                days_in_month: 31,
                days_in_year: 366,
            },
            Segment {
                from: date("2028-02-01"),
                to: date("2028-02-10"),
                first_day: 1,
                days: 9,
                days_in_month: 29,
                days_in_year: 366,
            },
        ]
    );
}

#[test]
fn cuts_a_range_inside_one_month_to_its_days() {
    assert_eq!(
        segments("2026-03-15", "2026-03-20"),
        [Segment {
            from: date("2026-03-15"),
            to: date("2026-03-20"),
            first_day: 15,
            days: 5,
            days_in_month: 31,
            days_in_year: 365,
        }]
    );
}

#[test]
fn lists_no_months_when_the_range_is_empty() {
    assert_eq!(segments("2026-03-15", "2026-03-15"), []);
    assert_eq!(segments("2026-03-20", "2026-03-15"), []);
    assert_eq!(segments("2026-04-01", "2026-03-01"), []);
}

#[test]
fn ends_the_last_supported_month_on_the_range_end() {
    assert_eq!(
        segments("9999-11-20", "9999-12-31"),
        [
            Segment {
                from: date("9999-11-20"),
                to: date("9999-12-01"),
                first_day: 20,
                days: 11,
                days_in_month: 30,
                days_in_year: 365,
            },
            Segment {
                from: date("9999-12-01"),
                to: date("9999-12-31"),
                first_day: 1,
                days: 30,
                days_in_month: 31,
                days_in_year: 365,
            },
        ]
    );
}

#[test]
fn keeps_each_date_while_two_days_share_the_start_bucket_in_monthly_mode() {
    let rules = json!([
        flat("second", json!({ "frequency": "monthly", "day": 2 })),
        flat("sixteenth", json!({ "frequency": "monthly", "day": 16 })),
        flat("seventeenth", json!({ "frequency": "monthly", "day": 17 })),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2026-01-01", "2026-02-01"),
        [
            listed("second", "2026-01-02", 100.0, Bucket::Start),
            listed("sixteenth", "2026-01-16", 100.0, Bucket::Start),
            listed("seventeenth", "2026-01-17", 100.0, Bucket::End),
        ]
    );
}

#[test]
fn keeps_a_placement_only_rule_in_its_bucket_in_daily_mode_and_dates_it_on_day_1_or_the_last_day() {
    let rules = json!([
        flat(
            "placed-end",
            json!({ "frequency": "monthly", "placement": "end" })
        ),
        flat(
            "placed-start",
            json!({ "frequency": "monthly", "placement": "start" })
        ),
        flat("unplaced", json!({ "frequency": "monthly" })),
    ]);

    assert_eq!(
        Setup::new(rules)
            .daily()
            .deposits("2026-04-01", "2026-05-01"),
        [
            listed("placed-end", "2026-04-30", 100.0, Bucket::End),
            listed("placed-start", "2026-04-01", 100.0, Bucket::Start),
            listed("unplaced", "2026-04-01", 100.0, Bucket::Start),
        ]
    );
}

#[test]
fn clamps_a_day_31_rule_to_a_30_day_month_and_to_february() {
    for (compounding, buckets) in [
        ("daily", [Bucket::Day(30), Bucket::Day(29), Bucket::Day(28)]),
        ("monthly", [Bucket::End, Bucket::End, Bucket::End]),
    ] {
        let setup = Setup::new(json!([flat(
            "day-31",
            json!({ "frequency": "monthly", "day": 31 })
        )]))
        .with_compounding(compounding);
        let mut found = setup.deposits("2026-04-01", "2026-05-01");
        found.extend(setup.deposits("2028-02-01", "2028-03-01"));
        found.extend(setup.deposits("2027-02-01", "2027-03-01"));

        assert_eq!(
            found,
            [
                listed("day-31", "2026-04-30", 100.0, buckets[0]),
                listed("day-31", "2028-02-29", 100.0, buckets[1]),
                listed("day-31", "2027-02-28", 100.0, buckets[2]),
            ],
            "{compounding}"
        );
    }
}

#[test]
fn dates_an_annual_rule_on_29_february_on_the_28th_in_other_years() {
    let rules = json!([flat(
        "leap-day",
        json!({ "frequency": "annual", "month": 2, "day": 29 })
    )]);

    assert_eq!(
        Setup::new(rules)
            .daily()
            .deposits("2027-01-01", "2029-01-01"),
        [
            listed("leap-day", "2027-02-28", 100.0, Bucket::Day(28)),
            listed("leap-day", "2028-02-29", 100.0, Bucket::Day(29)),
        ]
    );
}

#[test]
fn keeps_the_date_of_a_late_one_time_deposit() {
    for (compounding, bucket) in [("monthly", Bucket::Start), ("daily", Bucket::Day(28))] {
        let rules = json!([flat(
            "late",
            json!({ "frequency": "oneTime", "on": "2026-03-28" })
        )]);

        assert_eq!(
            Setup::new(rules)
                .with_compounding(compounding)
                .deposits("2026-01-01", "2027-01-01"),
            [listed("late", "2026-03-28", 100.0, bucket)],
            "{compounding}"
        );
    }
}

#[test]
fn deposits_on_the_start_date_and_the_end_date_of_a_rule_and_not_outside_them() {
    let rules = json!([
        flat_with(
            "inclusive",
            json!({ "frequency": "monthly", "day": 15 }),
            json!({ "startDate": "2026-02-15", "endDate": "2026-04-15" })
        ),
        flat_with(
            "exclusive",
            json!({ "frequency": "monthly", "day": 15 }),
            json!({ "startDate": "2026-02-16", "endDate": "2026-04-14" })
        ),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2026-01-01", "2026-06-01"),
        [
            listed("inclusive", "2026-02-15", 100.0, Bucket::End),
            listed("inclusive", "2026-03-15", 100.0, Bucket::Start),
            listed("exclusive", "2026-03-15", 100.0, Bucket::Start),
            listed("inclusive", "2026-04-15", 100.0, Bucket::Start),
        ]
    );
}

#[test]
fn counts_annual_growth_in_whole_years_from_the_rule_start_not_from_the_range_start() {
    let growth = json!({ "type": "percent", "amount": 50, "cadence": "annual" });
    let rules = json!([
        flat_with(
            "day-before",
            json!({ "frequency": "annual", "month": 3, "day": 14 }),
            json!({ "growth": growth, "startDate": "2026-03-15" })
        ),
        flat_with(
            "anniversary",
            json!({ "frequency": "annual", "month": 3, "day": 15 }),
            json!({ "growth": growth, "startDate": "2026-03-15" })
        ),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2027-01-01", "2029-01-01"),
        [
            listed("day-before", "2027-03-14", 100.0, Bucket::Start),
            listed("anniversary", "2027-03-15", 150.0, Bucket::Start),
            listed("day-before", "2028-03-14", 150.0, Bucket::Start),
            listed("anniversary", "2028-03-15", 225.0, Bucket::Start),
        ]
    );
}

#[test]
fn counts_monthly_growth_in_whole_months_with_the_31st_reaching_shorter_months_on_their_last_day() {
    let rules = json!([
        flat_with(
            "day-before",
            json!({ "frequency": "monthly", "day": 14 }),
            json!({
                "growth": { "type": "flat", "amount": 10, "cadence": "monthly" },
                "startDate": "2026-03-15"
            })
        ),
        flat_with(
            "month-end",
            json!({ "frequency": "monthly", "day": 31 }),
            json!({
                "growth": { "type": "flat", "amount": 1, "cadence": "monthly" },
                "startDate": "2026-01-31"
            })
        ),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2026-01-01", "2026-06-01"),
        [
            listed("month-end", "2026-01-31", 100.0, Bucket::End),
            listed("month-end", "2026-02-28", 101.0, Bucket::End),
            listed("month-end", "2026-03-31", 102.0, Bucket::End),
            listed("day-before", "2026-04-14", 100.0, Bucket::Start),
            listed("month-end", "2026-04-30", 103.0, Bucket::End),
            listed("day-before", "2026-05-14", 110.0, Bucket::Start),
            listed("month-end", "2026-05-31", 104.0, Bucket::End),
        ]
    );
}

#[test]
fn counts_annual_growth_one_day_before_and_on_the_anniversary_of_29_february_and_of_a_31st() {
    let growth = json!({ "type": "flat", "amount": 1, "cadence": "annual" });
    let annual = |id: &str, month: i8, day: i8, start: &str| {
        flat_with(
            id,
            json!({ "frequency": "annual", "month": month, "day": day }),
            json!({ "growth": growth, "startDate": start }),
        )
    };
    let rules = json!([
        annual("leap-before", 2, 27, "2024-02-29"),
        annual("leap-on", 2, 28, "2024-02-29"),
        annual("end-before", 3, 30, "2025-03-31"),
        annual("end-on", 3, 31, "2025-03-31"),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2025-01-01", "2027-01-01"),
        [
            listed("leap-before", "2025-02-27", 100.0, Bucket::End),
            listed("leap-on", "2025-02-28", 101.0, Bucket::End),
            listed("end-on", "2025-03-31", 100.0, Bucket::End),
            listed("leap-before", "2026-02-27", 101.0, Bucket::End),
            listed("leap-on", "2026-02-28", 102.0, Bucket::End),
            listed("end-before", "2026-03-30", 100.0, Bucket::End),
            listed("end-on", "2026-03-31", 101.0, Bucket::End),
        ]
    );
}

#[test]
fn counts_monthly_growth_one_day_before_and_on_the_clamped_anniversary_of_a_31st() {
    let rules = json!([flat_with(
        "month-end",
        json!({ "frequency": "monthly", "day": 29 }),
        json!({
            "growth": { "type": "percent", "amount": 10, "cadence": "monthly" },
            "startDate": "2026-03-31"
        })
    )]);
    let more_rules = json!([flat_with(
        "month-end",
        json!({ "frequency": "monthly", "day": 30 }),
        json!({
            "growth": { "type": "percent", "amount": 10, "cadence": "monthly" },
            "startDate": "2026-03-31"
        })
    )]);

    assert_eq!(
        Setup::new(rules).deposits("2026-04-01", "2026-05-01"),
        [listed("month-end", "2026-04-29", 100.0, Bucket::End)]
    );
    assert_eq!(
        Setup::new(more_rules).deposits("2026-04-01", "2026-05-01"),
        [listed(
            "month-end",
            "2026-04-30",
            110.00000000000001,
            Bucket::End
        )]
    );
}

#[test]
fn raises_salary_on_each_1_january_after_salary_as_of_not_on_its_anniversary() {
    let salary = json!({ "annualBase": 100_000, "annualRaiseRate": 0.5, "asOf": "2026-07-01" });
    let rules = json!([{
        "id": "match",
        "type": "salaryPercent",
        "amount": 50,
        "timing": { "frequency": "annual", "month": 3 }
    }]);
    let setup = Setup::new(rules).with_salary(salary);
    let scenario = setup.scenario();

    assert_eq!(
        [2026, 2027, 2028].map(|year| salary_in_year(&scenario, year)),
        [100_000.0, 150_000.0, 225_000.0]
    );
    assert_eq!(
        setup.deposits("2026-01-01", "2029-01-01"),
        [
            listed("match", "2026-03-01", 50_000.0, Bucket::Start),
            listed("match", "2027-03-01", 75_000.0, Bucket::Start),
            listed("match", "2028-03-01", 112_500.0, Bucket::Start),
        ]
    );
}

#[test]
fn divides_salary_by_the_basis_and_per_contribution_by_12_on_a_monthly_rule_and_1_on_an_annual_one()
{
    let salary = json!({ "annualBase": 52_000 * 365, "asOf": TODAY });
    let rules = json!([
        percent_of_salary("weekly", json!({ "salaryBasis": "weekly" })),
        percent_of_salary("daily", json!({ "salaryBasis": "daily" })),
        percent_of_salary("per-annual", json!({ "salaryBasis": "perContribution" })),
        percent_of_salary(
            "per-monthly",
            json!({ "salaryBasis": "perContribution", "timing": { "frequency": "monthly" } })
        ),
    ]);

    assert_eq!(
        Setup::new(rules)
            .with_salary(salary)
            .deposits("2026-01-01", "2026-02-01"),
        [
            listed("weekly", "2026-01-01", 182_500.0, Bucket::Start),
            listed("daily", "2026-01-01", 26_000.0, Bucket::Start),
            listed("per-annual", "2026-01-01", 9_490_000.0, Bucket::Start),
            listed(
                "per-monthly",
                "2026-01-01",
                9_490_000.0 / 12.0,
                Bucket::Start
            ),
        ]
    );
}

#[test]
fn divides_salary_by_12_on_a_monthly_basis_and_by_26_on_a_biweekly_one() {
    let salary = json!({ "annualBase": 52_000 * 365, "asOf": TODAY });
    let rules = json!([
        percent_of_salary("monthly", json!({ "salaryBasis": "monthly" })),
        percent_of_salary("biweekly", json!({ "salaryBasis": "biweekly" })),
        percent_of_salary("annual", json!({ "salaryBasis": "annual" })),
    ]);

    assert_eq!(
        Setup::new(rules)
            .with_salary(salary)
            .deposits("2026-01-01", "2026-02-01"),
        [
            listed("monthly", "2026-01-01", 9_490_000.0 / 12.0, Bucket::Start),
            listed("biweekly", "2026-01-01", 365_000.0, Bucket::Start),
            listed("annual", "2026-01-01", 9_490_000.0, Bucket::Start),
        ]
    );
}

#[test]
fn applies_raises_on_both_sides_of_salary_as_of() {
    let salary = json!({ "annualBase": 100_000, "annualRaiseRate": 1, "asOf": "2027-07-01" });
    let rules = json!([{
        "id": "match",
        "type": "salaryPercent",
        "amount": 50,
        "timing": { "frequency": "annual", "month": 3 }
    }]);
    let setup = Setup::new(rules).with_salary(salary);
    let scenario = setup.scenario();

    assert_eq!(
        [2026, 2027, 2028].map(|year| salary_in_year(&scenario, year)),
        [50_000.0, 100_000.0, 200_000.0]
    );
    assert_eq!(
        setup.deposits("2026-01-01", "2029-01-01"),
        [
            listed("match", "2026-03-01", 25_000.0, Bucket::Start),
            listed("match", "2027-03-01", 50_000.0, Bucket::Start),
            listed("match", "2028-03-01", 100_000.0, Bucket::Start),
        ]
    );
}

#[test]
fn divides_by_the_basis_before_applying_the_percentage() {
    let salary = json!({ "annualBase": 100, "asOf": TODAY });
    let rules = json!([percent_of_salary(
        "monthly",
        json!({ "amount": 7, "salaryBasis": "monthly" })
    )]);

    let found = Setup::new(rules)
        .with_salary(salary)
        .deposits("2026-01-01", "2026-02-01");

    assert_eq!(
        found[0].amount.to_bits(),
        0.583_333_333_333_333_5_f64.to_bits()
    );
    assert_ne!(found[0].amount, (100.0 * (7.0 / 100.0)) / 12.0);
}

#[test]
fn keeps_a_deposit_on_the_range_start_and_leaves_out_one_on_the_range_end() {
    let rules = json!([
        flat("before", json!({ "frequency": "monthly", "day": 14 })),
        flat("on-start", json!({ "frequency": "monthly", "day": 15 })),
        flat("inside", json!({ "frequency": "monthly", "day": 19 })),
        flat("on-end", json!({ "frequency": "monthly", "day": 20 })),
        flat("after", json!({ "frequency": "monthly", "day": 21 })),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2026-03-15", "2026-03-20"),
        [
            listed("on-start", "2026-03-15", 100.0, Bucket::Start),
            listed("inside", "2026-03-19", 100.0, Bucket::End),
        ]
    );
}

#[test]
fn leaves_out_a_start_placement_dated_before_a_range_that_starts_mid_month() {
    let rules = json!([
        flat(
            "placed-start",
            json!({ "frequency": "monthly", "placement": "start" })
        ),
        flat(
            "placed-end",
            json!({ "frequency": "monthly", "placement": "end" })
        ),
    ]);

    assert_eq!(
        Setup::new(rules)
            .daily()
            .deposits("2026-03-15", "2026-04-10"),
        [
            listed("placed-end", "2026-03-31", 100.0, Bucket::End),
            listed("placed-start", "2026-04-01", 100.0, Bucket::Start),
        ]
    );
}

#[test]
fn leaves_out_a_zero_amount_deposit_and_a_disabled_rule() {
    let rules = json!([
        flat_with("zero", json!({ "frequency": "monthly" }), json!({ "amount": 0 })),
        {
            "id": "no-salary",
            "type": "salaryPercent",
            "amount": 10,
            "timing": { "frequency": "monthly" }
        },
        flat_with("disabled", json!({ "frequency": "monthly" }), json!({ "enabled": false })),
        flat("kept", json!({ "frequency": "monthly" })),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2026-01-01", "2026-02-01"),
        [listed("kept", "2026-01-01", 100.0, Bucket::Start)]
    );
}

#[test]
fn lists_a_month_by_rule_position_not_by_day() {
    let rules = json!([
        flat_with(
            "big",
            json!({ "frequency": "monthly", "day": 15 }),
            json!({ "amount": 1e16 })
        ),
        flat_with(
            "third",
            json!({ "frequency": "monthly", "day": 3 }),
            json!({ "amount": 1 })
        ),
        flat_with(
            "second",
            json!({ "frequency": "monthly", "day": 2 }),
            json!({ "amount": 1 })
        ),
    ]);

    let setup = Setup::new(rules);

    assert_eq!(
        setup.deposits("2026-01-01", "2026-02-01"),
        [
            listed("big", "2026-01-15", 1e16, Bucket::Start),
            listed("third", "2026-01-03", 1.0, Bucket::Start),
            listed("second", "2026-01-02", 1.0, Bucket::Start),
        ]
    );
    assert_eq!(setup.final_balance("2026-01-01", "2026-02-01"), 1e16);
}

#[test]
fn lists_rules_sharing_a_day_of_daily_mode_in_rule_order() {
    let rules = json!([
        flat_with(
            "big",
            json!({ "frequency": "monthly", "day": 5 }),
            json!({ "amount": 1e16 })
        ),
        flat_with(
            "small-a",
            json!({ "frequency": "monthly", "day": 5 }),
            json!({ "amount": 1 })
        ),
        flat_with(
            "small-b",
            json!({ "frequency": "monthly", "day": 5 }),
            json!({ "amount": 1 })
        ),
    ]);

    let setup = Setup::new(rules).daily();

    assert_eq!(
        setup.deposits("2026-01-01", "2026-02-01"),
        [
            listed("big", "2026-01-05", 1e16, Bucket::Day(5)),
            listed("small-a", "2026-01-05", 1.0, Bucket::Day(5)),
            listed("small-b", "2026-01-05", 1.0, Bucket::Day(5)),
        ]
    );
    assert_eq!(setup.final_balance("2026-01-01", "2026-02-01"), 1e16);
}

#[test]
fn deposits_an_annual_rule_only_in_its_month_and_a_one_time_rule_only_on_its_date() {
    let rules = json!([
        flat(
            "june",
            json!({ "frequency": "annual", "month": 6, "placement": "end" })
        ),
        flat(
            "once",
            json!({ "frequency": "oneTime", "on": "2027-06-10" })
        ),
    ]);

    assert_eq!(
        Setup::new(rules).deposits("2026-01-01", "2028-01-01"),
        [
            listed("june", "2026-06-30", 100.0, Bucket::End),
            listed("june", "2027-06-30", 100.0, Bucket::End),
            listed("once", "2027-06-10", 100.0, Bucket::Start),
        ]
    );
}
