//! Proptest generators of valid scenario files, as JSON, with the `today` each is valid for.

use std::fmt;
use std::ops::RangeInclusive;

use proptest::prelude::*;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::date::CalendarDate;
use crate::scenario::Scenario;
use crate::scenario::raw::ScenarioFile;

/// Up to this many months from `today` to the end date.
const MAX_HORIZON_MONTHS: i32 = 120;
/// Up to this many months from an account's balance date to `today`.
const MAX_STALE_MONTHS: i32 = 24;
const MAX_ACCOUNTS: usize = 4;
const MAX_RULES: usize = 3;

/// A scenario file and the `today` it is valid for. Prints as `--today` and the file's JSON, the
/// two inputs the CLI takes.
#[derive(Clone)]
pub(crate) struct Case {
    pub(crate) file: Value,
    pub(crate) today: CalendarDate,
}

impl fmt::Debug for Case {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "--today {} {}", self.today, self.file)
    }
}

impl Case {
    pub(crate) fn scenario(&self) -> Scenario {
        self.scenario_on(self.today)
    }

    pub(crate) fn scenario_on(&self, today: CalendarDate) -> Scenario {
        let file = ScenarioFile::deserialize(&self.file).unwrap();
        Scenario::parse(file, today).unwrap()
    }
}

/// `date` moved by `months`, on `day` or the month's last day.
fn shifted(date: CalendarDate, months: i32, day: i8) -> CalendarDate {
    date.checked_add_months(months)
        .unwrap()
        .with_day_clamped(day)
}

fn text(date: CalendarDate) -> String {
    date.to_string()
}

fn date_between(first: CalendarDate, last: CalendarDate) -> impl Strategy<Value = CalendarDate> {
    let months = (i32::from(last.year()) - i32::from(first.year())) * 12 + i32::from(last.month())
        - i32::from(first.month());
    (0..=months, 1_i8..=31).prop_map(move |(offset, day)| {
        let first_of_month = CalendarDate::new(first.year(), first.month(), 1).unwrap();
        shifted(first_of_month, offset, day).clamp(first, last)
    })
}

fn optional<T: std::fmt::Debug + Clone>(
    strategy: impl Strategy<Value = T>,
) -> impl Strategy<Value = Option<T>> {
    prop_oneof![Just(None), strategy.prop_map(Some)]
}

fn placement() -> impl Strategy<Value = Option<&'static str>> {
    optional(prop_oneof![Just("start"), Just("end")])
}

fn timing(as_of: CalendarDate, end: CalendarDate) -> impl Strategy<Value = Value> {
    let around = date_between(shifted(as_of, -6, 1), shifted(end, 6, 1));
    prop_oneof![
        around.prop_map(|on| json!({ "frequency": "oneTime", "on": text(on) })),
        (optional(1_i8..=31), placement()).prop_map(|(day, placement)| {
            let mut timing = json!({ "frequency": "monthly" });
            set(&mut timing, "day", day.map(Value::from));
            set(&mut timing, "placement", placement.map(Value::from));
            timing
        }),
        (1_i8..=12, optional(1_i8..=28), placement()).prop_map(|(month, day, placement)| {
            let mut timing = json!({ "frequency": "annual", "month": month });
            set(&mut timing, "day", day.map(Value::from));
            set(&mut timing, "placement", placement.map(Value::from));
            timing
        }),
    ]
}

fn set(object: &mut Value, key: &str, value: Option<Value>) {
    if let Some(value) = value {
        object[key] = value;
    }
}

fn growth() -> impl Strategy<Value = Value> {
    (
        prop_oneof![
            (Just("percent"), 0.0..10.0_f64),
            (Just("flat"), 0.0..100.0_f64)
        ],
        prop_oneof![Just("annual"), Just("monthly")],
    )
        .prop_map(|((kind, amount), cadence)| {
            json!({ "type": kind, "amount": amount, "cadence": cadence })
        })
}

fn rule(as_of: CalendarDate, end: CalendarDate) -> impl Strategy<Value = Value> {
    let bound = date_between(shifted(as_of, -36, 1), end);
    (
        prop_oneof![
            (Just("flat"), 0.0..2000.0_f64),
            (Just("salaryPercent"), 0.0..15.0_f64)
        ],
        timing(as_of, end),
        optional(bound),
        optional((0..=60_i32, 1_i8..=31)),
        optional(growth()),
        prop_oneof![
            Just("annual"),
            Just("monthly"),
            Just("biweekly"),
            Just("weekly"),
            Just("daily"),
            Just("perContribution")
        ],
        optional(any::<bool>()),
    )
        .prop_map(
            |((kind, amount), timing, start, length, growth, basis, enabled)| {
                let mut rule =
                    json!({ "id": "", "type": kind, "amount": amount, "timing": timing });
                let recurring = rule["timing"]["frequency"] != "oneTime";
                if kind == "salaryPercent" && (recurring || basis != "perContribution") {
                    rule["salaryBasis"] = json!(basis);
                }
                set(&mut rule, "enabled", enabled.map(Value::from));
                if recurring {
                    set(&mut rule, "startDate", start.map(|date| json!(text(date))));
                    if let (Some(start), Some((months, day))) = (start, length) {
                        let end_date = shifted(start, months, day).max(start);
                        rule["endDate"] = json!(text(end_date));
                    }
                    if start.is_some() {
                        set(&mut rule, "growth", growth);
                    }
                }
                rule
            },
        )
}

