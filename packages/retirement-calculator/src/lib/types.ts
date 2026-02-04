import type { Prettify } from './utils';

export type Frequency = 'annual' | 'monthly';
export type FrequencyExtended = Prettify<Frequency | 'oneTime'>;

export type ContributionType = 'flat' | 'salaryPercent';

export interface Interest {
  rate: number;
  variance: number;
  frequency: Frequency;
}

export interface Salary {
  base: number;
  cap: number;
  raise: Raise;
}

export interface Raise {
  type: ContributionType;
  rate: number;
  frequency: Frequency;
}

export interface Contribution {
  type: ContributionType;
  amount: number;
}

export interface YearRange {
  /** Start year (0 = first year of projection). Default: 0 */
  start: number;
  /** End year (inclusive). Default: timeHorizon */
  end: number;
}

export interface BaseTiming {
  frequency: FrequencyExtended;
  yearRange: YearRange;
}

export interface TimingOneTime extends BaseTiming {
  frequency: 'oneTime';
  /** 1-12, when in the year this contribution occur */
  month: number;
  /** Which year this contribution occur */
  year: number;
}

export interface TimingMonthly extends BaseTiming {
  frequency: 'monthly';
  /** 0-30, when in the month this contribution occur. Right now treating it as either start of month or end of month. */
  // day: 0 | 30;
  when: 'start' | 'end';
}

export interface TimingAnnual extends BaseTiming {
  frequency: 'annual';
  /** Which month (1-12) */
  month: number;
  when: 'start' | 'end';
}

export type Timing = Prettify<TimingOneTime | TimingMonthly | TimingAnnual>;

export interface BaseCustomVariable {
  id: string;
  name: string;
  enabled: boolean;
  contribution: Contribution;
  timing: Timing;
}

export type OneTimeVariable = Prettify<BaseCustomVariable & { timing: TimingOneTime }>;
export type MonthlyVariable = Prettify<BaseCustomVariable & { timing: TimingMonthly; raise?: Raise }>;
export type AnnualVariable = Prettify<BaseCustomVariable & { timing: TimingAnnual; raise?: Raise }>;

export type CustomVariable = Prettify<OneTimeVariable | MonthlyVariable | AnnualVariable>;
export interface CustomVariablesByFrequency {
  oneTime: OneTimeVariable[];
  monthly: MonthlyVariable[];
  annual: AnnualVariable[];
}

interface BaseProjection {
  balance: number;
  contributions: number;
  interest: number;
  salary: number;
}
export interface AnnualProjection extends BaseProjection { year: number }

export interface MonthlyProjection extends BaseProjection { month: number; year: number }

export interface Projection {
  finalBalance: number;
  totalContributions: number;
  totalGrowth: number;
  yearlyProjections: AnnualProjection[];
  monthlyProjections: MonthlyProjection[];
}
export type ProjectionByVariance = Record<'baseline' | 'positive' | 'negative', Projection>;
