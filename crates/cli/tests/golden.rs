//! Runs every case in `crates/cli/tests/golden/` through `retirement-calc` and requires its stdout
//! to be the expected file byte for byte. `just golden` rewrites the expected files through
//! [`publish_the_golden_set`].
//!
//! Publication holds an exclusive lock on `.golden.lock` beside the set and the readers hold it
//! shared, so a reader always sees one complete generation. The writer stages the new set at
//! `.golden-new`, moves the live set to `.golden-old`, moves the staged set in and removes the
//! old one. A writer killed between the two moves leaves `.golden-old` alone, which readers read
//! and the next writer puts back.

use std::error::Error;
use std::fmt;
use std::fs::{self, File, TryLockError};
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;
use serde::de::{self, MapAccess, SeqAccess, Visitor};
use serde_json::Value;

mod publication;

type TestResult<T = ()> = Result<T, Box<dyn Error>>;

/// The cases a golden set must hold: each group with its number of cases, and the total.
struct Inventory {
    groups: &'static [(&'static str, usize)],
    total: usize,
}

const GROUPS: [(&str, usize); 4] = [
    ("examples", 5),
    ("generated", 200),
    ("hand-computed", 10),
    ("regressions", 14),
];

const TOTAL_CASES: usize = 229;

const INVENTORY: Inventory = Inventory {
    groups: &GROUPS,
    total: TOTAL_CASES,
};

const GOLDEN: &str = "golden";
const STAGED: &str = ".golden-new";
const RETIRED: &str = ".golden-old";
const LOCK: &str = ".golden.lock";
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

/// Whether a set's output files must already follow the trace rule, or may be stale because the
/// writer is about to replace them.
#[derive(Clone, Copy)]
enum Outputs {
    Current,
    Stale,
}

fn mismatch<T>(message: String) -> TestResult<T> {
    Err(message.into())
}

/// Checks the set at `root` against `inventory`: its groups, its manifest against its case
/// folders, each group's count, the total and each case's files. Returns its cases.
fn check_set(root: &Path, inventory: &Inventory, outputs: Outputs) -> TestResult<Vec<String>> {
    let mut expected_top: Vec<&str> = inventory.groups.iter().map(|&(group, _)| group).collect();
    expected_top.push(MANIFEST);
    expected_top.sort_unstable();
    let top = names_in(root)?;
    if top != expected_top {
        return mismatch(format!(
            "{} holds {top:?}, expected {expected_top:?}",
            root.display()
        ));
    }
    let cases = case_names(root)?;
    if fs::read_to_string(root.join(MANIFEST))? != manifest_text(&cases) {
        return mismatch(format!(
            "the case folders in {} differ from its {MANIFEST}",
            root.display()
        ));
    }
    for &(group, count) in inventory.groups {
        let prefix = format!("{group}/");
        let held = cases
            .iter()
            .filter(|case| case.starts_with(&prefix))
            .count();
        if held != count {
            return mismatch(format!("{group} holds {held} cases, expected {count}"));
        }
    }
    if cases.len() != inventory.total {
        return mismatch(format!(
            "the set holds {} cases, expected {}",
            cases.len(),
            inventory.total
        ));
    }
    for case in &cases {
        let dir = root.join(case);
        let held = names_in(&dir)?;
        match outputs {
            Outputs::Current => check_outputs(&dir, &held)?,
            Outputs::Stale => check_inputs(&dir, &held)?,
        }
    }
    Ok(cases)
}

/// Requires the files of `case` to be exactly those the trace rule asks for.
fn check_outputs(case: &Path, held: &[String]) -> TestResult {
    let (files, traced) = expected_files(case)?;
    if held != files {
        return mismatch(format!(
            "{} holds {held:?}, expected {files:?}",
            case.display()
        ));
    }
    if let Some(traced) = traced
        && fs::read_to_string(case.join(TRACE_FILE))? != traced
    {
        return mismatch(format!("{} does not trace {traced:?}", case.display()));
    }
    Ok(())
}

/// Requires `case` to hold its inputs and no file a case cannot hold.
fn check_inputs(case: &Path, held: &[String]) -> TestResult {
    let all = [
        PROJECTION_FILE,
        SCENARIO_FILE,
        TODAY_FILE,
        TRACE_FILE,
        TRACE_JSON_FILE,
    ];
    let missing = [SCENARIO_FILE, TODAY_FILE]
        .into_iter()
        .find(|input| !held.iter().any(|name| name == input));
    let stray = held.iter().find(|name| !all.contains(&name.as_str()));
    match (missing, stray) {
        (Some(input), _) => mismatch(format!("{} has no {input}", case.display())),
        (None, Some(name)) => mismatch(format!("{} holds {name}", case.display())),
        (None, None) => Ok(()),
    }
}

#[test]
fn golden_set_holds_the_pinned_cases_and_files() -> TestResult {
    let tests = tests_dir();
    let _lock = lock_for_reading(&tests)?;
    check_set(&generation(&tests), &INVENTORY, Outputs::Current)?;
    Ok(())
}

