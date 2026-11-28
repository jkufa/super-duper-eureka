import { salaryInYear } from '../account-schedule';
import { totalByBucket } from '../compound';
import { addMonths, daysInMonth, formatPlainDate, parsePlainDate } from '../plain-date';
import type { PlainDate } from '../plain-date';
import { parseScenario } from '../parse-scenario';
import { projectAccount, traceAccountRange } from '../project-account';
import { projectScenario, traceAccount } from '../project-scenario';
import type { Row, Series, TraceSegment } from '../project-account';
import type {
  ContributionRuleFile,
  PlainDateString,
  RuleTiming,
  Scenario,
  ScenarioFile
} from '../scenario';
import type {
  ContributionRule,
  ContributionTimingAnnual,
  ContributionTimingMonthly,
  Projection,
  ProjectionByVariance,
  ProjectionRun,
  ProjectionStep,
  RetirementConfig
} from './legacy-config';

const MONTHS_PER_YEAR = 12;
const ANY_LEAP_YEAR = 2000;
export const LEGACY_ACCOUNT_ID = 'legacy';

export interface LegacyScenario {
  scenario: ScenarioFile;
  today: PlainDateString;
}

export function legacyStartDate(config: RetirementConfig): PlainDate {
  if (typeof config.startDate !== 'string') {
    throw new TypeError('The adapter needs the config to carry its start date as a string.');
  }
  const parsed = new Date(config.startDate);
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate()
  };
}

export function legacyToScenario(config: RetirementConfig): LegacyScenario {
  const start = legacyStartDate(config);
  const horizon = config.timeHorizonYears;
  if (!Number.isInteger(horizon)) {
    throw new RangeError(`The adapter needs a whole-year horizon (received ${String(horizon)}).`);
  }
  const today = formatPlainDate(start);

  return {
    today,
    scenario: {
      version: 1,
      endDate: formatPlainDate(addMonths(start, horizon * MONTHS_PER_YEAR)),
      interest: { ...config.interest },
      salary: { ...config.salary, asOf: today },
      accounts: [
        {
          id: LEGACY_ACCOUNT_ID,
          name: 'Legacy',
          kind: 'other',
          included: true,
          balance: config.currentBalance,
          balanceAsOf: today,
          contributions: config.contributions.flatMap((rule) =>
            toRuleFiles(rule, start.year, horizon)
          )
        }
      ]
    }
  };
}

function toRuleFiles(
  rule: ContributionRule,
  startYear: number,
  horizon: number
): Array<ContributionRuleFile> {
  const { timing, yearRange, ...shared } = rule;
  if (timing.frequency === 'oneTime') {
    const year = startYear + timing.on.year;
    const month = timing.on.month + 1;
    const day = Math.min(timing.on.day ?? 1, daysInMonth(year, month));
    return [
      { ...shared, timing: { frequency: 'oneTime', on: formatPlainDate({ year, month, day }) } }
    ];
  }

  const firstYear = startYear + Math.max(0, Math.ceil(yearRange?.start ?? 0));
  const lastYear = startYear + Math.floor(yearRange?.end ?? horizon);
  if (lastYear < firstYear) {
    return [];
  }
  if (rule.growth && firstYear > startYear) {
    throw new RangeError(
      `Rule "${rule.id}" grows from ${String(startYear)} but cannot deposit before ${String(firstYear)}, which the new contract cannot express.`
    );
  }
  return [
    {
      ...shared,
      timing: toRecurringTiming(timing),
      startDate: formatPlainDate({ year: firstYear, month: 1, day: 1 }),
      endDate: formatPlainDate({ year: lastYear, month: 12, day: 31 })
    }
  ];
}

function toRecurringTiming(
  timing: ContributionTimingAnnual | ContributionTimingMonthly
): RuleTiming {
  if (timing.frequency === 'monthly') {
    return { ...timing };
  }
  const month = timing.month + 1;
  return timing.day === undefined
    ? { ...timing, month }
    : { ...timing, month, day: Math.min(timing.day, daysInMonth(ANY_LEAP_YEAR, month)) };
}

export type LegacyBands = Record<'baseline' | 'positive' | 'negative', Series>;

export interface LegacyRows {
  result: ProjectionByVariance;
  steps: ProjectionRun;
}

