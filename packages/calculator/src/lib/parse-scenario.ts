import { compareDates, daysInMonth, parsePlainDate } from './plain-date';
import type { PlainDate } from './plain-date';
import type { Account, Rule, RuleGrowth, RunOptions, Scenario, Timing } from './scenario';

export type ScenarioErrorCode =
  | 'invalid_field'
  | 'unsupported_version'
  | 'invalid_date'
  | 'end_not_after_today'
  | 'as_of_in_future'
  | 'negative_balance'
  | 'invalid_rate'
  | 'negative_amount'
  | 'duplicate_id'
  | 'invalid_day'
  | 'growth_without_start'
  | 'growth_on_one_time'
  | 'rule_end_before_start'
  | 'per_contribution_on_one_time';

interface Subject {
  accountId?: string;
  ruleId?: string;
}

export class ScenarioError extends Error {
  readonly code: ScenarioErrorCode;
  readonly path: string;
  readonly accountId: string | undefined;
  readonly ruleId: string | undefined;

  constructor(code: ScenarioErrorCode, path: string, problem: string, subject: Subject) {
    super(`${code} at ${path || 'the root'}: ${problem}.`);
    this.name = 'ScenarioError';
    this.code = code;
    this.path = path;
    this.accountId = subject.accountId;
    this.ruleId = subject.ruleId;
  }
}

/** An object from the file, with where it sits and whose it is. */
interface Source {
  fields: Map<string, unknown>;
  path: string;
  subject: Subject;
}

const SCENARIO_KEYS = ['version', 'endDate', 'interest', 'salary', 'accounts'];
const INTEREST_KEYS = ['annualRate', 'variance', 'compounding'];
const SALARY_KEYS = ['annualBase', 'annualRaiseRate', 'asOf'];
const ACCOUNT_KEYS = [
  'id',
  'name',
  'kind',
  'included',
  'balance',
  'balanceAsOf',
  'annualRate',
  'contributions'
];
const ONE_TIME_RULE_KEYS = [
  'id',
  'name',
  'enabled',
  'type',
  'amount',
  'salaryBasis',
  'growth',
  'timing'
];
const RULE_KEYS = [...ONE_TIME_RULE_KEYS, 'startDate', 'endDate'];
const GROWTH_KEYS = ['type', 'amount', 'cadence'];
const TIMING_KEYS = {
  oneTime: ['frequency', 'on'],
  monthly: ['frequency', 'day', 'placement'],
  annual: ['frequency', 'month', 'day', 'placement']
} as const;
const ANY_TIMING_KEYS = ['frequency', 'on', 'month', 'day', 'placement'];
const SALARY_BASES = [
  'annual',
  'monthly',
  'biweekly',
  'weekly',
  'daily',
  'perContribution'
] as const;
const ANY_LEAP_YEAR = 2000;
const MONTHS_PER_YEAR = 12;
const MAX_DAY = 31;

function fail(code: ScenarioErrorCode, path: string, problem: string, subject: Subject): never {
  throw new ScenarioError(code, path, problem, subject);
}

function childPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function pathOf(source: Source, key: string): string {
  return childPath(source.path, key);
}

function failField(source: Source, key: string, expected: string): never {
  const problem = source.fields.has(key) ? `expected ${expected}` : 'missing';
  return fail('invalid_field', pathOf(source, key), problem, source.subject);
}

function toSource(value: unknown, path: string, subject: Subject): Source {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('invalid_field', path, 'expected an object', subject);
  }
  return { fields: new Map(Object.entries(value)), path, subject };
}

function checkKeys(source: Source, keys: ReadonlyArray<string>) {
  const unexpected = [...source.fields.keys()].find((key) => !keys.includes(key));
  if (unexpected !== undefined) {
    fail('invalid_field', pathOf(source, unexpected), 'unexpected key', source.subject);
  }
}

function readObject(
  value: unknown,
  path: string,
  keys: ReadonlyArray<string>,
  subject: Subject
): Source {
  const source = toSource(value, path, subject);
  checkKeys(source, keys);
  return source;
}

function objectAt(
  source: Source,
  key: string,
  keys: ReadonlyArray<string>,
  subject = source.subject
): Source {
  return readObject(source.fields.get(key), pathOf(source, key), keys, subject);
}

function arrayAt(source: Source, key: string): Array<unknown> {
  const value = source.fields.get(key);
  return Array.isArray(value) ? value : failField(source, key, 'an array');
}

function numberAt(source: Source, key: string): number {
  const value = source.fields.get(key);
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : failField(source, key, 'a finite number');
}

