use serde::Deserialize;
use serde::de::IntoDeserializer;
use serde::de::value::Error as ValueError;
use serde_json::{Value, json};

use super::raw::{Finite, ScenarioFile, Version, VersionFile};
use super::{
    AccountKind, Compounding, ContributionType, GrowthCadence, GrowthKind, Placement, SalaryBasis,
    Scenario, ScenarioError, Timing,
};
use crate::date::CalendarDate;

const TODAY: &str = "2026-03-01";

fn valid_file() -> Value {
    json!({
        "version": 1,
        "endDate": "2036-01-01",
        "interest": { "annualRate": 0.06, "variance": 0.02 },
        "salary": { "annualBase": 120_000, "annualRaiseRate": 0.03, "asOf": "2026-01-01" },
        "accounts": [
            {
                "id": "k401",
                "name": "401k",
                "kind": "pretax",
                "included": true,
                "balance": 50_000,
                "balanceAsOf": "2026-02-15",
                "contributions": [
                    {
                        "id": "deferral",
                        "type": "salaryPercent",
                        "amount": 8,
                        "salaryBasis": "perContribution",
                        "timing": { "frequency": "monthly", "day": 15 }
                    },
                    {
                        "id": "bonus",
                        "type": "flat",
                        "amount": 5000,
                        "growth": { "type": "percent", "amount": 2, "cadence": "annual" },
                        "timing": { "frequency": "annual", "month": 2, "day": 29, "placement": "end" },
                        "startDate": "2026-01-01",
                        "endDate": "2030-12-31"
                    }
                ]
            },
            {
                "id": "roth",
                "name": "Roth IRA",
                "kind": "roth",
                "included": false,
                "balance": 0,
                "balanceAsOf": TODAY,
                "annualRate": 0.07,
                "contributions": [
                    {
                        "id": "gift",
                        "name": "Gift",
                        "enabled": false,
                        "type": "flat",
                        "amount": 1000,
                        "timing": { "frequency": "oneTime", "on": "2027-06-30" }
                    }
                ]
            }
        ]
    })
}

fn date(text: &str) -> CalendarDate {
    CalendarDate::parse(text).unwrap()
}

fn read(file: Value) -> Result<ScenarioFile, serde_json::Error> {
    serde_json::from_value(file)
}

fn edited(edit: impl FnOnce(&mut Value)) -> ScenarioFile {
    let mut file = valid_file();
    edit(&mut file);
    read(file).unwrap()
}

fn parse(raw: ScenarioFile) -> Result<Scenario, ScenarioError> {
    Scenario::parse(raw, date(TODAY))
}

fn remove(object: &mut Value, key: &str) {
    object.as_object_mut().unwrap().remove(key);
}

#[derive(Debug, PartialEq)]
struct Reported<'a> {
    code: &'a str,
    account: Option<&'a str>,
    rule: Option<&'a str>,
}

fn reported(error: &ScenarioError) -> Reported<'_> {
    Reported {
        code: error.code(),
        account: error.account_id().map(super::AccountId::as_str),
        rule: error.rule_id().map(super::RuleId::as_str),
    }
}

fn expect_error(raw: ScenarioFile, code: &str, account: Option<&str>, rule: Option<&str>) {
    let error = parse(raw).unwrap_err();
    assert_eq!(
        reported(&error),
        Reported {
            code,
            account,
            rule
        },
        "{error}"
    );
}

