import { createHash } from 'node:crypto';

export interface MonthlyStreamRow {
  year: number;
  month: number;
  balance: number;
  contributions: number;
  interest: number;
  salary: number;
}

export interface MonthlyStreamBand {
  finalBalance: number;
  totalContributions: number;
  totalGrowth: number;
  monthly: ReadonlyArray<MonthlyStreamRow>;
}

export type MonthlyStreamBands = Record<'baseline' | 'positive' | 'negative', MonthlyStreamBand>;

export interface StepStreamContribution {
  id: string;
  type: string;
  amount: number;
}

export interface StepStreamRow {
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
  salary: number;
  annualRate: number;
  daysInMonth: number;
  daysInYear: number;
  compounding: string;
  contributionsByDay: Readonly<Record<number, number>>;
  activeContributions: ReadonlyArray<StepStreamContribution>;
}

export interface StepStreamSummary {
  totalSteps: number;
  totalContributions: number;
  totalInterest: number;
  finalBalance: number;
}

export interface StepStreamRun {
  summary: StepStreamSummary;
  steps: ReadonlyArray<StepStreamRow>;
}

type StreamValue = number | string;

const BAND_ORDER = ['baseline', 'positive', 'negative'] as const;

export function formatStreamValue(value: StreamValue): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return Object.is(value, -0) ? '-0' : String(value);
}

function joinStream(values: ReadonlyArray<StreamValue>): string {
  return values.map(formatStreamValue).join(',');
}

export function monthlyStream(bands: MonthlyStreamBands): string {
  return joinStream(
    BAND_ORDER.flatMap((name) => {
      const band = bands[name];
      return [
        band.finalBalance,
        band.totalContributions,
        band.totalGrowth,
        ...band.monthly.flatMap((row) => [
          row.year,
          row.month,
          row.balance,
          row.contributions,
          row.interest,
          row.salary
        ])
      ];
    })
  );
}

function dayAmountPairs(byDay: Readonly<Record<number, number>>): Array<number> {
  return Object.entries(byDay)
    .map(([day, amount]): [number, number] => [Number(day), amount])
    .toSorted(([dayA], [dayB]) => dayA - dayB)
    .flat();
}

export function stepStream(run: StepStreamRun): string {
  const { summary } = run;
  return joinStream([
    summary.totalSteps,
    summary.totalContributions,
    summary.totalInterest,
    summary.finalBalance,
    ...run.steps.flatMap((step) => [
      step.stepIndex,
      step.yearIndex,
      step.monthIndex,
      step.balanceStart,
      step.balanceEnd,
      step.interestEarned,
      step.contributionsThisStep,
      step.totalContributions,
      step.totalInterest,
      step.contributionsStart,
      step.contributionsEnd,
      step.salary,
      step.annualRate,
      step.daysInMonth,
      step.daysInYear,
      step.compounding,
      ...dayAmountPairs(step.contributionsByDay),
      ...step.activeContributions.flatMap((contribution) => [
        contribution.id,
        contribution.type,
        contribution.amount
      ])
    ])
  ]);
}

export function digest(stream: string): string {
  return createHash('sha256').update(stream).digest('hex');
}