export function toLegacyRows(
  config: RetirementConfig,
  scenario: Scenario,
  bands: LegacyBands,
  trace: Array<TraceSegment>
): LegacyRows {
  const startYear = legacyStartDate(config).year;
  const toProjection = (series: Series): Projection => ({
    finalBalance: series.finalBalance,
    totalContributions: series.totalContributions,
    totalGrowth: series.totalInterest,
    yearlyProjections: series.yearly.map((row) => ({
      year: row.year - startYear,
      balance: row.balance,
      contributions: row.contributions,
      interest: row.interest,
      salary: salaryInYear(scenario, row.year)
    })),
    monthlyProjections: series.monthly.map((row) => ({
      month: monthOf(row) - 1,
      year: row.year - startYear,
      balance: row.balance,
      contributions: row.contributions,
      interest: row.interest,
      salary: salaryInYear(scenario, row.year)
    }))
  });

  const baseline = bands.baseline;
  const steps = trace.map((segment, stepIndex): ProjectionStep => {
    const { year, month } = parseTraceDate(segment.from);
    const totals = totalByBucket(segment.deposits);
    const row = baseline.monthly[stepIndex];
    if (!row) {
      throw new RangeError(`The trace has step ${String(stepIndex)} and the series does not.`);
    }
    return {
      stepIndex,
      yearIndex: year - startYear,
      monthIndex: month - 1,
      balanceStart: segment.balanceStart,
      balanceEnd: segment.balanceEnd,
      interestEarned: segment.interest,
      contributionsThisStep: segment.contributions,
      totalContributions: row.contributions,
      totalInterest: row.interest,
      contributionsStart: totals.start,
      contributionsEnd: totals.end,
      contributionsByDay: Object.fromEntries(totals.byDay),
      salary: salaryInYear(scenario, year),
      compounding: config.interest.compounding ?? 'monthly',
      annualRate: segment.annualRate,
      daysInMonth: segment.daysInMonth,
      daysInYear: segment.daysInYear,
      activeContributions: segment.deposits.map((deposit) => {
        const rule = ruleById(config, deposit.ruleId);
        return { id: rule.id, type: rule.type, amount: deposit.amount, timing: rule.timing };
      })
    };
  });

  return {
    result: {
      baseline: toProjection(bands.baseline),
      positive: toProjection(bands.positive),
      negative: toProjection(bands.negative)
    },
    steps: {
      projection: toProjection(baseline),
      steps,
      summary: {
        totalSteps: steps.length,
        totalContributions: baseline.totalContributions,
        totalInterest: baseline.totalInterest,
        finalBalance: baseline.finalBalance
      }
    }
  };
}

function monthOf(row: Row): number {
  if (row.month === undefined) {
    throw new TypeError(`A monthly row in ${String(row.year)} has no month.`);
  }
  return row.month;
}

function parseTraceDate(text: PlainDateString): PlainDate {
  const date = parsePlainDate(text);
  if (!date) {
    throw new RangeError(`The trace holds an invalid date: ${text}.`);
  }
  return date;
}

function ruleById(config: RetirementConfig, id: string): ContributionRule {
  const rule = config.contributions.find((candidate) => candidate.id === id);
  if (!rule) {
    throw new RangeError(`The trace names rule "${id}", which the config does not have.`);
  }
  return rule;
}

export function runThroughScenario(config: RetirementConfig): LegacyRows {
  const { scenario: file, today } = legacyToScenario(config);
  const scenario = parseScenario(file, { today });
  const [account] = scenario.accounts;
  if (!account) {
    throw new Error('The adapter produced no account.');
  }
  const { today: from, endDate: to } = scenario;
  const { annualRate, variance } = scenario.interest;
  const project = (rate: number) =>
    projectAccount(scenario, account, from, to, account.balance, rate);

  const baseline = project(annualRate);
  const bands =
    variance === 0
      ? { baseline, positive: baseline, negative: baseline }
      : {
          baseline,
          positive: project(annualRate + variance),
          negative: project(annualRate - variance)
        };
  const trace = traceAccountRange(scenario, account, from, to, account.balance, annualRate);
  return toLegacyRows(config, scenario, bands, trace);
}

export function runThroughProjectScenario(config: RetirementConfig): LegacyRows {
  const { scenario: file, today } = legacyToScenario(config);
  const scenario = parseScenario(file, { today });
  const { baseline, positive, negative } = projectScenario(scenario).bands;
  return toLegacyRows(
    config,
    scenario,
    { baseline: baseline.total, positive: positive.total, negative: negative.total },
    traceAccount(scenario, LEGACY_ACCOUNT_ID, 'baseline')
  );
}
