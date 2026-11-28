//! Runs every case in `crates/cli/tests/golden/` through `retirement-calc` and requires its stdout
//! to be the expected file byte for byte. `just golden` writes the expected files through
//! [`write_the_golden_set_to_staging`].

use std::error::Error;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;
use serde::de::{self, MapAccess, SeqAccess, Visitor};
use serde_json::Value;

type TestResult<T = ()> = Result<T, Box<dyn Error>>;

/// Every group of golden cases and how many cases it holds.
const GROUPS: [(&str, usize); 4] = [
    ("examples", 5),
    ("generated", 200),
    ("hand-computed", 10),
    ("regressions", 14),
];

const TOTAL_CASES: usize = 229;

/// Lists every case as `group/name`, one per line, sorted.
const MANIFEST: &str = "manifest";
const SCENARIO_FILE: &str = "scenario.json";
const TODAY_FILE: &str = "today";
const PROJECTION_FILE: &str = "projection.json";
const TRACE_FILE: &str = "trace";
const TRACE_JSON_FILE: &str = "trace.json";

fn tests_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests")
}

fn golden_dir() -> PathBuf {
    tests_dir().join("golden")
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

/// Every case under `root` as `group/name`, sorted, from the folders present.
fn case_names(root: &Path) -> TestResult<Vec<String>> {
    let mut cases = Vec::new();
    for group in names_in(root)? {
        if group != MANIFEST {
            for name in names_in(&root.join(&group))? {
                cases.push(format!("{group}/{name}"));
            }
        }
    }
    Ok(cases)
}

fn manifest_text(cases: &[String]) -> String {
    cases.iter().map(|case| format!("{case}\n")).collect()
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
#[derive(Debug)]
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

/// The first place two documents disagree: keys and their order, array lengths, strings,
/// booleans and nulls must be identical, and numbers must have the same bits.
fn first_difference(expected: &Node, actual: &Node, path: &str) -> Option<String> {
    match (expected, actual) {
        (Node::Number(a), Node::Number(b)) => {
            (a.to_bits() != b.to_bits()).then(|| format!("{path}: expected {a:?}, got {b:?}"))
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
        (Node::Null, Node::Null) => None,
        (Node::Bool(a), Node::Bool(b)) if a == b => None,
        (Node::String(a), Node::String(b)) if a == b => None,
        _ if expected.kind() != actual.kind() => Some(format!(
            "{path}: expected a {}, got a {}",
            expected.kind(),
            actual.kind()
        )),
        _ => Some(format!("{path}: expected {expected:?}, got {actual:?}")),
    }
}

fn keys(entries: &[(String, Node)]) -> Vec<&str> {
    entries.iter().map(|(name, _)| name.as_str()).collect()
}

/// The `error` member of an error document, when `document` is one.
fn error_of(document: &Node) -> Option<&Node> {
    match document {
        Node::Object(entries) if entries.len() == 1 => document.member("error"),
        _ => None,
    }
}

/// The exit status the CLI gives when it prints `document`.
fn status_of(document: &Node) -> i32 {
    if error_of(document).is_some() { 2 } else { 0 }
}

/// The account a case traces: the first account of a scenario that projects, or that parses and
/// then fails with `not_finite`, the only error a parsed scenario's projection gives. A scenario
/// that fails to parse has no trace.
fn traced_account<'a>(scenario: &'a Value, projection: &Node) -> Option<&'a str> {
    if let Some(error) = error_of(projection)
        && error.member("code").and_then(Node::string) != Some("not_finite")
    {
        return None;
    }
    scenario.get("accounts")?.get(0)?.get("id")?.as_str()
}

fn read_scenario(case: &Path) -> TestResult<Value> {
    Ok(serde_json::from_slice(&fs::read(
        case.join(SCENARIO_FILE),
    )?)?)
}

/// The CLI's stdout and exit status for `args`.
fn run_cli(args: &[&str]) -> TestResult<(Vec<u8>, Option<i32>)> {
    let output = Command::new(env!("CARGO_BIN_EXE_retirement-calc"))
        .args(args)
        .output()?;
    Ok((output.stdout, output.status.code()))
}

/// How the CLI's output for `args` differs from the bytes of `expected_path`, if it does.
fn run_difference(args: &[&str], expected_path: &Path) -> TestResult<Option<String>> {
    let (stdout, status) = run_cli(args)?;
    let expected_bytes = fs::read(expected_path)?;
    let expected = Node::parse(&expected_bytes)?;
    let expected_status = status_of(&expected);
    if status != Some(expected_status) {
        return Ok(Some(format!("exit {status:?}, expected {expected_status}")));
    }
    if stdout == expected_bytes {
        return Ok(None);
    }
    let difference = first_difference(&expected, &Node::parse(&stdout)?, "$")
        .unwrap_or_else(|| "the same JSON printed differently".to_owned());
    Ok(Some(difference))
}

fn case_args(case: &Path) -> TestResult<(String, String)> {
    let scenario = case.join(SCENARIO_FILE);
    let scenario = scenario
        .to_str()
        .ok_or("a path that is not UTF-8")?
        .to_owned();
    Ok((scenario, read_line(&case.join(TODAY_FILE))?))
}

fn case_differences(case: &Path) -> TestResult<Vec<String>> {
    let (scenario, today) = case_args(case)?;
    let args = ["--scenario", &scenario, "--today", &today];
    let mut differences = Vec::new();
    if let Some(difference) = run_difference(&args, &case.join(PROJECTION_FILE))? {
        differences.push(format!("{PROJECTION_FILE}: {difference}"));
    }
    if case.join(TRACE_FILE).exists() {
        let account_id = read_line(&case.join(TRACE_FILE))?;
        let traced = [&args[..], &["--trace", &account_id]].concat();
        if let Some(difference) = run_difference(&traced, &case.join(TRACE_JSON_FILE))? {
            differences.push(format!("{TRACE_JSON_FILE}: {difference}"));
        }
    }
    Ok(differences)
}

/// The files `case` must hold, by the trace rule, and how its `trace` file must read.
fn expected_files(case: &Path) -> TestResult<(Vec<&'static str>, Option<String>)> {
    let scenario = read_scenario(case)?;
    let projection = Node::parse(&fs::read(case.join(PROJECTION_FILE))?)?;
    let mut files = vec![PROJECTION_FILE, SCENARIO_FILE, TODAY_FILE];
    let traced = traced_account(&scenario, &projection).map(|id| format!("{id}\n"));
    if traced.is_some() {
        files.extend([TRACE_FILE, TRACE_JSON_FILE]);
    }
    files.sort_unstable();
    Ok((files, traced))
}

#[test]
fn golden_set_holds_the_pinned_cases_and_files() -> TestResult {
    let golden = golden_dir();
    let mut expected_top: Vec<&str> = GROUPS.iter().map(|&(group, _)| group).collect();
    expected_top.push(MANIFEST);
    expected_top.sort_unstable();
    assert_eq!(names_in(&golden)?, expected_top);
    let cases = case_names(&golden)?;
    assert_eq!(
        fs::read_to_string(golden.join(MANIFEST))?,
        manifest_text(&cases),
        "the case folders differ from {MANIFEST}"
    );
    for (group, count) in GROUPS {
        let prefix = format!("{group}/");
        let held = cases
            .iter()
            .filter(|case| case.starts_with(&prefix))
            .count();
        assert_eq!(held, count, "{group}");
    }
    assert_eq!(cases.len(), TOTAL_CASES);
    for case in &cases {
        let dir = golden.join(case);
        let (files, traced) = expected_files(&dir)?;
        assert_eq!(names_in(&dir)?, files, "{case}");
        if let Some(traced) = traced {
            assert_eq!(fs::read_to_string(dir.join(TRACE_FILE))?, traced, "{case}");
        }
    }
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
fn rust_cli_prints_every_golden_case_byte_for_byte() -> TestResult {
    let golden = golden_dir();
    let cases: Vec<PathBuf> = case_names(&golden)?
        .iter()
        .map(|case| golden.join(case))
        .collect();
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

/// The CLI's document for `args`, checked against the exit status it gave.
fn write_output(args: &[&str], path: &Path) -> TestResult<Node> {
    let (stdout, status) = run_cli(args)?;
    let document = Node::parse(&stdout)
        .map_err(|error| format!("{}: exit {status:?}: {error}", path.display()))?;
    if status != Some(status_of(&document)) {
        return Err(format!(
            "{}: exit {status:?} does not match its document",
            path.display()
        )
        .into());
    }
    fs::write(path, stdout)?;
    Ok(document)
}

/// Copies the inputs of every case in the golden set to `.golden-new` beside it, with the CLI's
/// output for each, the trace files the trace rule asks for, and the manifest.
#[test]
#[ignore = "writes crates/cli/tests/.golden-new for just golden"]
fn write_the_golden_set_to_staging() -> TestResult {
    let golden = golden_dir();
    let staged = tests_dir().join(".golden-new");
    fs::create_dir(&staged)?;
    let cases = case_names(&golden)?;
    for case in &cases {
        let (from, to) = (golden.join(case), staged.join(case));
        fs::create_dir_all(&to)?;
        for file in [SCENARIO_FILE, TODAY_FILE] {
            fs::copy(from.join(file), to.join(file))?;
        }
        let (scenario_path, today) = case_args(&to)?;
        let args = ["--scenario", &scenario_path, "--today", &today];
        let projection = write_output(&args, &to.join(PROJECTION_FILE))?;
        let scenario = read_scenario(&to)?;
        if let Some(account_id) = traced_account(&scenario, &projection) {
            fs::write(to.join(TRACE_FILE), format!("{account_id}\n"))?;
            let traced = [&args[..], &["--trace", account_id]].concat();
            write_output(&traced, &to.join(TRACE_JSON_FILE))?;
        }
    }
    fs::write(staged.join(MANIFEST), manifest_text(&cases))?;
    Ok(())
}
