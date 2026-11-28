use serde_json::{Value, json};

use super::{BucketTotals, Compounded, MAX_DAY, compound_segment};
use crate::fixture::{date, doubling_daily_rate, flat, one_time, only_account, scenario};
use crate::scenario::Compounding;
use crate::schedule::build_account_schedule;

const DOUBLING_MONTHLY_RATE: f64 = 4095.0;

fn totals(compounding: &str, rules: Value, from: &str, to: &str) -> Vec<BucketTotals> {
    let scenario = scenario(compounding, rules);
    build_account_schedule(&scenario, only_account(&scenario), date(from), date(to))
        .iter()
        .map(|month| BucketTotals::of(month.deposits()))
        .collect()
}

fn on_days(days: &[(usize, f64)]) -> [f64; MAX_DAY] {
    let mut by_day = [0.0; MAX_DAY];
    for &(day, total) in days {
        by_day[day - 1] = total;
    }
    by_day
}

fn compound_november(compounding: &str, rules: Value, from: &str, to: &str) -> Compounded {
    let scenario = scenario(compounding, rules);
    let schedule = build_account_schedule(&scenario, only_account(&scenario), date(from), date(to));
    let [month] = schedule.as_slice() else {
        panic!("expected one month");
    };
    let mode = scenario.interest().compounding();
    let rate = match mode {
        Compounding::Monthly => DOUBLING_MONTHLY_RATE,
        Compounding::Daily => doubling_daily_rate(365),
    };
    compound_segment(
        1000.0,
        &BucketTotals::of(month.deposits()),
        month,
        mode,
        rate,
    )
}

#[test]
fn sums_each_bucket_from_0_in_schedule_order_not_in_date_order() {
    let rules = json!([
        flat("big", 1e16, json!({ "frequency": "monthly", "day": 15 })),
        flat("third", 1.0, json!({ "frequency": "monthly", "day": 3 })),
        flat("second", 1.0, json!({ "frequency": "monthly", "day": 2 })),
        flat("late-a", 1.0, json!({ "frequency": "monthly", "day": 20 })),
        flat("late-b", 1.0, json!({ "frequency": "monthly", "day": 21 })),
        flat(
            "late-big",
            1e16,
            json!({ "frequency": "monthly", "day": 22 })
        ),
    ]);

    assert_eq!(1e16 + 1.0 + 1.0, 10_000_000_000_000_000.0);
    assert_eq!(1.0 + 1.0 + 1e16, 10_000_000_000_000_002.0);
    assert_eq!(
        totals("monthly", rules, "2026-01-01", "2026-02-01"),
        [BucketTotals {
            start: 10_000_000_000_000_000.0,
            end: 10_000_000_000_000_002.0,
            by_day: [0.0; MAX_DAY],
        }]
    );
}

#[test]
fn totals_each_numbered_day_of_daily_mode_apart_from_the_placement_buckets() {
    let rules = json!([
        flat(
            "start",
            1.0,
            json!({ "frequency": "monthly", "placement": "start" })
        ),
        flat("day-3", 4.0, json!({ "frequency": "monthly", "day": 3 })),
        flat("day-2", 5.0, json!({ "frequency": "monthly", "day": 2 })),
        flat(
            "end",
            2.0,
            json!({ "frequency": "monthly", "placement": "end" })
        ),
        flat(
            "day-3-again",
            6.0,
            json!({ "frequency": "monthly", "day": 3 })
        ),
        one_time("on-the-1st", 7.0, "2026-11-01"),
        flat("day-31", 8.0, json!({ "frequency": "monthly", "day": 31 })),
    ]);

    assert_eq!(
        totals("daily", rules, "2026-11-01", "2026-12-01"),
        [BucketTotals {
            start: 1.0,
            end: 2.0,
            by_day: on_days(&[(1, 7.0), (2, 5.0), (3, 10.0), (30, 8.0)]),
        }]
    );
}

#[test]
fn totals_a_month_with_no_deposits_as_zeros() {
    assert_eq!(
        totals("daily", json!([]), "2026-11-01", "2026-12-01"),
        [BucketTotals {
            start: 0.0,
            end: 0.0,
            by_day: [0.0; MAX_DAY],
        }]
    );
}

#[test]
fn compounds_a_monthly_segment_after_its_start_deposits_and_before_its_end_deposits() {
    let rules = json!([
        flat(
            "start",
            60.0,
            json!({ "frequency": "monthly", "placement": "start" })
        ),
        flat(
            "end",
            50.0,
            json!({ "frequency": "monthly", "placement": "end" })
        ),
    ]);

    assert_eq!(
        compound_november("monthly", rules, "2026-11-01", "2026-12-01"),
        Compounded {
            balance: (1000.0 + 60.0) * 2.0 + 50.0,
            contributions: 110.0,
            interest: 1060.0,
        }
    );
}

#[test]
fn multiplies_a_monthly_segment_by_its_share_of_the_month_last() {
    assert_eq!(
        compound_november("monthly", json!([]), "2026-11-01", "2026-11-12"),
        Compounded {
            balance: 1000.0 + 366.666_666_666_666_63,
            contributions: 0.0,
            interest: 366.666_666_666_666_63,
        }
    );
}

#[test]
fn adds_a_daily_deposit_before_the_day_of_interest_on_each_counted_day() {
    let rules = json!([flat(
        "start",
        1.0,
        json!({ "frequency": "monthly", "placement": "start" })
    )]);

    assert_eq!(
        compound_november("daily", rules, "2026-11-01", "2026-11-03"),
        Compounded {
            balance: (1000.0 + 1.0) * 2.0 * 2.0,
            contributions: 1.0,
            interest: 3003.0,
        }
    );
}
