use serde_json::{Value, json};

use crate::date::CalendarDate;
use crate::project::TraceSegment;
use crate::scenario::{Account, Scenario};
use crate::schedule::Bucket;

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

/// A scenario of several accounts, at a scenario rate of 0, no variance, monthly compounding and
/// a salary of 0 unless set.
pub(crate) struct Setup {
    pub(crate) today: &'static str,
    pub(crate) end_date: &'static str,
    pub(crate) compounding: &'static str,
    pub(crate) annual_rate: f64,
    pub(crate) variance: f64,
    pub(crate) salary: Option<Value>,
    pub(crate) accounts: Vec<Value>,
}

impl Setup {
    pub(crate) fn new(today: &'static str, end_date: &'static str, accounts: Vec<Value>) -> Self {
        Self {
            today,
            end_date,
            compounding: "monthly",
            annual_rate: 0.0,
            variance: 0.0,
            salary: None,
            accounts,
        }
    }

    pub(crate) fn scenario(&self) -> Scenario {
        let accounts: Vec<Value> = self
            .accounts
            .iter()
            .map(|fields| {
                let mut account = json!({
                    "name": fields["id"],
                    "kind": "other",
                    "included": true,
                    "balance": 0,
                    "balanceAsOf": self.today,
                    "contributions": []
                });
                for (key, value) in fields.as_object().unwrap() {
                    account[key] = value.clone();
                }
                account
            })
            .collect();
        let file = json!({
            "version": 1,
            "endDate": self.end_date,
            "interest": {
                "annualRate": self.annual_rate,
                "variance": self.variance,
                "compounding": self.compounding
            },
            "salary": self.salary.clone().unwrap_or(json!({ "annualBase": 0, "asOf": self.today })),
            "accounts": accounts
        });
        Scenario::parse(serde_json::from_value(file).unwrap(), date(self.today)).unwrap()
    }
}

pub(crate) fn monthly(id: &str, amount: f64) -> Value {
    flat(
        id,
        amount,
        json!({ "frequency": "monthly", "placement": "start" }),
    )
}

pub(crate) fn monthly_end(id: &str, amount: f64) -> Value {
    flat(
        id,
        amount,
        json!({ "frequency": "monthly", "placement": "end" }),
    )
}

/// A trace segment with its dates and rule ids as text, for comparing with literal values.
#[derive(Debug, PartialEq)]
pub(crate) struct Segment {
    pub(crate) from: String,
    pub(crate) to: String,
    pub(crate) days: i8,
    pub(crate) days_in_month: i8,
    pub(crate) days_in_year: i16,
    pub(crate) balance_start: f64,
    pub(crate) balance_end: f64,
    pub(crate) contributions: f64,
    pub(crate) interest: f64,
    pub(crate) annual_rate: f64,
    pub(crate) deposits: Vec<TracedDeposit>,
}

/// `(rule_id, date, amount, bucket)`.
pub(crate) type TracedDeposit = (String, String, f64, Bucket);

impl From<&TraceSegment<'_>> for Segment {
    fn from(segment: &TraceSegment<'_>) -> Self {
        Self {
            from: segment.from().to_string(),
            to: segment.to().to_string(),
            days: segment.days(),
            days_in_month: segment.days_in_month(),
            days_in_year: segment.days_in_year(),
            balance_start: segment.balance_start(),
            balance_end: segment.balance_end(),
            contributions: segment.contributions(),
            interest: segment.interest(),
            annual_rate: segment.annual_rate(),
            deposits: segment
                .deposits()
                .iter()
                .map(|deposit| {
                    (
                        deposit.rule_id().to_string(),
                        deposit.date().to_string(),
                        deposit.amount(),
                        deposit.bucket(),
                    )
                })
                .collect(),
        }
    }
}

pub(crate) fn segments(trace: &[TraceSegment<'_>]) -> Vec<Segment> {
    trace.iter().map(Segment::from).collect()
}

pub(crate) fn traced_deposit(
    rule_id: &str,
    on: &str,
    amount: f64,
    bucket: Bucket,
) -> TracedDeposit {
    (rule_id.to_owned(), on.to_owned(), amount, bucket)
}
