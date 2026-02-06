export type CompoundingFrequency = 'monthly' | 'daily';
export type ContributionFrequency = 'monthly' | 'annual' | 'oneTime';
export type ContributionType = 'flat' | 'salaryPercent';
export type Placement = 'start' | 'end';

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

export type ContributionTiming
  = | ContributionTimingOneTime
    | ContributionTimingMonthly
    | ContributionTimingAnnual;

export type SalaryBasis = 'annual' | 'monthly' | 'biweekly' | 'weekly' | 'daily' | 'perContribution';
export interface ContributionRule {
  id: string;
  name?: string;
  enabled?: boolean;
  type: ContributionType;
  amount: number;
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
  /** Used to anchor the starting month for projection. Defaults to now. */
  startDate?: Date | string;
  /** Interest rate and variance */
  interest: Interest;
  /** Salary assumptions, required for salaryPercent contributions */
  salary: SalaryConfig;
  /** Contribution rules */
  contributions: ContributionRule[];
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
  yearlyProjections: AnnualProjection[];
  monthlyProjections: MonthlyProjection[];
}

export type ProjectionByVariance = Record<'baseline' | 'positive' | 'negative', Projection>;
