use serde_json::{Value, json};

use super::{BucketTotals, Compounded, MAX_DAY, compound_segment};
use crate::fixture::{date, doubling_daily_rate, flat, one_time, only_account, scenario};
use crate::scenario::Compounding;
use crate::schedule::{ScheduledMonth, build_account_schedule, month_segments};

const DOUBLING_MONTHLY_RATE: f64 = 4095.0;

fn totals(compounding: &str, rules: Value, from: &str, to: &str) -> Vec<BucketTotals> {
    let scenario = scenario(compounding, rules);
    build_account_schedule(&scenario, only_account(&scenario), date(from), date(to))
        .unwrap()
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

fn only_month(from: &str, to: &str) -> ScheduledMonth<'static> {
    let mut months = month_segments(date(from), date(to));
    let month = months.next().unwrap();
    assert!(months.next().is_none());
    month
}

fn compound_november(compounding: &str, rules: Value, from: &str, to: &str) -> Compounded {
    let scenario = scenario(compounding, rules);
    let schedule =
        build_account_schedule(&scenario, only_account(&scenario), date(from), date(to)).unwrap();
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
fn multiplies_the_balance_by_the_monthly_rate_before_the_share_1e16_x_rate_at_10_percent_x_11_over_30_is_29238514905980_465()
 {
    let scenario = scenario("monthly", json!([]));
    let schedule = build_account_schedule(
        &scenario,
        only_account(&scenario),
        date("2026-11-01"),
        date("2026-11-12"),
    )
    .unwrap();
    let [month] = schedule.as_slice() else {
        panic!("expected one month");
    };
    let monthly_rate = 1.1_f64.powf(1.0 / 12.0) - 1.0;
    let share = 11.0 / 30.0;

    assert_eq!(monthly_rate, 0.007_974_140_428_903_764);
    assert_eq!(share, 0.366_666_666_666_666_64);
    assert_eq!(1e16 * monthly_rate, 79_741_404_289_037.64);
    assert_eq!(79_741_404_289_037.64 * share, 29_238_514_905_980.465);
    assert_eq!(1e16 * (monthly_rate * share), 29_238_514_905_980.47);
    assert_eq!(
        compound_segment(
            1e16,
            &BucketTotals::of(month.deposits()),
            month,
            Compounding::Monthly,
            0.1,
        )
        .interest(),
        29_238_514_905_980.465
    );
}

#[test]
fn adds_the_interest_to_the_balance_after_start_deposits_and_then_the_end_total_1000_1_plus_7_974937842946654_plus_0_1_is_1008_1749378429467()
 {
    let totals = BucketTotals {
        start: 0.1,
        end: 0.1,
        by_day: [0.0; MAX_DAY],
    };
    let interest = 7.974_937_842_946_654;

    assert_eq!(1000.0 + 0.1, 1000.1);
    assert_eq!(1000.1 * (1.1_f64.powf(1.0 / 12.0) - 1.0), interest);
    assert_eq!(1000.1 + interest + 0.1, 1_008.174_937_842_946_7);
    assert_eq!(1000.1 + (interest + 0.1), 1_008.174_937_842_946_6);
    assert_eq!(1000.0 + (0.1 + interest) + 0.1, 1_008.174_937_842_946_6);
    assert_eq!(
        compound_segment(
            1000.0,
            &totals,
            &only_month("2026-11-01", "2026-12-01"),
            Compounding::Monthly,
            0.1,
        ),
        Compounded {
            balance: 1_008.174_937_842_946_7,
            contributions: 0.2,
            interest,
        }
    );
}

#[test]
fn adds_balance_times_the_365th_root_daily_rate_to_the_balance_2411_at_50_percent_is_2413_679779598977()
 {
    let daily_rate = 1.5_f64.powf(1.0 / 365.0) - 1.0;
    let interest = 2411.0 * daily_rate;

    assert_eq!(daily_rate, 0.001_111_480_547_066_223_7);
    assert_eq!(
        (0.5_f64.ln_1p() / 365.0).exp_m1(),
        0.001_111_480_547_066_226_5
    );
    assert_eq!(2411.0 + interest, 2_413.679_779_598_977);
    assert_eq!(2411.0 * (1.0 + daily_rate), 2_413.679_779_598_976_4);
    assert_eq!(
        compound_segment(
            2411.0,
            &BucketTotals::of(&[]),
            &only_month("2026-11-01", "2026-11-02"),
            Compounding::Daily,
            0.5,
        ),
        Compounded {
            balance: 2_413.679_779_598_977,
            contributions: 0.0,
            interest,
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
