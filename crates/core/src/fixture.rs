use serde_json::{Value, json};

use crate::date::CalendarDate;
use crate::scenario::{Account, Scenario};

pub(crate) fn date(text: &str) -> CalendarDate {
    CalendarDate::parse(text).unwrap()
}

/// A scenario with one account, id `account`, holding `rules`, at a scenario rate of 0 and a
/// salary of 0.
pub(crate) fn scenario(compounding: &str, rules: Value) -> Scenario {
    let file = json!({
        "version": 1,
        "endDate": "2030-01-01",
        "interest": { "annualRate": 0, "compounding": compounding },
        "salary": { "annualBase": 0, "asOf": "2026-01-01" },
        "accounts": [{
            "id": "account",
            "name": "Account",
            "kind": "taxable",
            "included": true,
            "balance": 0,
            "balanceAsOf": "2026-01-01",
            "contributions": rules
        }]
    });
    Scenario::parse(serde_json::from_value(file).unwrap(), date("2026-01-01")).unwrap()
}

pub(crate) fn only_account(scenario: &Scenario) -> &Account {
    let [account] = scenario.accounts() else {
        panic!("expected one account");
    };
    account
}

pub(crate) fn flat(id: &str, amount: f64, timing: Value) -> Value {
    json!({ "id": id, "type": "flat", "amount": amount, "timing": timing })
}

pub(crate) fn one_time(id: &str, amount: f64, on: &str) -> Value {
    flat(id, amount, json!({ "frequency": "oneTime", "on": on }))
}

/// `2^days_in_year - 1`, which rounds to `2^days_in_year`: at it, the daily rate of a year with
/// that many days is exactly 1.
pub(crate) fn doubling_daily_rate(days_in_year: i32) -> f64 {
    2.0_f64.powi(days_in_year) - 1.0
}