function rateAt(source: Source, key: string): number {
  const value = source.fields.get(key);
  if (typeof value !== 'number') {
    return failField(source, key, 'a number');
  }
  return Number.isFinite(value)
    ? value
    : fail('invalid_rate', pathOf(source, key), 'not finite', source.subject);
}

function stringAt(source: Source, key: string): string {
  const value = source.fields.get(key);
  return typeof value === 'string' ? value : failField(source, key, 'a string');
}

function booleanAt(source: Source, key: string): boolean {
  const value = source.fields.get(key);
  return typeof value === 'boolean' ? value : failField(source, key, 'a boolean');
}

function oneOfAt<T extends string>(source: Source, key: string, options: ReadonlyArray<T>): T {
  const value = source.fields.get(key);
  return options.find((option) => option === value) ?? failField(source, key, options.join(' | '));
}

function dateAt(source: Source, key: string): PlainDate {
  return (
    parsePlainDate(stringAt(source, key)) ??
    fail('invalid_date', pathOf(source, key), 'not a real YYYY-MM-DD date', source.subject)
  );
}

function wholeNumberAt(source: Source, key: string, max: number): number {
  const value = numberAt(source, key);
  return Number.isInteger(value) && value >= 1 && value <= max
    ? value
    : fail(
        'invalid_day',
        pathOf(source, key),
        `expected a whole number from 1 to ${String(max)}`,
        source.subject
      );
}

function checkNotNegative(code: ScenarioErrorCode, source: Source, key: string, value: number) {
  if (value < 0) {
    fail(code, pathOf(source, key), 'below 0', source.subject);
  }
}

function checkRateAgainstVariance(source: Source, key: string, rate: number, variance: number) {
  if (rate - variance <= -1) {
    fail(
      'invalid_rate',
      pathOf(source, key),
      'the rate minus the variance is at or below -1',
      source.subject
    );
  }
}

function parseTiming(source: Source): Timing {
  const frequency = oneOfAt(source, 'frequency', ['oneTime', 'monthly', 'annual'] as const);
  checkKeys(source, TIMING_KEYS[frequency]);
  if (frequency === 'oneTime') {
    return { frequency, on: dateAt(source, 'on') };
  }

  const placement = source.fields.has('placement')
    ? oneOfAt(source, 'placement', ['start', 'end'] as const)
    : 'start';
  const day = source.fields.has('day') ? wholeNumberAt(source, 'day', MAX_DAY) : undefined;
  if (frequency === 'monthly') {
    return day === undefined ? { frequency, placement } : { frequency, day, placement };
  }

  const month = wholeNumberAt(source, 'month', MONTHS_PER_YEAR);
  if (day === undefined) {
    return { frequency, month, placement };
  }
  if (day > daysInMonth(ANY_LEAP_YEAR, month)) {
    fail('invalid_day', pathOf(source, 'day'), 'the month never has this day', source.subject);
  }
  return { frequency, month, day, placement };
}

function parseGrowth(source: Source): RuleGrowth {
  const growth = {
    type: oneOfAt(source, 'type', ['percent', 'flat'] as const),
    amount: numberAt(source, 'amount'),
    cadence: oneOfAt(source, 'cadence', ['annual', 'monthly'] as const)
  };
  checkNotNegative('negative_amount', source, 'amount', growth.amount);
  return growth;
}

function parseRule(value: unknown, path: string, accountId: string): Rule {
  const source = readObject(value, path, RULE_KEYS, { accountId });
  const id = stringAt(source, 'id');
  source.subject = { accountId, ruleId: id };
  const timing = parseTiming(objectAt(source, 'timing', ANY_TIMING_KEYS));
  const isOneTime = timing.frequency === 'oneTime';
  checkKeys(source, isOneTime ? ONE_TIME_RULE_KEYS : RULE_KEYS);

  const rule: Rule = {
    id,
    enabled: source.fields.has('enabled') ? booleanAt(source, 'enabled') : true,
    type: oneOfAt(source, 'type', ['flat', 'salaryPercent'] as const),
    amount: numberAt(source, 'amount'),
    salaryBasis: source.fields.has('salaryBasis')
      ? oneOfAt(source, 'salaryBasis', SALARY_BASES)
      : 'annual',
    timing
  };
  checkNotNegative('negative_amount', source, 'amount', rule.amount);
  if (source.fields.has('name')) {
    rule.name = stringAt(source, 'name');
  }
  if (source.fields.has('growth')) {
    rule.growth = parseGrowth(objectAt(source, 'growth', GROWTH_KEYS));
  }
  if (source.fields.has('startDate')) {
    rule.startDate = dateAt(source, 'startDate');
  }
  if (source.fields.has('endDate')) {
    rule.endDate = dateAt(source, 'endDate');
  }

  if (isOneTime && rule.growth) {
    fail(
      'growth_on_one_time',
      pathOf(source, 'growth'),
      'a one-time rule cannot grow',
      source.subject
    );
  }
  if (isOneTime && rule.salaryBasis === 'perContribution') {
    fail(
      'per_contribution_on_one_time',
      pathOf(source, 'salaryBasis'),
      'a one-time rule cannot use perContribution',
      source.subject
    );
  }
  if (rule.growth && !rule.startDate) {
    fail(
      'growth_without_start',
      pathOf(source, 'startDate'),
      'growth needs a start date',
      source.subject
    );
  }
  if (rule.startDate && rule.endDate && compareDates(rule.endDate, rule.startDate) < 0) {
    fail(
      'rule_end_before_start',
      pathOf(source, 'endDate'),
      'before the start date',
      source.subject
    );
  }
  return rule;
}

