export type CompoundingFrequency = 'monthly' | 'daily';
export type ContributionType = 'flat' | 'salaryPercent';

export interface Interest {
  annualRate: number;
  variance?: number;
  compounding?: CompoundingFrequency;
}

export interface SalaryConfig {
  /** Annual base salary. */
  annualBase: number;
  /** Annual raise rate applied at the start of each projection year. Default: 0. */
  annualRaiseRate?: number;
}

export interface YearRange {
  /** Relative start year (0 = first year of projection). Default: 0 */
  start?: number;
  /** Relative end year (inclusive). Default: timeHorizonYears */
  end?: number;
}

export interface ContributionTimingOneTime {
  frequency: 'oneTime';
  on: {
    /** 0-11 */
    month: number;
    /** 0-based projection year */
    year: number;
    /** 1-31 (used when compounding daily). */
    day?: number;
  };
}

export interface ContributionTimingMonthly {
  frequency: 'monthly';
  /** 1-31 (used when compounding daily). */
  day?: number;
  /** Used when compounding monthly or when day is not provided. Default: 'start' */
  placement?: 'start' | 'end';
}

export interface ContributionTimingAnnual {
  frequency: 'annual';
  /** 0-11 */
  month: number;
  /** 1-31 (used when compounding daily). */
  day?: number;
  /** Used when compounding monthly or when day is not provided. Default: 'start' */
  placement?: 'start' | 'end';
}

export type ContributionTiming =
  | ContributionTimingOneTime
  | ContributionTimingMonthly
  | ContributionTimingAnnual;

export type SalaryBasis =
  | 'annual'
  | 'monthly'
  | 'biweekly'
  | 'weekly'
  | 'daily'
  | 'perContribution';
export interface ContributionGrowth {
  type: 'percent' | 'flat';
  /** Percent points if type='percent'; currency/absolute units if type='flat'. */
  amount: number;
  cadence: 'annual' | 'monthly';
}

export interface ContributionRule {
  id: string;
  name?: string;
  enabled?: boolean;
  type: ContributionType;
  amount: number;
  growth?: ContributionGrowth;
  /** Only applies to salaryPercent contributions. Default: 'annual'. */
  salaryBasis?: SalaryBasis;
  timing: ContributionTiming;
  yearRange?: YearRange;
}

export interface RetirementConfig {
  /** Current investment balance */
  currentBalance: number;
  /** Time horizon in years */
  timeHorizonYears: number;
  /** Anchors the starting month of the projection, as an ISO date-time. */
  startDate?: string;
  /** Interest rate and variance */
  interest: Interest;
  /** Salary assumptions, required for salaryPercent contributions */
  salary: SalaryConfig;
  /** Contribution rules */
  contributions: Array<ContributionRule>;
}

interface BaseProjection {
  balance: number;
  contributions: number;
  interest: number;
  salary: number;
}

export interface MonthlyProjection extends BaseProjection {
  /** 0-11 */
  month: number;
  /** 0-based projection year */
  year: number;
}

export interface AnnualProjection extends BaseProjection {
  /** 0-based projection year */
  year: number;
}

export interface Projection {
  finalBalance: number;
  totalContributions: number;
  totalGrowth: number;
  yearlyProjections: Array<AnnualProjection>;
  monthlyProjections: Array<MonthlyProjection>;
}

export type ProjectionByVariance = Record<'baseline' | 'positive' | 'negative', Projection>;

export interface ContributionDetail {
  id: string;
  type: ContributionType;
  amount: number;
  timing: ContributionTiming;
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
  compounding: CompoundingFrequency;
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