fn account(today: CalendarDate, end: CalendarDate) -> impl Strategy<Value = Value> {
    (
        (0..=MAX_STALE_MONTHS, 1_i8..=31, any::<bool>()),
        prop_oneof![Just(0.0), 0.0..1e6_f64],
        optional(-0.05..0.15_f64),
        prop::bool::weighted(0.8),
    )
        .prop_flat_map(move |((back, day, fresh), balance, rate, included)| {
            let as_of = if fresh {
                today
            } else {
                shifted(today, -back, day).min(today)
            };
            prop::collection::vec(rule(as_of, end), 0..=MAX_RULES).prop_map(move |rules| {
                let mut account = json!({
                    "id": "",
                    "name": "Account",
                    "kind": "other",
                    "included": included,
                    "balance": balance,
                    "balanceAsOf": text(as_of),
                    "contributions": rules
                });
                set(&mut account, "annualRate", rate.map(Value::from));
                account
            })
        })
}

/// Gives every account and rule an id unique in the file.
fn with_ids(mut accounts: Vec<Value>) -> Vec<Value> {
    for (index, account) in accounts.iter_mut().enumerate() {
        account["id"] = json!(format!("a{index}"));
        if let Some(rules) = account["contributions"].as_array_mut() {
            for (rule_index, rule) in rules.iter_mut().enumerate() {
                rule["id"] = json!(format!("a{index}-r{rule_index}"));
            }
        }
    }
    accounts
}

fn scenario_with(
    accounts: impl Fn(CalendarDate, CalendarDate) -> BoxedStrategy<Vec<Value>> + 'static,
) -> impl Strategy<Value = Case> {
    let today = (2000_i16..=2040, 1_i8..=12, 1_i8..=31).prop_map(|(year, month, day)| {
        CalendarDate::new(year, month, 1)
            .unwrap()
            .with_day_clamped(day)
    });
    (today, 1..=MAX_HORIZON_MONTHS, 1_i8..=31).prop_flat_map(move |(today, months, day)| {
        let end = shifted(today, months, day).max(shifted(today, months, 1));
        (
            accounts(today, end),
            -0.02..0.12_f64,
            optional(0.0..0.03_f64),
            optional(prop_oneof![Just("monthly"), Just("daily")]),
            0.0..300_000.0_f64,
            optional(-0.05..0.1_f64),
            date_between(shifted(today, -36, 1), shifted(today, 36, 1)),
        )
            .prop_map(
                move |(accounts, rate, variance, compounding, base, raise, salary_as_of)| {
                    let mut interest = json!({ "annualRate": rate });
                    set(&mut interest, "variance", variance.map(Value::from));
                    set(&mut interest, "compounding", compounding.map(Value::from));
                    let mut salary = json!({ "annualBase": base, "asOf": text(salary_as_of) });
                    set(&mut salary, "annualRaiseRate", raise.map(Value::from));
                    Case {
                        file: json!({
                            "version": 1,
                            "endDate": text(end),
                            "interest": interest,
                            "salary": salary,
                            "accounts": with_ids(accounts)
                        }),
                        today,
                    }
                },
            )
    })
}

/// A valid scenario of 0 to 4 accounts, stale or not, over up to ten years.
pub(crate) fn any_case() -> impl Strategy<Value = Case> {
    scenario_with(|today, end| prop::collection::vec(account(today, end), 0..=MAX_ACCOUNTS).boxed())
}

/// A valid scenario of `count` accounts whose balances are all dated `today`.
pub(crate) fn fresh_cases(count: RangeInclusive<usize>) -> impl Strategy<Value = Case> {
    scenario_with(move |today, end| {
        prop::collection::vec(account(today, end), count.clone())
            .prop_map(move |accounts| {
                accounts
                    .into_iter()
                    .map(|mut account| {
                        account["balanceAsOf"] = json!(text(today));
                        account
                    })
                    .collect()
            })
            .boxed()
    })
}
