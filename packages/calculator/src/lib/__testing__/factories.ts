import type { AccountFile, ContributionRuleFile, ScenarioFile } from '../scenario';

export const FACTORY_TODAY = '2026-01-01';

export interface ScenarioFileOverrides extends Partial<Omit<ScenarioFile, 'interest' | 'salary'>> {
  interest?: Partial<ScenarioFile['interest']>;
  salary?: Partial<ScenarioFile['salary']>;
}

export function makeRule(overrides: Partial<ContributionRuleFile> = {}): ContributionRuleFile {
  return {
    id: 'rule-1',
    type: 'flat',
    amount: 0,
    timing: { frequency: 'monthly', placement: 'start' },
    ...overrides
  };
}

export function makeAccount(overrides: Partial<AccountFile> = {}): AccountFile {
  return {
    id: 'account-1',
    name: 'Account 1',
    kind: 'other',
    included: true,
    balance: 100_000,
    balanceAsOf: FACTORY_TODAY,
    contributions: [],
    ...overrides
  };
}

export function makeScenarioFile(overrides: ScenarioFileOverrides = {}): ScenarioFile {
  const { interest, salary, ...fields } = overrides;
  return {
    version: 1,
    endDate: '2056-01-01',
    accounts: [makeAccount()],
    ...fields,
    interest: { annualRate: 0.05, variance: 0, compounding: 'monthly', ...interest },
    salary: { annualBase: 100_000, annualRaiseRate: 0, asOf: FACTORY_TODAY, ...salary }
  };
}
