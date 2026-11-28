//! Drives the golden publication step by step against small sets under the target's temporary
//! folder, never against `crates/cli/tests/golden/`.

use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use super::{
    GOLDEN, INVENTORY, Inventory, MANIFEST, Outputs, PROJECTION_FILE, RETIRED, SCENARIO_FILE,
    STAGED, TODAY_FILE, TestResult, check_set, generation, install, lock_for_reading,
    lock_for_writing, names_in, publish, retire, settle, stage,
};

const GROUPS: [(&str, usize); 2] = [("one", 2), ("two", 1)];

const FIXTURE: Inventory = Inventory {
    groups: &GROUPS,
    total: 3,
};

const PROJECTS: &str = r#"{
  "accounts": [
    {
      "balance": 10,
      "balanceAsOf": "2026-01-01",
      "contributions": [],
      "id": "a",
      "included": true,
      "kind": "other",
      "name": "a"
    }
  ],
  "endDate": "2027-01-01",
  "interest": { "annualRate": 0.05, "compounding": "monthly", "variance": 0 },
  "salary": { "annualBase": 0, "asOf": "2026-01-01" },
  "version": 1
}
"#;

const NO_ACCOUNTS: &str = r#"{
  "accounts": [],
  "endDate": "2027-01-01",
  "interest": { "annualRate": 0.05, "compounding": "monthly", "variance": 0 },
  "salary": { "annualBase": 0, "asOf": "2026-01-01" },
  "version": 1
}
"#;

const UNSUPPORTED: &str = "{ \"version\": 2 }\n";

const CASES: [(&str, &str); 3] = [
    ("one/no-accounts", NO_ACCOUNTS),
    ("one/projects", PROJECTS),
    ("two/unsupported", UNSUPPORTED),
];

/// Every file under a directory by its path relative to it, with its bytes.
type Snapshot = BTreeMap<PathBuf, Vec<u8>>;

fn snapshot(dir: &Path) -> TestResult<Snapshot> {
    let mut files = Snapshot::new();
    add_files(dir, Path::new(""), &mut files)?;
    Ok(files)
}

fn add_files(root: &Path, relative: &Path, files: &mut Snapshot) -> TestResult {
    for name in names_in(&root.join(relative))? {
        let path = relative.join(name);
        let full = root.join(&path);
        if full.is_dir() {
            add_files(root, &path, files)?;
        } else {
            files.insert(path, fs::read(full)?);
        }
    }
    Ok(())
}

fn write_case(live: &Path, case: &str, scenario: &str) -> TestResult {
    let dir = live.join(case);
    fs::create_dir_all(&dir)?;
    fs::write(dir.join(SCENARIO_FILE), scenario)?;
    fs::write(dir.join(TODAY_FILE), "2026-01-01\n")?;
    Ok(())
}

/// A tests folder named `name` holding a complete published set of the fixture cases, with one
/// projection given a trailing newline so that the set the next writer publishes differs from it.
fn published_tree(name: &str) -> TestResult<PathBuf> {
    let tests = Path::new(env!("CARGO_TARGET_TMPDIR"))
        .join("golden-publication")
        .join(name);
    if fs::exists(&tests)? {
        fs::remove_dir_all(&tests)?;
    }
    let live = tests.join(GOLDEN);
    let mut manifest = String::new();
    for (case, scenario) in CASES {
        write_case(&live, case, scenario)?;
        manifest.push_str(case);
        manifest.push('\n');
    }
    fs::write(live.join(MANIFEST), manifest)?;
    publish(&tests, &FIXTURE)?;
    OpenOptions::new()
        .append(true)
        .open(live.join("one/projects").join(PROJECTION_FILE))?
        .write_all(b"\n")?;
    Ok(tests)
}

/// The generation a reader resolves, required to be complete.
fn read_generation(tests: &Path) -> TestResult<Snapshot> {
    let root = generation(tests);
    check_set(&root, &FIXTURE, Outputs::Current)?;
    snapshot(&root)
}

/// Requires that only the live set is left under `tests`, and returns it.
fn only_live(tests: &Path) -> TestResult<Snapshot> {
    assert!(!fs::exists(tests.join(STAGED))?, "a staged set is left");
    assert!(!fs::exists(tests.join(RETIRED))?, "a retired set is left");
    read_generation(tests)
}

/// Requires the writer to fail with `reason` and leave the live set byte for byte as it was.
fn assert_refused(tests: &Path, reason: &str) -> TestResult {
    let before = snapshot(&tests.join(GOLDEN))?;
    let error = publish(tests, &FIXTURE)
        .err()
        .ok_or("the writer published")?;
    assert!(error.to_string().contains(reason), "{error}");
    assert!(!fs::exists(tests.join(STAGED))?, "a staged set is left");
    assert!(!fs::exists(tests.join(RETIRED))?, "a retired set is left");
    assert_eq!(snapshot(&tests.join(GOLDEN))?, before);
    Ok(())
}

/// Where a writer is stopped.
#[derive(Clone, Copy, Debug)]
enum Stop {
    BeforeFirstRename,
    BetweenRenames,
    AfterSecondRename,
}

/// Runs the writer's steps on `tests` up to `stop`, and returns the old and the new set.
fn run_until(tests: &Path, stop: Stop) -> TestResult<(Snapshot, Snapshot)> {
    let old = read_generation(tests)?;
    settle(tests)?;
    let cases = check_set(&tests.join(GOLDEN), &FIXTURE, Outputs::Stale)?;
    stage(tests, &cases)?;
    check_set(&tests.join(STAGED), &FIXTURE, Outputs::Current)?;
    let new = snapshot(&tests.join(STAGED))?;
    assert_ne!(old, new);
    if matches!(stop, Stop::BetweenRenames | Stop::AfterSecondRename) {
        retire(tests)?;
    }
    if matches!(stop, Stop::AfterSecondRename) {
        install(tests)?;
    }
    Ok((old, new))
}

