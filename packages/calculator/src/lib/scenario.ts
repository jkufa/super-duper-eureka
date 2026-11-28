import type { PlainDate } from './plain-date';

/** 'YYYY-MM-DD' in files. A date means the start of that day. */
export type PlainDateString = string;

export type Compounding = 'monthly' | 'daily';
export type AccountKind = 'pretax' | 'roth' | 'taxable' | 'other';
export type RuleType = 'flat' | 'salaryPercent';
export type RuleSalaryBasis =
  | 'annual'
  | 'monthly'
  | 'biweekly'
  | 'weekly'
  | 'daily'
  | 'perContribution';

export interface RuleGrowth {
  type: 'percent' | 'flat';
  amount: number;
  cadence: 'annual' | 'monthly';
}

export interface ScenarioFile {
  version: 1;
  /** Boundary. The last day counted is the day before it. */
  endDate: PlainDateString;
  interest: {
    annualRate: number;
    variance?: number;
    compounding?: Compounding;
  };
  salary: {
    annualBase: number;
    annualRaiseRate?: number;
    /** The date annualBase was true. Raises apply on each 1 January after it. */
    asOf: PlainDateString;
  };
  accounts: Array<AccountFile>;
}

export interface AccountFile {
  id: string;
  name: string;
  kind: AccountKind;
  included: boolean;
  balance: number;
  /** The balance is true at the start of this day. */
  balanceAsOf: PlainDateString;
  /** Overrides interest.annualRate for this account. */
  annualRate?: number;
  contributions: Array<ContributionRuleFile>;
}

export type RuleTiming =
  | { frequency: 'oneTime'; on: PlainDateString }
  | { frequency: 'monthly'; day?: number; placement?: 'start' | 'end' }
  | { frequency: 'annual'; month: number; day?: number; placement?: 'start' | 'end' };

export interface ContributionRuleFile {
  id: string;
  name?: string;
  /** Default true. */
  enabled?: boolean;
  type: RuleType;
  /** The amount on startDate when growth is set. */
  amount: number;
  salaryBasis?: RuleSalaryBasis;
  growth?: RuleGrowth;
  timing: RuleTiming;
  /** Recurring rules only. First day the rule can deposit. Required when growth is set. */
  startDate?: PlainDateString;
  /** Recurring rules only. Last day the rule can deposit, inclusive. */
  endDate?: PlainDateString;
}

export interface RunOptions {
  /** Results start at the start of this day. The engine never reads the clock. */
  today: PlainDateString;
}

export interface Scenario {
  endDate: PlainDate;
  interest: { annualRate: number; variance: number; compounding: Compounding };
  salary: { annualBase: number; annualRaiseRate: number; asOf: PlainDate };
  accounts: Array<Account>;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  included: boolean;
  balance: number;
  balanceAsOf: PlainDate;
  annualRate?: number;
  contributions: Array<Rule>;
}

export type Timing =
  | { frequency: 'oneTime'; on: PlainDate }
  | { frequency: 'monthly'; day?: number; placement: 'start' | 'end' }
  | { frequency: 'annual'; month: number; day?: number; placement: 'start' | 'end' };

export interface Rule {
  id: string;
  name?: string;
  enabled: boolean;
  type: RuleType;
  amount: number;
  salaryBasis: RuleSalaryBasis;
  growth?: RuleGrowth;
  timing: Timing;
  startDate?: PlainDate;
  endDate?: PlainDate;
}