#[test]
fn returns_the_scenario_with_dates_parsed_and_defaults_filled_in() {
    let scenario = parse(read(valid_file()).unwrap()).unwrap();

    assert_eq!(scenario.end_date(), date("2036-01-01"));
    let interest = scenario.interest();
    assert_eq!(
        (
            interest.annual_rate(),
            interest.variance(),
            interest.compounding()
        ),
        (0.06, 0.02, Compounding::Monthly)
    );
    let salary = scenario.salary();
    assert_eq!(
        (
            salary.annual_base(),
            salary.annual_raise_rate(),
            salary.as_of()
        ),
        (120_000.0, 0.03, date("2026-01-01"))
    );

    let [k401, roth] = scenario.accounts() else {
        panic!("expected two accounts");
    };
    assert_eq!(k401.id().as_str(), "k401");
    assert_eq!(k401.name(), "401k");
    assert_eq!(k401.kind(), AccountKind::Pretax);
    assert!(k401.included());
    assert_eq!(k401.balance(), 50_000.0);
    assert_eq!(k401.balance_as_of(), date("2026-02-15"));
    assert_eq!(k401.annual_rate(), None);
    assert_eq!(roth.id().as_str(), "roth");
    assert_eq!(roth.kind(), AccountKind::Roth);
    assert!(!roth.included());
    assert_eq!(roth.annual_rate(), Some(0.07));

    let [deferral, bonus] = k401.contributions() else {
        panic!("expected two rules on k401");
    };
    assert_eq!(deferral.id().as_str(), "deferral");
    assert_eq!(deferral.name(), None);
    assert!(deferral.enabled());
    assert_eq!(
        deferral.contribution_type(),
        ContributionType::SalaryPercent
    );
    assert_eq!(deferral.amount(), 8.0);
    assert_eq!(deferral.salary_basis(), SalaryBasis::PerContribution);
    assert_eq!(deferral.growth(), None);
    let Timing::Monthly(monthly) = deferral.timing() else {
        panic!("expected a monthly rule");
    };
    assert_eq!(
        (monthly.day(), monthly.placement()),
        (Some(15), Placement::Start)
    );
    assert_eq!((deferral.start_date(), deferral.end_date()), (None, None));

    let Timing::Annual(annual) = bonus.timing() else {
        panic!("expected an annual rule");
    };
    assert_eq!(
        (annual.month(), annual.day(), annual.placement()),
        (2, Some(29), Placement::End)
    );
    let growth = bonus.growth().unwrap();
    assert_eq!(
        (
            growth.kind(),
            growth.amount(),
            growth.cadence(),
            growth.start()
        ),
        (
            GrowthKind::Percent,
            2.0,
            GrowthCadence::Annual,
            date("2026-01-01")
        )
    );
    assert_eq!(bonus.start_date(), Some(date("2026-01-01")));
    assert_eq!(bonus.end_date(), Some(date("2030-12-31")));

    let [gift] = roth.contributions() else {
        panic!("expected one rule on roth");
    };
    assert_eq!(gift.id().as_str(), "gift");
    assert_eq!(gift.name(), Some("Gift"));
    assert!(!gift.enabled());
    assert_eq!(gift.contribution_type(), ContributionType::Flat);
    assert_eq!(gift.amount(), 1000.0);
    assert_eq!(gift.salary_basis(), SalaryBasis::Annual);
    assert_eq!(gift.timing(), Timing::OneTime(date("2027-06-30")));
}

#[test]
fn fills_in_a_missing_variance_raise_compounding_and_placement() {
    let scenario = parse(edited(|file| {
        file["interest"] = json!({ "annualRate": 0.05 });
        file["salary"] = json!({ "annualBase": 0, "asOf": TODAY });
        file["accounts"][0]["contributions"][0]["timing"] = json!({ "frequency": "monthly" });
    }))
    .unwrap();

    let interest = scenario.interest();
    assert_eq!(
        (
            interest.annual_rate(),
            interest.variance(),
            interest.compounding()
        ),
        (0.05, 0.0, Compounding::Monthly)
    );
    assert_eq!(scenario.salary().annual_raise_rate(), 0.0);
    let Timing::Monthly(monthly) = scenario.accounts()[0].contributions()[0].timing() else {
        panic!("expected a monthly rule");
    };
    assert_eq!(
        (monthly.day(), monthly.placement()),
        (None, Placement::Start)
    );
}

#[test]
fn unsupported_version() {
    let mut file = valid_file();
    file["version"] = json!(2);
    let version: VersionFile = serde_json::from_value(file.clone()).unwrap();
    assert_eq!(
        version.version.check(),
        Err(ScenarioError::UnsupportedVersion)
    );
    expect_error(read(file).unwrap(), "unsupported_version", None, None);

    let newer: VersionFile =
        serde_json::from_value(json!({ "version": 2, "somethingNew": true })).unwrap();
    assert_eq!(
        newer.version.check(),
        Err(ScenarioError::UnsupportedVersion)
    );
}

#[test]
fn checks_a_version_read_on_its_own() {
    for (version, supported) in [(json!(1), true), (json!(1.0), true), (json!(-3), false)] {
        let file: VersionFile = serde_json::from_value(json!({ "version": version })).unwrap();
        assert_eq!(file.version.check().is_ok(), supported, "{version}");
    }
    for file in [
        json!({}),
        json!({ "version": 1.5 }),
        json!({ "version": "1" }),
        json!({ "version": null }),
    ] {
        assert!(serde_json::from_value::<VersionFile>(file).is_err());
    }
}

