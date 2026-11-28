//! Runs every case in `crates/core/tests/golden/` through `retirement-calc` and compares what it
//! prints with the expected files, by the parity harness's rule from spec 4 part F.

use std::error::Error;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;
use serde::de::{self, MapAccess, SeqAccess, Visitor};

type TestResult<T = ()> = Result<T, Box<dyn Error>>;

/// Two numbers agree when `|a - b| <= TOLERANCE * max(1, |a|, |b|)`.
const TOLERANCE: f64 = 1e-9;

/// Every group of golden cases and how many cases it holds.
const GROUPS: [(&str, usize); 4] = [
    ("examples", 5),
    ("generated", 200),
    ("hand-computed", 7),
    ("regressions", 11),
];

const TOTAL_CASES: usize = 223;

const INPUT_FILES: [&str; 2] = ["scenario.json", "today"];
const PROJECTION_FILE: &str = "projection.json";
const TRACE_FILES: [&str; 2] = ["trace", "trace.json"];

fn golden_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/tests/golden")
}

/// The case folders of `group`, sorted by name.
fn cases_in(group: &str) -> TestResult<Vec<PathBuf>> {
    let mut cases = fs::read_dir(golden_dir().join(group))?
        .map(|entry| Ok(entry?.path()))
        .collect::<TestResult<Vec<_>>>()?;
    cases.sort();
    Ok(cases)
}

fn names_in(dir: &Path) -> TestResult<Vec<String>> {
    let mut names = fs::read_dir(dir)?
        .map(|entry| {
            entry?.file_name().into_string().map_err(|name| {
                format!("{} holds a name that is not UTF-8: {name:?}", dir.display()).into()
            })
        })
        .collect::<TestResult<Vec<_>>>()?;
    names.sort();
    Ok(names)
}

/// One line of a text file, without its newline.
fn read_line(path: &Path) -> TestResult<String> {
    let text = fs::read_to_string(path)?;
    let line = text
        .strip_suffix('\n')
        .ok_or_else(|| format!("{} does not end in a newline", path.display()))?;
    Ok(line.to_owned())
}

/// Parsed JSON with each object's keys in the order they were printed.
#[derive(Debug, PartialEq)]
enum Node {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Node>),
    Object(Vec<(String, Node)>),
}

impl Node {
    fn parse(text: &[u8]) -> TestResult<Self> {
        Ok(serde_json::from_slice(text)?)
    }

    fn kind(&self) -> &'static str {
        match self {
            Self::Null => "null",
            Self::Bool(_) => "boolean",
            Self::Number(_) => "number",
            Self::String(_) => "string",
            Self::Array(_) => "array",
            Self::Object(_) => "object",
        }
    }

    fn member(&self, key: &str) -> Option<&Self> {
        match self {
            Self::Object(entries) => entries
                .iter()
                .find(|(name, _)| name == key)
                .map(|(_, value)| value),
            _ => None,
        }
    }

    fn string(&self) -> Option<&str> {
        match self {
            Self::String(text) => Some(text),
            _ => None,
        }
    }
}

impl<'de> Deserialize<'de> for Node {
    fn deserialize<D: de::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(NodeVisitor)
    }
}

struct NodeVisitor;

