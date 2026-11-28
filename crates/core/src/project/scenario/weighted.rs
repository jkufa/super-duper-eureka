use serde::Serialize;

use super::{AccountProjection, BandProjection};
use crate::project::{MonthlyRow, ProjectionError, YearlyRow};

/// The baseline band, whose total's yearly rows carry the balance-weighted rate.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BaselineProjection<'a> {
    total: WeightedSeries,
    accounts: Vec<AccountProjection<'a>>,
}

impl<'a> BaselineProjection<'a> {
    /// The included accounts summed row by row in file order, each sum starting from 0.
    pub fn total(&self) -> &WeightedSeries {
        &self.total
    }

    /// Every account, in file order.
    pub fn accounts(&self) -> &[AccountProjection<'a>] {
        &self.accounts
    }
}

/// A [`Series`](crate::project::Series) whose yearly rows carry the balance-weighted rate.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeightedSeries {
    start_balance: f64,
    final_balance: f64,
    total_contributions: f64,
    total_interest: f64,
    monthly: Vec<MonthlyRow>,
    yearly: Vec<WeightedYearlyRow>,
}

impl WeightedSeries {
    /// The balance at the start of the range.
    pub fn start_balance(&self) -> f64 {
        self.start_balance
    }

    pub fn final_balance(&self) -> f64 {
        self.final_balance
    }

    pub fn total_contributions(&self) -> f64 {
        self.total_contributions
    }

    pub fn total_interest(&self) -> f64 {
        self.total_interest
    }

    /// One row per calendar month in the range.
    pub fn monthly(&self) -> &[MonthlyRow] {
        &self.monthly
    }

    /// One row per calendar year in the range, at its last counted segment.
    pub fn yearly(&self) -> &[WeightedYearlyRow] {
        &self.yearly
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeightedYearlyRow {
    #[serde(flatten)]
    row: YearlyRow,
    weighted_rate: Option<f64>,
}

impl WeightedYearlyRow {
    pub fn row(self) -> YearlyRow {
        self.row
    }

    /// The included accounts' rates weighted by their balances on this row. `None` when the
    /// total balance is 0.
    pub fn weighted_rate(self) -> Option<f64> {
        self.weighted_rate
    }
}

impl<'a> BandProjection<'a> {
    /// When every included account has the same rate, the weighted rate is that rate. Otherwise
    /// it is the sum, from 0 in file order, of each rate times the account's balance on the row,
    /// divided by the total's balance. A weighted rate that is not finite is `not_finite`.
    pub(super) fn with_weighted_rates(self) -> Result<BaselineProjection<'a>, ProjectionError<'a>> {
        let Self { total, accounts } = self;
        let included: Vec<&AccountProjection<'a>> =
            accounts.iter().filter(|account| account.included).collect();
        let shared_rate = match included.split_first() {
            Some((first, others))
                if others
                    .iter()
                    .all(|other| other.annual_rate == first.annual_rate) =>
            {
                Some(first.annual_rate)
            }
            _ => None,
        };
        let mut weighted_sums = vec![0.0; total.yearly.len()];
        for account in &included {
            for (sum, row) in weighted_sums.iter_mut().zip(&account.series.yearly) {
                *sum += account.annual_rate * row.balance;
            }
        }
        let yearly = total
            .yearly
            .iter()
            .zip(weighted_sums)
            .map(|(&row, weighted_sum)| {
                let weighted_rate =
                    (row.balance != 0.0).then(|| shared_rate.unwrap_or(weighted_sum / row.balance));
                if weighted_rate.is_some_and(|rate| !rate.is_finite()) {
                    return Err(ProjectionError::ScenarioNotFinite);
                }
                Ok(WeightedYearlyRow { row, weighted_rate })
            })
            .collect::<Result<_, _>>()?;
        Ok(BaselineProjection {
            total: WeightedSeries {
                start_balance: total.start_balance,
                final_balance: total.final_balance,
                total_contributions: total.total_contributions,
                total_interest: total.total_interest,
                monthly: total.monthly,
                yearly,
            },
            accounts,
        })
    }
}
