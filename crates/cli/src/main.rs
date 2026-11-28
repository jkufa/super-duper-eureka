//! `retirement-calc`: projects a scenario file, or traces one account, and prints the result as
//! JSON.

use std::fmt::Display;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, ValueEnum};
use retirement_core::date::CalendarDate;
use retirement_core::project::{Band, ProjectionError, project_scenario, trace_account};
use retirement_core::scenario::raw::{ScenarioFile, VersionFile};
use retirement_core::scenario::{Scenario, ScenarioError};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const EXIT_STATUSES: &str = "\
Exit status:
  0  Success.
  1  Bad usage, or the scenario file cannot be read or is not JSON. Nothing goes to stdout.
  2  The scenario is invalid or cannot be projected. stdout holds
     { \"error\": { \"code\", \"accountId\"?, \"ruleId\"? } } and stderr the message.";

/// Prints one JSON document to stdout: the scenario's projection, or with --trace the account's
/// trace segments.
#[derive(Debug, Parser)]
#[command(name = "retirement-calc", after_help = EXIT_STATUSES, args_override_self = true)]
struct Args {
    /// Path to a version 1 scenario JSON file.
    #[arg(long, value_name = "file")]
    scenario: PathBuf,
    /// The date results start from, as YYYY-MM-DD. Default: this machine's local date.
    #[arg(long, value_name = "date")]
    today: Option<String>,
    /// Print the trace of one account instead of the projection.
    #[arg(long, value_name = "accountId")]
    trace: Option<String>,
    /// Only with --trace. Default: baseline.
    #[arg(long, value_name = "band", requires = "trace")]
    band: Option<BandArg>,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum BandArg {
    Baseline,
    Positive,
    Negative,
}

impl From<BandArg> for Band {
    fn from(band: BandArg) -> Self {
        match band {
            BandArg::Baseline => Self::Baseline,
            BandArg::Positive => Self::Positive,
            BandArg::Negative => Self::Negative,
        }
    }
}

/// Why a run printed no result.
enum Failure {
    /// Exit status 1, with nothing on stdout.
    Input(String),
    /// Exit status 2, with the error document on stdout.
    Scenario(ErrorReport),
}

/// The `error` member of the document printed for a scenario that is invalid or cannot be
/// projected.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorReport {
    code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rule_id: Option<String>,
    #[serde(skip)]
    message: String,
}

#[derive(Serialize)]
struct ErrorDocument<'a> {
    error: &'a ErrorReport,
}

impl ErrorReport {
    fn invalid_field(message: impl Display) -> Self {
        Self {
            code: "invalid_field",
            account_id: None,
            rule_id: None,
            message: format!("invalid_field: {message}"),
        }
    }

    fn invalid_today(today: &str) -> Self {
        Self {
            code: "invalid_date",
            account_id: None,
            rule_id: None,
            message: format!("invalid_date in --today: {today:?} is not a real YYYY-MM-DD date"),
        }
    }
}

impl From<ScenarioError> for Failure {
    fn from(error: ScenarioError) -> Self {
        Self::Scenario(ErrorReport {
            code: error.code(),
            account_id: error.account_id().map(ToString::to_string),
            rule_id: error.rule_id().map(ToString::to_string),
            message: error.to_string(),
        })
    }
}

impl From<ProjectionError<'_>> for Failure {
    fn from(error: ProjectionError<'_>) -> Self {
        Self::Scenario(ErrorReport {
            code: error.code(),
            account_id: error.account_id().map(str::to_owned),
            rule_id: None,
            message: error.to_string(),
        })
    }
}

fn main() -> ExitCode {
    let args = match Args::try_parse() {
        Ok(args) => args,
        Err(error) => {
            let printed = error.print();
            return if error.use_stderr() || printed.is_err() {
                ExitCode::from(1)
            } else {
                ExitCode::SUCCESS
            };
        }
    };
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(Failure::Input(message)) => {
            eprintln!("{message}");
            ExitCode::from(1)
        }
        Err(Failure::Scenario(report)) => {
            eprintln!("{}", report.message);
            match print_json(&ErrorDocument { error: &report }) {
                Ok(()) => ExitCode::from(2),
                Err(error) => {
                    eprintln!("Cannot write the error: {error}");
                    ExitCode::from(1)
                }
            }
        }
    }
}

/// Prints the projection, or the trace when `--trace` is given.
fn run(args: &Args) -> Result<(), Failure> {
    let text = std::fs::read_to_string(&args.scenario).map_err(|error| {
        Failure::Input(format!("Cannot read {}: {error}", args.scenario.display()))
    })?;
    let scenario = read_scenario(&args.scenario, &text, args.today.as_deref())?;
    let printed = match &args.trace {
        Some(account_id) => {
            let band = args.band.map_or(Band::Baseline, Band::from);
            print_json(&trace_account(&scenario, account_id, band)?)
        }
        None => print_json(&project_scenario(&scenario)?),
    };
    printed.map_err(|error| Failure::Input(format!("Cannot write the result: {error}")))
}

/// Text that is not JSON is an input failure. Of JSON, the version is checked first, then
/// `today`, then the rest of the file.
fn read_scenario(path: &Path, text: &str, today: Option<&str>) -> Result<Scenario, Failure> {
    let json: Value = serde_json::from_str(text)
        .map_err(|error| Failure::Input(format!("{} is not JSON: {error}", path.display())))?;
    VersionFile::deserialize(&json)
        .map_err(|error| Failure::Scenario(ErrorReport::invalid_field(error)))?
        .version
        .check()?;
    let today_text = today.map_or_else(local_today, str::to_owned);
    let Some(today) = CalendarDate::parse(&today_text) else {
        return Err(Failure::Scenario(ErrorReport::invalid_today(&today_text)));
    };
    let file = ScenarioFile::deserialize(json)
        .map_err(|error| Failure::Scenario(ErrorReport::invalid_field(error)))?;
    Ok(Scenario::parse(file, today)?)
}

/// This machine's date in its time zone, as `YYYY-MM-DD`.
fn local_today() -> String {
    jiff::ZonedDateTime::now().date().to_string()
}

fn print_json(value: &impl Serialize) -> io::Result<()> {
    let mut stdout = io::stdout().lock();
    serde_json::to_writer_pretty(&mut stdout, value)?;
    writeln!(stdout)?;
    stdout.flush()
}