impl<'de> Visitor<'de> for NodeVisitor {
    type Value = Node;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("JSON")
    }

    fn visit_bool<E>(self, value: bool) -> Result<Node, E> {
        Ok(Node::Bool(value))
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> Result<Node, E> {
        let number = i32::try_from(value).map_err(E::custom)?;
        Ok(Node::Number(f64::from(number)))
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> Result<Node, E> {
        let number = u32::try_from(value).map_err(E::custom)?;
        Ok(Node::Number(f64::from(number)))
    }

    fn visit_f64<E>(self, value: f64) -> Result<Node, E> {
        Ok(Node::Number(value))
    }

    fn visit_str<E>(self, value: &str) -> Result<Node, E> {
        Ok(Node::String(value.to_owned()))
    }

    fn visit_unit<E>(self) -> Result<Node, E> {
        Ok(Node::Null)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Node, A::Error> {
        let mut items = Vec::new();
        while let Some(item) = seq.next_element()? {
            items.push(item);
        }
        Ok(Node::Array(items))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Node, A::Error> {
        let mut entries = Vec::new();
        while let Some(entry) = map.next_entry()? {
            entries.push(entry);
        }
        Ok(Node::Object(entries))
    }
}

fn numbers_agree(expected: f64, actual: f64) -> bool {
    (expected - actual).abs() <= TOLERANCE * 1.0_f64.max(expected.abs()).max(actual.abs())
}

/// The first place two documents disagree: keys and their order, array lengths, strings,
/// booleans and nulls must be identical, and numbers must agree within the tolerance.
fn first_difference(expected: &Node, actual: &Node, path: &str) -> Option<String> {
    match (expected, actual) {
        (Node::Number(a), Node::Number(b)) => {
            (!numbers_agree(*a, *b)).then(|| format!("{path}: expected {a}, got {b}"))
        }
        (Node::Array(a), Node::Array(b)) => {
            if a.len() != b.len() {
                return Some(format!("{path}: {} items, got {}", a.len(), b.len()));
            }
            a.iter()
                .zip(b)
                .enumerate()
                .find_map(|(index, (a, b))| first_difference(a, b, &format!("{path}[{index}]")))
        }
        (Node::Object(a), Node::Object(b)) => {
            if keys(a) != keys(b) {
                return Some(format!("{path}: keys {:?}, got {:?}", keys(a), keys(b)));
            }
            a.iter()
                .zip(b)
                .find_map(|((name, a), (_, b))| first_difference(a, b, &format!("{path}.{name}")))
        }
        _ if expected.kind() != actual.kind() => Some(format!(
            "{path}: expected a {}, got a {}",
            expected.kind(),
            actual.kind()
        )),
        _ => (expected != actual).then(|| format!("{path}: expected {expected:?}, got {actual:?}")),
    }
}

fn keys(entries: &[(String, Node)]) -> Vec<&str> {
    entries.iter().map(|(name, _)| name.as_str()).collect()
}

fn code(error: &Node) -> Option<&str> {
    error.member("code").and_then(Node::string)
}

/// The `error` member of an error document, when `document` is one.
fn error_of(document: &Node) -> Option<&Node> {
    match document {
        Node::Object(entries) if entries.len() == 1 => document.member("error"),
        _ => None,
    }
}

/// How two error members disagree. The code must match. Ids are compared except for
/// `invalid_field`, and for `not_finite` only when both carry one.
fn error_difference(expected: &Node, actual: &Node) -> Option<String> {
    let expected_code = code(expected)?;
    if code(actual) != Some(expected_code) {
        return Some(format!("code {expected_code}, got {:?}", code(actual)));
    }
    ["accountId", "ruleId"].into_iter().find_map(|field| {
        let a = expected.member(field).and_then(Node::string);
        let b = actual.member(field).and_then(Node::string);
        let compared = match expected_code {
            "invalid_field" => false,
            "not_finite" => a.is_some() && b.is_some(),
            _ => true,
        };
        (compared && a != b).then(|| format!("{field} {a:?}, got {b:?}"))
    })
}

/// Runs the CLI with `args` and says how its output differs from `expected_path`, if it does.
fn run_difference(args: &[&str], expected_path: &Path) -> TestResult<Option<String>> {
    let output = Command::new(env!("CARGO_BIN_EXE_retirement-calc"))
        .args(args)
        .output()?;
    let expected = Node::parse(&fs::read(expected_path)?)?;
    let status = output.status.code();
    let Some(expected_error) = error_of(&expected) else {
        if status != Some(0) {
            return Ok(Some(format!("exit {status:?}, expected 0")));
        }
        return Ok(first_difference(
            &expected,
            &Node::parse(&output.stdout)?,
            "$",
        ));
    };
    if status != Some(2) {
        return Ok(Some(format!("exit {status:?}, expected 2")));
    }
    let actual = Node::parse(&output.stdout)?;
    let Some(actual_error) = error_of(&actual) else {
        return Ok(Some("exit 2 without an error document".to_owned()));
    };
    Ok(error_difference(expected_error, actual_error))
}

fn case_differences(case: &Path) -> TestResult<Vec<String>> {
    let scenario = case.join("scenario.json");
    let scenario = scenario.to_str().ok_or("a path that is not UTF-8")?;
    let today = read_line(&case.join("today"))?;
    let args = ["--scenario", scenario, "--today", &today];
    let mut differences = Vec::new();
    if let Some(difference) = run_difference(&args, &case.join(PROJECTION_FILE))? {
        differences.push(format!("projection: {difference}"));
    }
    let [trace_file, trace_json] = TRACE_FILES;
    if case.join(trace_file).exists() {
        let account_id = read_line(&case.join(trace_file))?;
        let traced = [&args[..], &["--trace", &account_id]].concat();
        if let Some(difference) = run_difference(&traced, &case.join(trace_json))? {
            differences.push(format!("trace: {difference}"));
        }
    }
    Ok(differences)
}

#[test]
fn golden_groups_hold_the_pinned_cases() -> TestResult {
    let groups = GROUPS.map(|(group, _)| group.to_owned());
    assert_eq!(names_in(&golden_dir())?, groups);
    let mut total = 0;
    for (group, count) in GROUPS {
        let cases = cases_in(group)?;
        assert_eq!(cases.len(), count, "{group}");
        total += cases.len();
        for case in cases {
            let mut expected = [INPUT_FILES[0], INPUT_FILES[1], PROJECTION_FILE].to_vec();
            if case.join(TRACE_FILES[0]).exists() {
                expected.extend(TRACE_FILES);
            }
            expected.sort_unstable();
            assert_eq!(names_in(&case)?, expected, "{}", case.display());
        }
    }
    assert_eq!(total, TOTAL_CASES);
    Ok(())
}

/// Every difference in `cases`, each named by its case.
fn chunk_failures(cases: &[PathBuf]) -> Result<Vec<String>, String> {
    let mut failures = Vec::new();
    for case in cases {
        let differences =
            case_differences(case).map_err(|error| format!("{}: {error}", case.display()))?;
        failures.extend(
            differences
                .into_iter()
                .map(|difference| format!("{}: {difference}", case.display())),
        );
    }
    Ok(failures)
}

#[test]
fn rust_cli_reproduces_every_golden_case() -> TestResult {
    let mut cases = Vec::new();
    for (group, _) in GROUPS {
        cases.extend(cases_in(group)?);
    }
    let workers = std::thread::available_parallelism()?.get();
    let chunk = cases.len().div_ceil(workers).max(1);
    let failures = std::thread::scope(|scope| {
        let mut handles = Vec::new();
        for chunk in cases.chunks(chunk) {
            handles.push(scope.spawn(move || chunk_failures(chunk)));
        }
        handles
            .into_iter()
            .map(|handle| handle.join().map_err(|_| "a worker panicked".to_owned())?)
            .collect::<Result<Vec<_>, String>>()
    })?;
    let failures = failures.concat();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    Ok(())
}