#[test]
fn invalid_date() {
    expect_error(
        edited(|file| file["endDate"] = json!("2036-02-30")),
        "invalid_date",
        None,
        None,
    );
    expect_error(
        edited(|file| file["salary"]["asOf"] = json!("2026-01-01T00:00")),
        "invalid_date",
        None,
        None,
    );
    expect_error(
        edited(|file| file["accounts"][0]["balanceAsOf"] = json!("2026-2-01")),
        "invalid_date",
        Some("k401"),
        None,
    );
    expect_error(
        edited(|file| file["accounts"][0]["contributions"][0]["startDate"] = json!("2026-13-01")),
        "invalid_date",
        Some("k401"),
        Some("deferral"),
    );
    expect_error(
        edited(|file| {
            file["accounts"][1]["contributions"][0]["timing"]["on"] = json!("0000-06-30");
        }),
        "invalid_date",
        Some("roth"),
        Some("gift"),
    );
}

#[test]
fn end_not_after_today() {
    expect_error(
        edited(|file| file["endDate"] = json!(TODAY)),
        "end_not_after_today",
        None,
        None,
    );
}

#[test]
fn as_of_in_future() {
    expect_error(
        edited(|file| file["accounts"][0]["balanceAsOf"] = json!("2026-03-02")),
        "as_of_in_future",
        Some("k401"),
        None,
    );
}

#[test]
fn negative_balance() {
    expect_error(
        edited(|file| file["accounts"][0]["balance"] = json!(-0.01)),
        "negative_balance",
        Some("k401"),
        None,
    );
}

#[test]
fn invalid_rate() {
    let mut nan_rate = read(valid_file()).unwrap();
    nan_rate.interest.annual_rate = f64::NAN;
    expect_error(nan_rate, "invalid_rate", None, None);

    let mut infinite_variance = read(valid_file()).unwrap();
    infinite_variance.interest.variance = Some(f64::INFINITY);
    expect_error(infinite_variance, "invalid_rate", None, None);

    let mut infinite_raise = read(valid_file()).unwrap();
    infinite_raise.salary.annual_raise_rate = Some(f64::NEG_INFINITY);
    expect_error(infinite_raise, "invalid_rate", None, None);

    for edit in [
        |file: &mut Value| file["interest"] = json!({ "annualRate": -0.5, "variance": 0.5 }),
        |file: &mut Value| file["interest"]["variance"] = json!(-0.01),
        |file: &mut Value| file["salary"]["annualRaiseRate"] = json!(-1),
        |file: &mut Value| file["salary"]["annualRaiseRate"] = json!(-2),
        |file: &mut Value| file["interest"] = json!({ "annualRate": 1e308, "variance": 1e308 }),
    ] {
        expect_error(edited(edit), "invalid_rate", None, None);
    }

    expect_error(
        edited(|file| file["accounts"][1]["annualRate"] = json!(-0.99)),
        "invalid_rate",
        Some("roth"),
        None,
    );
    expect_error(
        edited(|file| {
            file["interest"] = json!({ "annualRate": 1e308, "variance": 7e307 });
            file["accounts"][1]["annualRate"] = json!(1.5e308);
        }),
        "invalid_rate",
        Some("roth"),
        None,
    );
}

#[test]
fn accepts_a_raise_just_above_minus_one() {
    let scenario = parse(edited(|file| {
        file["salary"]["annualRaiseRate"] = json!(-0.99);
    }))
    .unwrap();

    assert_eq!(scenario.salary().annual_raise_rate(), -0.99);
}

#[test]
fn negative_amount() {
    expect_error(
        edited(|file| file["accounts"][0]["contributions"][0]["amount"] = json!(-1)),
        "negative_amount",
        Some("k401"),
        Some("deferral"),
    );
    expect_error(
        edited(|file| {
            file["accounts"][0]["contributions"][1]["growth"] =
                json!({ "type": "flat", "amount": -5, "cadence": "monthly" });
        }),
        "negative_amount",
        Some("k401"),
        Some("bonus"),
    );
    expect_error(
        edited(|file| file["salary"]["annualBase"] = json!(-1)),
        "negative_amount",
        None,
        None,
    );
}

