use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde::Deserialize;
use serde::de::{self, MapAccess, SeqAccess, Visitor};
use serde_json::{Value, json};

type TestResult<T = ()> = Result<T, Box<dyn Error>>;

const TODAY: &str = "2026-06-15";
const EXAMPLES: [&str; 5] = [
    "basic.json",
    "custom-growth.json",
    "daily.json",
    "one-time.json",
    "stale-and-excluded.json",
];

fn example(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/cli/examples")
        .join(name)
}

fn calc(args: &[&str]) -> TestResult<Output> {
    Ok(Command::new(env!("CARGO_BIN_EXE_retirement-calc"))
        .args(args)
        .output()?)
}

fn calc_on(path: &Path, extra: &[&str]) -> TestResult<Output> {
    let mut args = vec![
        "--scenario",
        path.to_str().ok_or("a path that is not UTF-8")?,
    ];
    args.extend_from_slice(extra);
    calc(&args)
}

/// Writes `text` to a temporary file whose name holds `name` and returns its path.
fn file_with(name: &str, text: &str) -> TestResult<PathBuf> {
    let path = std::env::temp_dir().join(format!(
        "retirement-calc-{}-{name}.json",
        std::process::id()
    ));
    std::fs::write(&path, text)?;
    Ok(path)
}

/// `basic.json` with one edit, as a file.
fn edited(name: &str, edit: impl FnOnce(&mut Value)) -> TestResult<PathBuf> {
    let mut file: Value = serde_json::from_str(&std::fs::read_to_string(example("basic.json"))?)?;
    edit(&mut file);
    file_with(name, &file.to_string())
}

fn stdout_json(output: &Output) -> TestResult<Value> {
    Ok(serde_json::from_slice(&output.stdout)?)
}

/// JSON with each object's keys in the order they were printed.
enum Ordered {
    Object(Vec<(String, Ordered)>),
    Array(Vec<Ordered>),
    Scalar,
}

impl Ordered {
    fn read(output: &Output) -> TestResult<Self> {
        Ok(serde_json::from_slice(&output.stdout)?)
    }

    fn get(&self, key: &str) -> &Self {
        match self {
            Self::Object(entries) => entries
                .iter()
                .find(|(name, _)| name == key)
                .map_or(&Self::Scalar, |(_, value)| value),
            Self::Array(_) | Self::Scalar => &Self::Scalar,
        }
    }

    fn at(&self, index: usize) -> &Self {
        match self {
            Self::Array(items) => items.get(index).unwrap_or(&Self::Scalar),
            Self::Object(_) | Self::Scalar => &Self::Scalar,
        }
    }

    fn keys(&self) -> Vec<&str> {
        match self {
            Self::Object(entries) => entries.iter().map(|(name, _)| name.as_str()).collect(),
            Self::Array(_) | Self::Scalar => Vec::new(),
        }
    }
}

impl<'de> Deserialize<'de> for Ordered {
    fn deserialize<D: de::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(OrderedVisitor)
    }
}

struct OrderedVisitor;

