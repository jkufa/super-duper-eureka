import { monthSegments, salaryInYear } from './account-schedule';
import { effectiveRate } from './effective-rate';
import { ScenarioError } from './parse-scenario';
import { compareDates, formatPlainDate } from './plain-date';
import { projectAccount, traceAccountRange, yearlyRows } from './project-account';
import type { Row, Series, TraceSegment } from './project-account';
import type { Account, PlainDateString, Scenario } from './scenario';

export type Band = 'baseline' | 'positive' | 'negative';

export interface ScenarioProjection {
  today: PlainDateString;
  endDate: PlainDateString;
  /** Baseline only. The one rate at which the included accounts, pooled at today, end on the total. */
  effectiveRate: number;
  /** Included accounts whose balanceAsOf is before today, in scenario order. */
  staleAccounts: Array<{ accountId: string; balanceAsOf: PlainDateString }>;
  salaryByYear: Array<{ year: number; salary: number }>;
  bands: Record<Band, BandProjection>;
}

export interface BandProjection {
  /** The included accounts summed row by row, in scenario order, each sum starting from 0. */
  total: Series;
  /** Every account, in scenario order. */
  accounts: Array<AccountProjection>;
}

export interface AccountProjection {
  accountId: string;
  included: boolean;
  annualRate: number;
  /** What the roll forward added between balanceAsOf and today. Zero when not stale. */
  rolledForward: { contributions: number; interest: number };
  /** From today to endDate. */
  series: Series;
}

export function projectScenario(scenario: Scenario): ScenarioProjection {
  const bands = {
    baseline: withWeightedRates(projectBand(scenario, 'baseline')),
    positive: projectBand(scenario, 'positive'),
    negative: projectBand(scenario, 'negative')
  };
  const included = scenario.accounts
    .filter((account) => account.included)
    .map((account) => ({ account, annualRate: bandRate(scenario, account, 'baseline') }));
  return {
    today: formatPlainDate(scenario.today),
    endDate: formatPlainDate(scenario.endDate),
    effectiveRate: effectiveRate(scenario, included, bands.baseline.total),
    staleAccounts: scenario.accounts
      .filter((account) => account.included && isStale(scenario, account))
      .map((account) => ({
        accountId: account.id,
        balanceAsOf: formatPlainDate(account.balanceAsOf)
      })),
    salaryByYear: bands.baseline.total.yearly.map(({ year }) => ({
      year,
      salary: finiteTotalFigure(`salary in ${String(year)}`, salaryInYear(scenario, year))
    })),
    bands
  };
}

export function traceAccount(
  scenario: Scenario,
  accountId: string,
  band: Band
): Array<TraceSegment> {
  const account =
    scenario.accounts.find((candidate) => candidate.id === accountId) ?? unknownAccount(accountId);
  const rate = bandRate(scenario, account, band);
  const rolled = rollForward(scenario, account, rate);
  return [
    ...traceAccountRange(
      scenario,
      account,
      account.balanceAsOf,
      scenario.today,
      account.balance,
      rate
    ),
    ...traceAccountRange(
      scenario,
      account,
      scenario.today,
      scenario.endDate,
      rolled.finalBalance,
      rate
    )
  ];
}

function unknownAccount(accountId: string): never {
  throw new ScenarioError('unknown_account', '', 'the scenario has no account with this id', {
    accountId
  });
}

function isStale(scenario: Scenario, account: Account): boolean {
  return compareDates(account.balanceAsOf, scenario.today) < 0;
}

function bandRate(scenario: Scenario, account: Account, band: Band): number {
  const rate = account.annualRate ?? scenario.interest.annualRate;
  const { variance } = scenario.interest;
  if (band === 'positive') {
    return rate + variance;
  }
  return band === 'negative' ? rate - variance : rate;
}

function rollForward(scenario: Scenario, account: Account, rate: number): Series {
  return projectAccount(
    scenario,
    account,
    account.balanceAsOf,
    scenario.today,
    account.balance,
    rate
  );
}

function projectBand(scenario: Scenario, band: Band): BandProjection {
  const accounts = scenario.accounts.map((account): AccountProjection => {
    const annualRate = bandRate(scenario, account, band);
    const rolled = rollForward(scenario, account, annualRate);
    return {
      accountId: account.id,
      included: account.included,
      annualRate,
      rolledForward: { contributions: rolled.totalContributions, interest: rolled.totalInterest },
      series: projectAccount(
        scenario,
        account,
        scenario.today,
        scenario.endDate,
        rolled.finalBalance,
        annualRate
      )
    };
  });
  const included = accounts.filter((account) => account.included).map(({ series }) => series);
  return { total: sumSeries(scenario, included), accounts };
}

function withWeightedRates(band: BandProjection): BandProjection {
  const included = band.accounts.filter((account) => account.included);
  const yearly = band.total.yearly.map((row, index): Row => {
    const rate = weightedRate(included, row.balance, index);
    return {
      ...row,
      weightedRate:
        rate === null ? null : finiteTotalFigure(`weighted rate in ${String(row.year)}`, rate)
    };
  });
  return { ...band, total: { ...band.total, yearly } };
}

function weightedRate(
  included: ReadonlyArray<AccountProjection>,
  totalBalance: number,
  index: number
): number | null {
  if (totalBalance === 0) {
    return null;
  }
  const [first, ...others] = included;
  if (first && others.every(({ annualRate }) => annualRate === first.annualRate)) {
    return first.annualRate;
  }
  return (
    included.reduce(
      (sum, { annualRate, series }) => sum + annualRate * yearlyAt(series, index).balance,
      0
    ) / totalBalance
  );
}

function yearlyAt(series: Series, index: number): Row {
  const row = series.yearly[index];
  if (!row) {
    throw new RangeError(`An account has no yearly row ${String(index)}.`);
  }
  return row;
}

function sumSeries(scenario: Scenario, series: ReadonlyArray<Series>): Series {
  const sum = (pick: (one: Series) => number) =>
    series.reduce((total, one) => total + pick(one), 0);
  const monthly = monthSegments(scenario.today, scenario.endDate).map(({ from }, index): Row => ({
    year: from.year,
    month: from.month,
    balance: sum((one) => rowAt(one, index).balance),
    contributions: sum((one) => rowAt(one, index).contributions),
    interest: sum((one) => rowAt(one, index).interest)
  }));
  const total = {
    startBalance: sum((one) => one.startBalance),
    finalBalance: sum((one) => one.finalBalance),
    totalContributions: sum((one) => one.totalContributions),
    totalInterest: sum((one) => one.totalInterest),
    monthly,
    yearly: yearlyRows(monthly)
  };
  checkTotalFinite(total);
  return total;
}

function rowAt(series: Series, index: number): Row {
  const row = series.monthly[index];
  if (!row) {
    throw new RangeError(`An account has no monthly row ${String(index)}.`);
  }
  return row;
}

function checkTotalFinite(total: Series) {
  const figures = [
    ['startBalance', total.startBalance],
    ...total.monthly.flatMap((row) => {
      const at = `${String(row.year)}-${String(row.month).padStart(2, '0')}`;
      return [
        [`balance in ${at}`, row.balance],
        [`contributions in ${at}`, row.contributions],
        [`interest in ${at}`, row.interest]
      ] as const;
    })
  ] as const;
  for (const [figure, value] of figures) {
    finiteTotalFigure(`total ${figure}`, value);
  }
}

function finiteTotalFigure(figure: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new ScenarioError('not_finite', '', `the ${figure} is ${String(value)}`, {});
  }
  return value;
}
