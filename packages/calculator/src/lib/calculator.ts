import { compound, compoundMonth, groupByMonth, totalByBucket } from './compound';
import type { Compounded } from './compound';
import { buildSchedule } from './schedule';
import type { Deposit, Schedule } from './schedule';
import type {
  AnnualProjection,
  ContributionRule,
  ContributionTiming,
  ContributionType,
  MonthlyProjection,
  Projection,
  ProjectionByVariance,
  RetirementConfig
} from './types';

const MONTHS_PER_YEAR = 12;

export function calculateRetirement(config: RetirementConfig): ProjectionByVariance {
  const { annualRate, variance } = config.interest;
  const schedule = buildSchedule(config);
  const baseline = projectSchedule(config, schedule, annualRate);

  if (variance === undefined || variance === 0) {
    return {
      baseline,
      positive: baseline,
      negative: baseline
    };
  }

  const positive = projectSchedule(config, schedule, annualRate + variance);
  const negative = projectSchedule(config, schedule, annualRate - variance);
  return { baseline, positive, negative };
}

export function calculateProjection(config: RetirementConfig, annualRate: number): Projection {
  return projectSchedule(config, buildSchedule(config), annualRate);
}

export interface ProjectionStep {
  stepIndex: number;
  yearIndex: number;
  monthIndex: number;
  balanceStart: number;
  balanceEnd: number;
  interestEarned: number;
  contributionsThisStep: number;
  totalContributions: number;
  totalInterest: number;
  contributionsStart: number;
  contributionsEnd: number;
  contributionsByDay: Record<number, number>;
  salary: number;
  compounding: 'monthly' | 'daily';
  annualRate: number;
  daysInMonth: number;
  daysInYear: number;
  activeContributions: Array<ContributionDetail>;
}

export interface ProjectionStepSummary {
  totalSteps: number;
  totalContributions: number;
  totalInterest: number;
  finalBalance: number;
}

export interface ProjectionRun {
  projection: Projection;
  steps: Array<ProjectionStep>;
  summary: ProjectionStepSummary;
}

export function calculateProjectionWithSteps(
  config: RetirementConfig,
  annualRate: number,
  options?: { includeContributionDetails?: boolean }
): ProjectionRun {
  const schedule = buildSchedule(config);
  const projection = projectSchedule(config, schedule, annualRate);
  const steps = traceSteps(
    config,
    schedule,
    annualRate,
    options?.includeContributionDetails ?? true
  );

  return {
    projection,
    steps,
    summary: {
      totalSteps: steps.length,
      totalContributions: projection.totalContributions,
      totalInterest: projection.totalGrowth,
      finalBalance: projection.finalBalance
    }
  };
}

interface ContributionDetail {
  id: string;
  type: ContributionType;
  amount: number;
  timing: ContributionTiming;
}

function projectSchedule(
  config: RetirementConfig,
  schedule: Schedule,
  annualRate: number
): Projection {
  return toProjection(compound(config.currentBalance, schedule, annualRate));
}

function toProjection(compounded: Compounded): Projection {
  const monthlyProjections: Array<MonthlyProjection> = [];
  const yearlyProjections: Array<AnnualProjection> = [];

  for (const [monthOffset, row] of compounded.monthly.entries()) {
    const { month, balance, contributions, interest } = row;
    monthlyProjections.push({
      month: month.monthIndex,
      year: month.yearIndex,
      balance,
      contributions,
      interest,
      salary: month.salary
    });

    if (month.monthIndex === MONTHS_PER_YEAR - 1 || monthOffset + 1 >= compounded.monthly.length) {
      yearlyProjections.push({
        year: month.yearIndex,
        balance,
        contributions,
        interest,
        salary: month.salary
      });
    }
  }

  return {
    finalBalance: compounded.finalBalance,
    totalContributions: compounded.totalContributions,
    totalGrowth: compounded.totalInterest,
    yearlyProjections,
    monthlyProjections
  };
}

function traceSteps(
  config: RetirementConfig,
  schedule: Schedule,
  annualRate: number,
  includeContributionDetails: boolean
): Array<ProjectionStep> {
  const steps: Array<ProjectionStep> = [];
  let balance = config.currentBalance;
  let totalContributions = 0;
  let totalInterest = 0;

  for (const [monthOffset, { month, deposits }] of groupByMonth(schedule).entries()) {
    const totals = totalByBucket(deposits);
    const result = compoundMonth(balance, totals, month, schedule.compounding, annualRate);
    totalContributions += result.contributions;
    totalInterest += result.interest;

    steps.push({
      stepIndex: monthOffset,
      yearIndex: month.yearIndex,
      monthIndex: month.monthIndex,
      balanceStart: balance,
      balanceEnd: result.balance,
      interestEarned: result.interest,
      contributionsThisStep: result.contributions,
      totalContributions,
      totalInterest,
      contributionsStart: totals.start,
      contributionsEnd: totals.end,
      contributionsByDay: Object.fromEntries(totals.byDay),
      salary: month.salary,
      compounding: schedule.compounding,
      annualRate,
      daysInMonth: month.daysInMonth,
      daysInYear: month.daysInYear,
      activeContributions: includeContributionDetails
        ? deposits.map((deposit) => contributionDetail(config.contributions, deposit))
        : []
    });
    balance = result.balance;
  }

  return steps;
}

function contributionDetail(rules: Array<ContributionRule>, deposit: Deposit): ContributionDetail {
  const rule = rules[deposit.ruleIndex];
  if (!rule) {
    throw new Error(
      `Deposit for rule "${deposit.ruleId}" points at rule ${String(deposit.ruleIndex)}, which does not exist.`
    );
  }
  return { id: deposit.ruleId, type: rule.type, amount: deposit.amount, timing: rule.timing };
}