#[test]
fn shipped_examples_are_the_golden_examples_byte_for_byte() -> TestResult {
    let tests = tests_dir();
    let _lock = lock_for_reading(&tests)?;
    let golden = generation(&tests).join("examples");
    let shipped = Path::new(env!("CARGO_MANIFEST_DIR")).join("examples");
    let names = names_in(&golden)?;
    let files: Vec<String> = names.iter().map(|name| format!("{name}.json")).collect();

    assert_eq!(names_in(&shipped)?, files);
    for (name, file) in names.iter().zip(&files) {
        assert_eq!(
            fs::read(shipped.join(file))?,
            fs::read(golden.join(name).join(SCENARIO_FILE))?,
            "{file}"
        );
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
    let tests = tests_dir();
    let _lock = lock_for_reading(&tests)?;
    let golden = generation(&tests);
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

fn open_lock(tests: &Path) -> TestResult<File> {
    Ok(File::options()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(tests.join(LOCK))?)
}

/// Holds the lock of the golden set under `tests` exclusively, or fails at once when a writer or
/// a reader holds it.
fn lock_for_writing(tests: &Path) -> TestResult<File> {
    let lock = open_lock(tests)?;
    match lock.try_lock() {
        Ok(()) => Ok(lock),
        Err(TryLockError::WouldBlock) => Err(format!(
            "another golden regeneration or golden test is running in {}, so nothing was changed",
            tests.display()
        )
        .into()),
        Err(TryLockError::Error(error)) => Err(error.into()),
    }
}

/// Holds the lock of the golden set under `tests` shared, waiting for a writer to finish.
fn lock_for_reading(tests: &Path) -> TestResult<File> {
    let lock = open_lock(tests)?;
    lock.lock_shared()?;
    Ok(lock)
}

/// The generation readers see: the live set, or the retired one when a killed writer left no
/// live set.
fn generation(tests: &Path) -> PathBuf {
    let live = tests.join(GOLDEN);
    if live.exists() {
        live
    } else {
        tests.join(RETIRED)
    }
}

/// Clears what a killed writer left: puts the retired set back when there is no live set, removes
/// the staged set, and removes the retired set once a live set is in place.
fn settle(tests: &Path) -> TestResult {
    let (live, staged, retired) = (tests.join(GOLDEN), tests.join(STAGED), tests.join(RETIRED));
    if !fs::exists(&live)? && fs::exists(&retired)? {
        fs::rename(&retired, &live)?;
    }
    if fs::exists(&staged)? {
        fs::remove_dir_all(&staged)?;
    }
    if fs::exists(&live)? && fs::exists(&retired)? {
        fs::remove_dir_all(&retired)?;
    }
    Ok(())
}

/// Copies the manifest and the inputs of `cases` from the live set to the staged set, and writes
/// the CLI's output for each case with the trace files the trace rule asks for.
fn stage(tests: &Path, cases: &[String]) -> TestResult {
    let (live, staged) = (tests.join(GOLDEN), tests.join(STAGED));
    fs::create_dir(&staged)?;
    fs::copy(live.join(MANIFEST), staged.join(MANIFEST))?;
    for case in cases {
        let (from, to) = (live.join(case), staged.join(case));
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
    Ok(())
}

fn retire(tests: &Path) -> TestResult {
    Ok(fs::rename(tests.join(GOLDEN), tests.join(RETIRED))?)
}

/// Moves the staged set in, or puts the retired set back and fails.
fn install(tests: &Path) -> TestResult {
    let live = tests.join(GOLDEN);
    let Err(error) = fs::rename(tests.join(STAGED), &live) else {
        return Ok(());
    };
    match fs::rename(tests.join(RETIRED), &live) {
        Ok(()) => Err(format!(
            "the new set could not be moved in, so the old set is back: {error}"
        )
        .into()),
        Err(restore) => Err(format!(
            "the new set could not be moved in ({error}) and the old set is still at {}: {restore}",
            tests.join(RETIRED).display()
        )
        .into()),
    }
}

/// Replaces the golden set under `tests` whole with the CLI's output for its inputs, holding its
/// lock throughout. The live set and the new one must both match `inventory`.
fn publish(tests: &Path, inventory: &Inventory) -> TestResult {
    let lock = lock_for_writing(tests)?;
    let published = publish_locked(tests, inventory);
    lock.unlock()?;
    published
}

fn publish_locked(tests: &Path, inventory: &Inventory) -> TestResult {
    settle(tests)?;
    let cases = check_set(&tests.join(GOLDEN), inventory, Outputs::Stale)?;
    stage(tests, &cases)?;
    check_set(&tests.join(STAGED), inventory, Outputs::Current)?;
    retire(tests)?;
    install(tests)?;
    Ok(fs::remove_dir_all(tests.join(RETIRED))?)
}

#[test]
#[ignore = "rewrites crates/cli/tests/golden/; just golden runs it"]
fn publish_the_golden_set() -> TestResult {
    publish(&tests_dir(), &INVENTORY)
}