#[test]
fn golden_inventory_counts_add_up_to_the_total() {
    let held: usize = INVENTORY.groups.iter().map(|&(_, count)| count).sum();
    assert_eq!(held, INVENTORY.total);
}

#[test]
fn a_second_writer_is_refused_while_the_first_holds_the_lock() -> TestResult {
    let tests = published_tree("second-writer")?;
    let _first = lock_for_writing(&tests)?;
    assert_refused(&tests, "another golden regeneration")
}

#[test]
fn a_writer_is_refused_while_a_reader_holds_the_lock() -> TestResult {
    let tests = published_tree("writer-during-read")?;
    let _reader = lock_for_reading(&tests)?;
    assert_refused(&tests, "another golden regeneration")
}

#[test]
fn a_writer_publishes_the_new_set_whole() -> TestResult {
    let tests = published_tree("publishes")?;
    let (_, new) = run_until(
        &published_tree("publishes-expected")?,
        Stop::BeforeFirstRename,
    )?;
    publish(&tests, &FIXTURE)?;
    assert_eq!(only_live(&tests)?, new);
    Ok(())
}

#[test]
fn a_reader_sees_one_complete_generation_at_every_step_of_a_writer() -> TestResult {
    let tests = published_tree("reader")?;
    let (old, new) = run_until(&tests, Stop::BeforeFirstRename)?;
    assert_eq!(read_generation(&tests)?, old);
    retire(&tests)?;
    assert_eq!(read_generation(&tests)?, old);
    install(&tests)?;
    assert_eq!(read_generation(&tests)?, new);
    fs::remove_dir_all(tests.join(RETIRED))?;
    assert_eq!(read_generation(&tests)?, new);
    Ok(())
}

#[test]
fn a_killed_writer_settles_to_the_old_set_before_the_second_rename_and_the_new_one_after()
-> TestResult {
    for stop in [
        Stop::BeforeFirstRename,
        Stop::BetweenRenames,
        Stop::AfterSecondRename,
    ] {
        let tests = published_tree(&format!("killed-{stop:?}"))?;
        let (old, new) = run_until(&tests, stop)?;
        settle(&tests)?;
        let expected = if matches!(stop, Stop::AfterSecondRename) {
            new
        } else {
            old
        };
        assert_eq!(only_live(&tests)?, expected, "{stop:?}");
    }
    Ok(())
}

#[test]
fn the_next_writer_after_a_kill_between_the_renames_publishes() -> TestResult {
    let tests = published_tree("after-kill")?;
    let (_, new) = run_until(&tests, Stop::BetweenRenames)?;
    publish(&tests, &FIXTURE)?;
    assert_eq!(only_live(&tests)?, new);
    Ok(())
}

#[test]
fn a_failed_second_rename_puts_the_old_set_back() -> TestResult {
    let tests = published_tree("failed-install")?;
    let (old, _) = run_until(&tests, Stop::BeforeFirstRename)?;
    fs::remove_dir_all(tests.join(STAGED))?;
    retire(&tests)?;
    let error = install(&tests).err().ok_or("the install succeeded")?;
    assert!(error.to_string().contains("the old set is back"), "{error}");
    assert_eq!(only_live(&tests)?, old);
    Ok(())
}

#[test]
fn a_writer_refuses_a_renamed_case_folder() -> TestResult {
    let tests = published_tree("renamed")?;
    let live = tests.join(GOLDEN);
    fs::rename(live.join("one/projects"), live.join("one/renamed"))?;
    assert_refused(&tests, "differ from its manifest")
}

#[test]
fn a_writer_refuses_a_missing_case_folder() -> TestResult {
    let tests = published_tree("missing")?;
    fs::remove_dir_all(tests.join(GOLDEN).join("one/projects"))?;
    assert_refused(&tests, "differ from its manifest")
}

#[test]
fn a_writer_refuses_an_extra_case_folder() -> TestResult {
    let tests = published_tree("extra")?;
    write_case(&tests.join(GOLDEN), "two/extra", NO_ACCOUNTS)?;
    assert_refused(&tests, "differ from its manifest")
}

#[test]
fn a_writer_refuses_a_manifest_line_without_a_folder() -> TestResult {
    let tests = published_tree("ghost")?;
    OpenOptions::new()
        .append(true)
        .open(tests.join(GOLDEN).join(MANIFEST))?
        .write_all(b"two/ghost\n")?;
    assert_refused(&tests, "differ from its manifest")
}

#[test]
fn a_writer_refuses_a_case_removed_from_its_folder_and_the_manifest() -> TestResult {
    let tests = published_tree("removed")?;
    let live = tests.join(GOLDEN);
    fs::remove_dir_all(live.join("one/projects"))?;
    fs::write(live.join(MANIFEST), "one/no-accounts\ntwo/unsupported\n")?;
    assert_refused(&tests, "one holds 1 cases, expected 2")
}

#[test]
fn a_writer_refuses_a_case_without_its_inputs() -> TestResult {
    let tests = published_tree("no-today")?;
    fs::remove_file(tests.join(GOLDEN).join("one/projects").join(TODAY_FILE))?;
    assert_refused(&tests, "has no today")
}
