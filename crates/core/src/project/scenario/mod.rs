//! Every account of a scenario rolled forward to today and projected to the end date, in three
//! bands, with the included accounts' total.

mod effective_rate;
mod weighted;

use super::{MonthlyRow, ProjectionError, Series, project_account, yearly_rows};
use crate::date::CalendarDate;
use crate::scenario::{Account, AccountId, Scenario};
use crate::schedule::{month_segments, salary_in_year};
use effective_rate::effective_rate;

pub use weighted::{BaselineProjection, WeightedSeries, WeightedYearlyRow};

/// The rates an account is projected at.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Band {
    /// The account's own rate, or the scenario's.
    Baseline,
    /// The baseline rate plus the variance.
    Positive,
    /// The baseline rate minus the variance.
    Negative,
}

impl Band {
    fn rate(self, scenario: &Scenario, account: &Account) -> f64 {
        let interest = scenario.interest();
        let rate = account.annual_rate().unwrap_or(interest.annual_rate());
        match self {
            Self::Baseline => rate,
            Self::Positive => rate + interest.variance(),
            Self::Negative => rate - interest.variance(),
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct ScenarioProjection<'a> {
    today: CalendarDate,
    end_date: CalendarDate,
    effective_rate: f64,
    stale_accounts: Vec<StaleAccount<'a>>,
    salary_by_year: Vec<YearSalary>,
    bands: Bands<'a>,
}

impl<'a> ScenarioProjection<'a> {
    pub fn today(&self) -> CalendarDate {
        self.today
    }

    pub fn end_date(&self) -> CalendarDate {
        self.end_date
    }

    /// The one rate at which the included accounts, pooled at today at their baseline balances,
    /// end on the baseline total. A fraction: 0.06 is 6 percent.
    pub fn effective_rate(&self) -> f64 {
        self.effective_rate
    }

    /// Included accounts whose balance is dated before today, in file order.
    pub fn stale_accounts(&self) -> &[StaleAccount<'a>] {
        &self.stale_accounts
    }

    /// One entry per yearly row of the total.
    pub fn salary_by_year(&self) -> &[YearSalary] {
        &self.salary_by_year
    }

    pub fn bands(&self) -> &Bands<'a> {
        &self.bands
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StaleAccount<'a> {
    account_id: &'a AccountId,
    balance_as_of: CalendarDate,
}

impl<'a> StaleAccount<'a> {
    pub fn account_id(self) -> &'a AccountId {
        self.account_id
    }

    pub fn balance_as_of(self) -> CalendarDate {
        self.balance_as_of
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct YearSalary {
    year: i16,
    salary: f64,
}

impl YearSalary {
    pub fn year(self) -> i16 {
        self.year
    }

    /// Dollars a year.
    pub fn salary(self) -> f64 {
        self.salary
    }
}

#[derive(Debug, PartialEq)]
pub struct Bands<'a> {
    baseline: BaselineProjection<'a>,
    positive: BandProjection<'a>,
    negative: BandProjection<'a>,
}

impl<'a> Bands<'a> {
    pub fn baseline(&self) -> &BaselineProjection<'a> {
        &self.baseline
    }

    pub fn positive(&self) -> &BandProjection<'a> {
        &self.positive
    }

    pub fn negative(&self) -> &BandProjection<'a> {
        &self.negative
    }
}

#[derive(Debug, PartialEq)]
pub struct BandProjection<'a> {
    total: Series,
    accounts: Vec<AccountProjection<'a>>,
}

impl<'a> BandProjection<'a> {
    /// The included accounts summed row by row in file order, each sum starting from 0.
    pub fn total(&self) -> &Series {
        &self.total
    }

    /// Every account, in file order.
    pub fn accounts(&self) -> &[AccountProjection<'a>] {
        &self.accounts
    }
}

#[derive(Debug, PartialEq)]
pub struct AccountProjection<'a> {
    account_id: &'a AccountId,
    included: bool,
    annual_rate: f64,
    rolled_forward: RolledForward,
    series: Series,
}

impl<'a> AccountProjection<'a> {
    pub fn account_id(&self) -> &'a AccountId {
        self.account_id
    }

    /// Whether the account counts towards the total.
    pub fn included(&self) -> bool {
        self.included
    }

    /// The band's rate for this account. A fraction: 0.06 is 6 percent.
    pub fn annual_rate(&self) -> f64 {
        self.annual_rate
    }

    pub fn rolled_forward(&self) -> RolledForward {
        self.rolled_forward
    }

    /// From today to the end date.
    pub fn series(&self) -> &Series {
        &self.series
    }
}