#[test]
fn duplicate_id() {
    expect_error(
        edited(|file| file["accounts"][1]["id"] = json!("k401")),
        "duplicate_id",
        Some("k401"),
        None,
    );
    expect_error(
        edited(|file| file["accounts"][1]["contributions"][0]["id"] = json!("deferral")),
        "duplicate_id",
        Some("roth"),
        Some("deferral"),
    );
    expect_error(
        edited(|file| file["accounts"][0]["contributions"][1]["id"] = json!("deferral")),
        "duplicate_id",
        Some("k401"),
        Some("deferral"),
    );
}

#[test]
fn invalid_day() {
    for timing in [
        json!({ "frequency": "monthly", "day": 0 }),
        json!({ "frequency": "monthly", "day": 32 }),
        json!({ "frequency": "monthly", "day": 1.5 }),
        json!({ "frequency": "monthly", "day": -1 }),
        json!({ "frequency": "annual", "month": 0 }),
        json!({ "frequency": "annual", "month": 13 }),
        json!({ "frequency": "annual", "month": 2, "day": 30 }),
        json!({ "frequency": "annual", "month": 4, "day": 31 }),
    ] {
        expect_error(
            edited(|file| file["accounts"][0]["contributions"][0]["timing"] = timing),
            "invalid_day",
            Some("k401"),
            Some("deferral"),
        );
    }
}

#[test]
fn growth_without_start() {
    expect_error(
        edited(|file| remove(&mut file["accounts"][0]["contributions"][1], "startDate")),
        "growth_without_start",
        Some("k401"),
        Some("bonus"),
    );
}

#[test]
fn growth_on_one_time() {
    expect_error(
        edited(|file| {
            file["accounts"][1]["contributions"][0]["growth"] =
                json!({ "type": "percent", "amount": 1, "cadence": "annual" });
        }),
        "growth_on_one_time",
        Some("roth"),
        Some("gift"),
    );
}

#[test]
fn rule_end_before_start() {
    expect_error(
        edited(|file| {
            let rule = &mut file["accounts"][0]["contributions"][0];
            rule["startDate"] = json!("2027-01-02");
            rule["endDate"] = json!("2027-01-01");
        }),
        "rule_end_before_start",
        Some("k401"),
        Some("deferral"),
    );
}

#[test]
fn per_contribution_on_one_time() {
    expect_error(
        edited(|file| {
            let gift = &mut file["accounts"][1]["contributions"][0];
            gift["type"] = json!("salaryPercent");
            gift["salaryBasis"] = json!("perContribution");
        }),
        "per_contribution_on_one_time",
        Some("roth"),
        Some("gift"),
    );
}

#[test]
fn refuses_to_deserialise_a_file_of_the_wrong_shape() {
    let edits: [fn(&mut Value); 15] = [
        |file| file["extra"] = json!(1),
        |file| file["accounts"][0]["contributions"][0]["timing"]["weekday"] = json!(3),
        |file| file["accounts"][1]["contributions"][0]["startDate"] = json!("2027-01-01"),
        |file| file["accounts"][1]["contributions"][0]["endDate"] = json!("2027-01-01"),
        |file| {
            file["accounts"][1]["contributions"][0]["timing"] =
                json!({ "frequency": "monthly", "month": 2 });
        },
        |file| {
            file["accounts"][1]["contributions"][0]["timing"] =
                json!({ "frequency": "oneTime", "on": TODAY, "day": 3 });
        },
        |file| remove(&mut file["accounts"][0]["contributions"][0], "amount"),
        |file| file["accounts"][0]["contributions"][0]["timing"]["day"] = json!("15"),
        |file| file["accounts"][0]["extra"] = json!(1),
        |file| file["accounts"][0]["contributions"][0]["extra"] = json!(1),
        |file| file["accounts"][0]["contributions"][0]["id"] = json!(7),
        |file| file["accounts"].as_array_mut().unwrap().push(Value::Null),
        |file| file["interest"]["variance"] = Value::Null,
        |file| file["accounts"][0]["kind"] = json!("brokerage"),
        |file| remove(file, "version"),
    ];
    for (index, edit) in edits.into_iter().enumerate() {
        let mut file = valid_file();
        edit(&mut file);
        assert!(read(file).is_err(), "edit {index} deserialised");
    }
    assert!(read(json!([])).is_err());
}

#[test]
fn refuses_to_deserialise_a_number_that_is_not_finite() {
    for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let finite = Finite::deserialize(IntoDeserializer::<ValueError>::into_deserializer(value));
        let version =
            Version::deserialize(IntoDeserializer::<ValueError>::into_deserializer(value));
        assert!(finite.is_err() && version.is_err(), "{value}");
    }
}