impl<'de> Visitor<'de> for OrderedVisitor {
    type Value = Ordered;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("JSON")
    }

    fn visit_bool<E>(self, _: bool) -> Result<Ordered, E> {
        Ok(Ordered::Scalar)
    }

    fn visit_i64<E>(self, _: i64) -> Result<Ordered, E> {
        Ok(Ordered::Scalar)
    }

    fn visit_u64<E>(self, _: u64) -> Result<Ordered, E> {
        Ok(Ordered::Scalar)
    }

    fn visit_f64<E>(self, _: f64) -> Result<Ordered, E> {
        Ok(Ordered::Scalar)
    }

    fn visit_str<E>(self, _: &str) -> Result<Ordered, E> {
        Ok(Ordered::Scalar)
    }

    fn visit_unit<E>(self) -> Result<Ordered, E> {
        Ok(Ordered::Scalar)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Ordered, A::Error> {
        let mut items = Vec::new();
        while let Some(item) = seq.next_element()? {
            items.push(item);
        }
        Ok(Ordered::Array(items))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Ordered, A::Error> {
        let mut entries = Vec::new();
        while let Some(entry) = map.next_entry()? {
            entries.push(entry);
        }
        Ok(Ordered::Object(entries))
    }
}

fn assert_usage_failure(output: &Output, context: &str) {
    assert_eq!(output.status.code(), Some(1), "{context}");
    assert!(output.stdout.is_empty(), "{context}");
    assert!(!output.stderr.is_empty(), "{context}");
}

fn assert_scenario_error(output: &Output, error: &Value, context: &str) -> TestResult {
    assert_eq!(output.status.code(), Some(2), "{context}");
    assert_eq!(stdout_json(output)?, json!({ "error": error }), "{context}");
    assert!(!output.stderr.is_empty(), "{context}");
    Ok(())
}

#[test]
fn projects_each_example_with_the_keys_in_the_typescript_order() -> TestResult {
    for name in EXAMPLES {
        let output = calc_on(&example(name), &["--today", TODAY])?;
        let projection = Ordered::read(&output)?;
        let baseline = projection.get("bands").get("baseline");
        let account = baseline.get("accounts").at(0);

        assert_eq!(output.status.code(), Some(0), "{name}");
        assert!(output.stderr.is_empty(), "{name}");
        assert_eq!(stdout_json(&output)?["today"], TODAY, "{name}");
        assert_eq!(
            projection.keys(),
            [
                "today",
                "endDate",
                "effectiveRate",
                "staleAccounts",
                "salaryByYear",
                "bands"
            ],
            "{name}"
        );
        assert_eq!(
            projection.get("salaryByYear").at(0).keys(),
            ["year", "salary"]
        );
        assert_eq!(
            projection.get("bands").keys(),
            ["baseline", "positive", "negative"]
        );
        assert_eq!(baseline.keys(), ["total", "accounts"]);
        assert_eq!(
            baseline.get("total").keys(),
            [
                "startBalance",
                "finalBalance",
                "totalContributions",
                "totalInterest",
                "monthly",
                "yearly"
            ]
        );
        assert_eq!(
            baseline.get("total").get("monthly").at(0).keys(),
            ["year", "month", "balance", "contributions", "interest"]
        );
        assert_eq!(
            baseline.get("total").get("yearly").at(0).keys(),
            [
                "year",
                "balance",
                "contributions",
                "interest",
                "weightedRate"
            ]
        );
        assert_eq!(
            account.keys(),
            [
                "accountId",
                "included",
                "annualRate",
                "rolledForward",
                "series"
            ]
        );
        assert_eq!(
            account.get("rolledForward").keys(),
            ["contributions", "interest"]
        );
        for row in [
            account.get("series").get("yearly").at(0),
            projection
                .get("bands")
                .get("positive")
                .get("total")
                .get("yearly")
                .at(0),
        ] {
            assert_eq!(row.keys(), ["year", "balance", "contributions", "interest"]);
        }
    }
    Ok(())
}

#[test]
fn lists_stale_accounts_with_their_id_and_date() -> TestResult {
    let output = calc_on(&example("stale-and-excluded.json"), &["--today", TODAY])?;

    assert_eq!(
        Ordered::read(&output)?.get("staleAccounts").at(0).keys(),
        ["accountId", "balanceAsOf"]
    );
    assert_eq!(
        stdout_json(&output)?["staleAccounts"],
        json!([{ "accountId": "401k", "balanceAsOf": "2026-03-31" }])
    );
    Ok(())
}

#[test]
fn prints_two_space_indented_json_with_a_trailing_newline() -> TestResult {
    let output = calc_on(&example("basic.json"), &["--today", TODAY])?;
    let text = String::from_utf8(output.stdout)?;

    assert!(text.starts_with("{\n  \"today\": \"2026-06-15\",\n  \"endDate\""));
    assert!(text.ends_with("}\n") && !text.ends_with("\n\n"));
    Ok(())
}

#[test]
fn prints_the_same_bytes_on_every_run() -> TestResult {
    for extra in [
        vec!["--today", TODAY],
        vec!["--today", TODAY, "--trace", "401k"],
    ] {
        let first = calc_on(&example("basic.json"), &extra)?;
        let second = calc_on(&example("basic.json"), &extra)?;

        assert_eq!(first.status.code(), Some(0), "{extra:?}");
        assert_eq!(first.stdout, second.stdout, "{extra:?}");
    }
    Ok(())
}

#[test]
fn defaults_today_to_a_date_in_the_file_grammar() -> TestResult {
    let output = calc_on(&example("basic.json"), &[])?;
    let projection = stdout_json(&output)?;
    let today = projection["today"].as_str().ok_or("no today")?;

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(today.len(), 10);
    assert!(today.bytes().enumerate().all(|(index, byte)| match index {
        4 | 7 => byte == b'-',
        _ => byte.is_ascii_digit(),
    }));
    Ok(())
}

#[test]
fn traces_a_known_account_in_each_band_as_an_array_of_segments() -> TestResult {
    for band in [None, Some("baseline"), Some("positive"), Some("negative")] {
        let mut extra = vec!["--today", TODAY, "--trace", "401k"];
        extra.extend(band.iter().flat_map(|&band| ["--band", band]));
        let output = calc_on(&example("basic.json"), &extra)?;
        let trace = Ordered::read(&output)?;

        assert_eq!(output.status.code(), Some(0), "{band:?}");
        assert!(
            matches!(&trace, Ordered::Array(segments) if !segments.is_empty()),
            "{band:?}"
        );
        assert_eq!(
            trace.at(0).keys(),
            [
                "from",
                "to",
                "days",
                "daysInMonth",
                "daysInYear",
                "balanceStart",
                "balanceEnd",
                "contributions",
                "interest",
                "annualRate",
                "deposits"
            ]
        );
        assert_eq!(
            trace.at(0).get("deposits").at(0).keys(),
            ["ruleId", "date", "amount", "bucket"]
        );
    }
    Ok(())
}

#[test]
fn ends_the_trace_on_the_account_series_final_balance_in_each_band() -> TestResult {
    let path = example("stale-and-excluded.json");
    let projection = stdout_json(&calc_on(&path, &["--today", TODAY])?)?;

    for band in ["baseline", "positive", "negative"] {
        let trace = stdout_json(&calc_on(
            &path,
            &["--today", TODAY, "--trace", "401k", "--band", band],
        )?)?;
        let account = &projection["bands"][band]["accounts"][0];
        let last = trace.as_array().and_then(|segments| segments.last());

        assert_eq!(account["accountId"], "401k");
        assert_eq!(
            last.map(|segment| &segment["balanceEnd"]),
            Some(&account["series"]["finalBalance"]),
            "{band}"
        );
    }
    Ok(())
}

#[test]
fn prints_buckets_as_start_end_or_a_day_number() -> TestResult {
    let path = edited("buckets", |file| {
        file["interest"]["compounding"] = json!("daily");
        file["accounts"][0]["contributions"] = json!([
            { "id": "first", "type": "flat", "amount": 1, "timing": { "frequency": "monthly" } },
            {
                "id": "last", "type": "flat", "amount": 2,
                "timing": { "frequency": "monthly", "placement": "end" }
            },
            {
                "id": "tenth", "type": "flat", "amount": 3,
                "timing": { "frequency": "monthly", "day": 10 }
            }
        ]);
    })?;
    let trace = stdout_json(&calc_on(
        &path,
        &["--today", "2026-07-01", "--trace", "401k"],
    )?)?;

    assert_eq!(trace[6]["from"], "2026-07-01");
    assert_eq!(
        trace[6]["deposits"],
        json!([
            { "ruleId": "first", "date": "2026-07-01", "amount": 1.0, "bucket": "start" },
            { "ruleId": "last", "date": "2026-07-31", "amount": 2.0, "bucket": "end" },
            { "ruleId": "tenth", "date": "2026-07-10", "amount": 3.0, "bucket": 10 }
        ])
    );
    Ok(())
}

#[test]
fn prints_a_null_weighted_rate_where_the_total_balance_is_0() -> TestResult {
    let path = file_with(
        "zero",
        &json!({
            "version": 1,
            "endDate": "2028-01-01",
            "interest": { "annualRate": 0.05 },
            "salary": { "annualBase": 0, "asOf": "2026-01-01" },
            "accounts": [{
                "id": "empty", "name": "Empty", "kind": "other", "included": true,
                "balance": 0, "balanceAsOf": TODAY,
                "contributions": [{
                    "id": "once", "type": "flat", "amount": 100,
                    "timing": { "frequency": "oneTime", "on": "2027-03-01" }
                }]
            }]
        })
        .to_string(),
    )?;
    let projection = stdout_json(&calc_on(&path, &["--today", TODAY])?)?;
    let yearly = &projection["bands"]["baseline"]["total"]["yearly"];

    assert_eq!(
        yearly[0],
        json!({
            "year": 2026, "balance": 0.0, "contributions": 0.0, "interest": 0.0,
            "weightedRate": null
        })
    );
    assert_eq!(yearly[1]["weightedRate"], 0.05);
    Ok(())
}

#[test]
fn exits_1_with_nothing_on_stdout_for_bad_usage_an_unreadable_file_or_text_that_is_not_json()
-> TestResult {
    let basic = example("basic.json");
    let not_json = file_with("not-json", "{\"version\": 1,")?;
    let empty = file_with("empty", "")?;
    let missing = std::env::temp_dir().join("retirement-calc-no-such-file.json");
    let [basic, not_json, empty, missing] = [&basic, &not_json, &empty, &missing]
        .map(|path| path.to_str().ok_or("a path that is not UTF-8"));
    let (basic, not_json, empty, missing) = (basic?, not_json?, empty?, missing?);

    for args in [
        vec![],
        vec!["--today", TODAY],
        vec!["--scenario", basic, "--band", "positive"],
        vec!["--scenario", basic, "--trace", "401k", "--band", "sideways"],
        vec!["--scenario", basic, "--bogus"],
        vec!["--scenario", basic, "-h"],
        vec!["-h"],
        vec!["--scenario", basic, "extra"],
        vec!["--scenario", missing],
        vec!["--scenario", not_json],
        vec!["--scenario", empty],
    ] {
        assert_usage_failure(&calc(&args)?, &format!("{args:?}"));
    }
    Ok(())
}

#[test]
fn prints_help_on_stdout_and_exits_0() -> TestResult {
    let output = calc(&["--help"])?;
    let help = String::from_utf8(output.stdout)?;

    assert_eq!(output.status.code(), Some(0));
    for flag in ["--scenario", "--today", "--trace", "--band"] {
        assert!(help.contains(flag), "{flag}");
    }
    Ok(())
}

#[test]
fn exits_2_with_the_error_object_for_an_invalid_scenario() -> TestResult {
    let cases = [
        (
            "as_of_in_future",
            edited("as-of", |file| {
                file["accounts"][1]["balanceAsOf"] = json!("2026-06-16");
            })?,
            vec![],
            json!({ "code": "as_of_in_future", "accountId": "roth" }),
        ),
        (
            "invalid_day with a rule id",
            edited("day", |file| {
                file["accounts"][1]["contributions"][0]["timing"]["day"] = json!(32);
            })?,
            vec![],
            json!({ "code": "invalid_day", "accountId": "roth", "ruleId": "roth-monthly" }),
        ),
        (
            "unknown_account",
            example("basic.json"),
            vec!["--trace", "missing"],
            json!({ "code": "unknown_account", "accountId": "missing" }),
        ),
        (
            "unsupported_version",
            edited("version", |file| file["version"] = json!(2))?,
            vec![],
            json!({ "code": "unsupported_version" }),
        ),
        (
            "unsupported_version before the rest of the shape",
            file_with("version-shape", r#"{ "version": 2, "accounts": "none" }"#)?,
            vec![],
            json!({ "code": "unsupported_version" }),
        ),
        (
            "invalid_field for a fractional version",
            edited("version-fraction", |file| file["version"] = json!(1.5))?,
            vec![],
            json!({ "code": "invalid_field" }),
        ),
        (
            "invalid_field for an unknown key",
            edited("unknown-key", |file| {
                file["accounts"][0]["colour"] = json!("red");
            })?,
            vec![],
            json!({ "code": "invalid_field" }),
        ),
        (
            "invalid_field for a wrong type",
            edited("wrong-type", |file| {
                file["accounts"][0]["balance"] = json!("60000");
            })?,
            vec![],
            json!({ "code": "invalid_field" }),
        ),
        (
            "invalid_field for a missing field",
            edited("missing-field", |file| {
                if let Some(account) = file["accounts"][0].as_object_mut() {
                    account.remove("kind");
                }
            })?,
            vec![],
            json!({ "code": "invalid_field" }),
        ),
        (
            "invalid_field for a null optional",
            edited("null-optional", |file| {
                file["interest"]["variance"] = Value::Null;
            })?,
            vec![],
            json!({ "code": "invalid_field" }),
        ),
        (
            "invalid_field for JSON that is not an object",
            file_with("array", "[1]")?,
            vec![],
            json!({ "code": "invalid_field" }),
        ),
        (
            "not_finite",
            edited("overflow", |file| {
                file["accounts"][0]["annualRate"] = json!(1e300);
            })?,
            vec![],
            json!({ "code": "not_finite", "accountId": "401k" }),
        ),
    ];

    for (case, path, extra, error) in cases {
        let mut args = vec!["--today", TODAY];
        args.extend(extra);
        assert_scenario_error(&calc_on(&path, &args)?, &error, case)?;
    }
    Ok(())
}

#[test]
fn exits_2_with_not_finite_for_the_account_whose_cumulative_interest_alone_overflows() -> TestResult
{
    let scenario = json!({
        "version": 1,
        "endDate": "2026-11-01",
        "interest": { "annualRate": 0 },
        "salary": { "annualBase": 0, "asOf": "2026-01-01" },
        "accounts": [{
            "id": "shrinking",
            "name": "Shrinking",
            "kind": "other",
            "included": true,
            "balance": 1e308,
            "balanceAsOf": "2026-01-01",
            "annualRate": -0.999_999_999_999_999_9,
            "contributions": [{
                "id": "end",
                "type": "flat",
                "amount": 1e307,
                "timing": { "frequency": "monthly", "placement": "end" }
            }]
        }]
    });
    let path = file_with("interest-overflow", &scenario.to_string())?;

    for extra in [vec![], vec!["--trace", "shrinking"]] {
        let mut args = vec!["--today", "2026-01-01"];
        args.extend(&extra);
        assert_scenario_error(
            &calc_on(&path, &args)?,
            &json!({ "code": "not_finite", "accountId": "shrinking" }),
            &format!("{extra:?}"),
        )?;
    }
    Ok(())
}

#[test]
fn exits_2_with_invalid_field_for_an_array_in_place_of_an_object() -> TestResult {
    let cases = [
        (
            "interest",
            r#"{"version":1,"endDate":"2027-01-01","interest":[0],"salary":{"annualBase":0,"asOf":"2026-01-01"},"accounts":[]}"#,
        ),
        ("root with an unsupported version", "[2]"),
    ];

    for (case, text) in cases {
        assert_scenario_error(
            &calc_on(&file_with(case, text)?, &["--today", "2026-01-01"])?,
            &json!({ "code": "invalid_field" }),
            case,
        )?;
    }
    Ok(())
}

#[test]
fn reports_a_today_outside_the_file_grammar_as_invalid_date() -> TestResult {
    for today in [
        "2026-02-30",
        "2026-6-15",
        "0000-01-01",
        "2026-06-15T00:00",
        "today",
    ] {
        assert_scenario_error(
            &calc_on(&example("basic.json"), &["--today", today])?,
            &json!({ "code": "invalid_date" }),
            today,
        )?;
    }
    Ok(())
}