/// What the roll forward from the balance's date to today added. Zero when the balance is dated
/// today.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RolledForward {
    contributions: f64,
    interest: f64,
}

impl RolledForward {
    pub fn contributions(self) -> f64 {
        self.contributions
    }

    pub fn interest(self) -> f64 {
        self.interest
    }
}

/// Fails on the first figure that is not finite, in this order: each band's accounts in file
/// order and then its total, the baseline band before its weighted rates and the positive and
/// negative bands after them, then the salaries.
pub fn project_scenario(
    scenario: &Scenario,
) -> Result<ScenarioProjection<'_>, ProjectionError<'_>> {
    let baseline = project_band(scenario, Band::Baseline)?.with_weighted_rates()?;
    let positive = project_band(scenario, Band::Positive)?;
    let negative = project_band(scenario, Band::Negative)?;
    let effective_rate = effective_rate(scenario, &baseline)?;
    let salary_by_year = baseline
        .total()
        .yearly()
        .iter()
        .map(|row| {
            let year = row.row().year();
            let salary = salary_in_year(scenario, year);
            if salary.is_finite() {
                Ok(YearSalary { year, salary })
            } else {
                Err(ProjectionError::ScenarioNotFinite)
            }
        })
        .collect::<Result<_, _>>()?;
    let today = scenario.today();
    Ok(ScenarioProjection {
        today,
        end_date: scenario.end_date(),
        effective_rate,
        stale_accounts: scenario
            .accounts()
            .iter()
            .filter(|account| account.included() && account.balance_as_of() < today)
            .map(|account| StaleAccount {
                account_id: account.id(),
                balance_as_of: account.balance_as_of(),
            })
            .collect(),
        salary_by_year,
        bands: Bands {
            baseline,
            positive,
            negative,
        },
    })
}

fn project_band(
    scenario: &Scenario,
    band: Band,
) -> Result<BandProjection<'_>, ProjectionError<'_>> {
    let mut accounts = Vec::with_capacity(scenario.accounts().len());
    for account in scenario.accounts() {
        accounts.push(project_one(
            scenario,
            account,
            band.rate(scenario, account),
        )?);
    }
    let total = total_of(scenario, &accounts)?;
    Ok(BandProjection { total, accounts })
}

fn project_one<'a>(
    scenario: &Scenario,
    account: &'a Account,
    annual_rate: f64,
) -> Result<AccountProjection<'a>, ProjectionError<'a>> {
    let rolled = project_account(
        scenario,
        account,
        account.balance_as_of(),
        scenario.today(),
        account.balance(),
        annual_rate,
    )?;
    let series = project_account(
        scenario,
        account,
        scenario.today(),
        scenario.end_date(),
        rolled.final_balance,
        annual_rate,
    )?;
    Ok(AccountProjection {
        account_id: account.id(),
        included: account.included(),
        annual_rate,
        rolled_forward: RolledForward {
            contributions: rolled.total_contributions,
            interest: rolled.total_interest,
        },
        series,
    })
}

/// Each figure is summed from 0 over the included accounts in file order. The months come from
/// the range, so the total has a row for each month even with no included account.
fn total_of<'a>(
    scenario: &Scenario,
    accounts: &[AccountProjection<'_>],
) -> Result<Series, ProjectionError<'a>> {
    let mut total = Series {
        start_balance: 0.0,
        final_balance: 0.0,
        total_contributions: 0.0,
        total_interest: 0.0,
        monthly: month_segments(scenario.today(), scenario.end_date())
            .map(|segment| MonthlyRow {
                year: segment.from().year(),
                month: segment.from().month(),
                balance: 0.0,
                contributions: 0.0,
                interest: 0.0,
            })
            .collect(),
        yearly: Vec::new(),
    };
    for series in accounts
        .iter()
        .filter(|account| account.included)
        .map(|account| &account.series)
    {
        total.start_balance += series.start_balance;
        total.final_balance += series.final_balance;
        total.total_contributions += series.total_contributions;
        total.total_interest += series.total_interest;
        for (sum, row) in total.monthly.iter_mut().zip(&series.monthly) {
            sum.balance += row.balance;
            sum.contributions += row.contributions;
            sum.interest += row.interest;
        }
    }
    let rows_are_finite = total.monthly.iter().all(|row| {
        row.balance.is_finite() && row.contributions.is_finite() && row.interest.is_finite()
    });
    if !(total.start_balance.is_finite() && rows_are_finite) {
        return Err(ProjectionError::ScenarioNotFinite);
    }
    total.yearly = yearly_rows(&total.monthly);
    Ok(total)
}

#[cfg(test)]
mod tests;