function parseAccount(value: unknown, path: string, today: PlainDate, variance: number): Account {
  const source = readObject(value, path, ACCOUNT_KEYS, {});
  const id = stringAt(source, 'id');
  source.subject = { accountId: id };
  const contributionsPath = pathOf(source, 'contributions');

  const account: Account = {
    id,
    name: stringAt(source, 'name'),
    kind: oneOfAt(source, 'kind', ['pretax', 'roth', 'taxable', 'other'] as const),
    included: booleanAt(source, 'included'),
    balance: numberAt(source, 'balance'),
    balanceAsOf: dateAt(source, 'balanceAsOf'),
    contributions: arrayAt(source, 'contributions').map((rule, index) =>
      parseRule(rule, `${contributionsPath}[${String(index)}]`, id)
    )
  };
  checkNotNegative('negative_balance', source, 'balance', account.balance);
  if (compareDates(account.balanceAsOf, today) > 0) {
    fail('as_of_in_future', pathOf(source, 'balanceAsOf'), 'after today', source.subject);
  }
  if (source.fields.has('annualRate')) {
    account.annualRate = rateAt(source, 'annualRate');
    checkRateAgainstVariance(source, 'annualRate', account.annualRate, variance);
  }
  return account;
}

function checkUniqueIds(accounts: Array<Account>) {
  const accountIds = new Set<string>();
  const ruleIds = new Set<string>();
  for (const [accountIndex, account] of accounts.entries()) {
    const accountPath = `accounts[${String(accountIndex)}]`;
    if (accountIds.has(account.id)) {
      fail('duplicate_id', `${accountPath}.id`, 'another account has this id', {
        accountId: account.id
      });
    }
    accountIds.add(account.id);
    for (const [ruleIndex, rule] of account.contributions.entries()) {
      if (ruleIds.has(rule.id)) {
        fail(
          'duplicate_id',
          `${accountPath}.contributions[${String(ruleIndex)}].id`,
          'another rule has this id',
          { accountId: account.id, ruleId: rule.id }
        );
      }
      ruleIds.add(rule.id);
    }
  }
}

export function parseScenario(file: unknown, options: RunOptions): Scenario {
  const source = toSource(file, '', {});
  if (source.fields.get('version') !== 1) {
    fail('unsupported_version', 'version', 'expected 1', {});
  }
  checkKeys(source, SCENARIO_KEYS);
  const today = dateAt(toSource(options, '', {}), 'today');

  const interest = objectAt(source, 'interest', INTEREST_KEYS);
  const annualRate = rateAt(interest, 'annualRate');
  const variance = interest.fields.has('variance') ? rateAt(interest, 'variance') : 0;
  checkNotNegative('invalid_rate', interest, 'variance', variance);
  checkRateAgainstVariance(interest, 'annualRate', annualRate, variance);
  const compounding = interest.fields.has('compounding')
    ? oneOfAt(interest, 'compounding', ['monthly', 'daily'] as const)
    : 'monthly';

  const salary = objectAt(source, 'salary', SALARY_KEYS);
  const annualBase = numberAt(salary, 'annualBase');
  checkNotNegative('negative_amount', salary, 'annualBase', annualBase);
  const annualRaiseRate = salary.fields.has('annualRaiseRate')
    ? rateAt(salary, 'annualRaiseRate')
    : 0;
  const asOf = dateAt(salary, 'asOf');

  const endDate = dateAt(source, 'endDate');
  if (compareDates(endDate, today) <= 0) {
    fail('end_not_after_today', 'endDate', 'on or before today', {});
  }

  const accounts = arrayAt(source, 'accounts').map((account, index) =>
    parseAccount(account, `accounts[${String(index)}]`, today, variance)
  );
  checkUniqueIds(accounts);

  return {
    endDate,
    interest: { annualRate, variance, compounding },
    salary: { annualBase, annualRaiseRate, asOf },
    accounts
  };
}
