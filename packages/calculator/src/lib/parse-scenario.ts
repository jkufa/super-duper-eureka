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
  | 'per_contribution_on_one_time'
  | 'not_finite'
  | 'unknown_account';

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
    super(path ? `${code} at ${path}: ${problem}.` : `${code}: ${problem}.`);
    this.name = 'ScenarioError';
    this.code = code;
    this.path = path;
    this.accountId = subject.accountId;
    this.ruleId = subject.ruleId;
  }
}

type Writable<T> = { -readonly [K in keyof T]: T[K] };

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

function elementsAt<T>(
  source: Source,
  key: string,
  parse: (value: unknown, path: string) => T
): Array<T> {
  const value = source.fields.get(key);
  if (!Array.isArray(value)) {
    return failField(source, key, 'an array');
  }
  const path = pathOf(source, key);
  return Array.from(value, (element: unknown, index) =>
    parse(element, `${path}[${String(index)}]`)
  );
}

function readableId(source: Source): string | undefined {
  const id = source.fields.get('id');
  return typeof id === 'string' ? id : undefined;
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

function checkBandRates(source: Source, key: string, rate: number, variance: number) {
  if (rate - variance <= -1) {
    fail(
      'invalid_rate',
      pathOf(source, key),
      'the rate minus the variance is at or below -1',
      source.subject
    );
  }
  if (!Number.isFinite(rate + variance)) {
    fail(
      'invalid_rate',
      pathOf(source, key),
      'the rate plus the variance is not finite',
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
  const source = toSource(value, path, { accountId });
  source.subject = { accountId, ruleId: readableId(source) };
  checkKeys(source, RULE_KEYS);
  const id = stringAt(source, 'id');
  const timing = parseTiming(objectAt(source, 'timing', ANY_TIMING_KEYS));
  const isOneTime = timing.frequency === 'oneTime';
  checkKeys(source, isOneTime ? ONE_TIME_RULE_KEYS : RULE_KEYS);

  const name = source.fields.has('name') ? stringAt(source, 'name') : undefined;
  const enabled = source.fields.has('enabled') ? booleanAt(source, 'enabled') : true;
  const type = oneOfAt(source, 'type', ['flat', 'salaryPercent'] as const);
  const amount = numberAt(source, 'amount');
  checkNotNegative('negative_amount', source, 'amount', amount);
  const salaryBasis = source.fields.has('salaryBasis')
    ? oneOfAt(source, 'salaryBasis', SALARY_BASES)
    : 'annual';
  const growth = source.fields.has('growth')
    ? parseGrowth(objectAt(source, 'growth', GROWTH_KEYS))
    : undefined;
  const startDate = source.fields.has('startDate') ? dateAt(source, 'startDate') : undefined;
  const endDate = source.fields.has('endDate') ? dateAt(source, 'endDate') : undefined;

  if (isOneTime && growth) {
    fail(
      'growth_on_one_time',
      pathOf(source, 'growth'),
      'a one-time rule cannot grow',
      source.subject
    );
  }
  if (isOneTime && salaryBasis === 'perContribution') {
    fail(
      'per_contribution_on_one_time',
      pathOf(source, 'salaryBasis'),
      'a one-time rule cannot use perContribution',
      source.subject
    );
  }
  if (growth && !startDate) {
    fail(
      'growth_without_start',
      pathOf(source, 'startDate'),
      'growth needs a start date',
      source.subject
    );
  }
  if (startDate && endDate && compareDates(endDate, startDate) < 0) {
    fail(
      'rule_end_before_start',
      pathOf(source, 'endDate'),
      'before the start date',
      source.subject
    );
  }
  const rule: Writable<Rule> = { id, enabled, type, amount, salaryBasis, timing };
  if (name !== undefined) {
    rule.name = name;
  }
  if (growth) {
    rule.growth = growth;
  }
  if (startDate) {
    rule.startDate = startDate;
  }
  if (endDate) {
    rule.endDate = endDate;
  }
  return rule;
}

function parseAccount(value: unknown, path: string, today: PlainDate, variance: number): Account {
  const source = toSource(value, path, {});
  source.subject = { accountId: readableId(source) };
  checkKeys(source, ACCOUNT_KEYS);
  const id = stringAt(source, 'id');

  const name = stringAt(source, 'name');
  const kind = oneOfAt(source, 'kind', ['pretax', 'roth', 'taxable', 'other'] as const);
  const included = booleanAt(source, 'included');
  const balance = numberAt(source, 'balance');
  checkNotNegative('negative_balance', source, 'balance', balance);
  const balanceAsOf = dateAt(source, 'balanceAsOf');
  if (compareDates(balanceAsOf, today) > 0) {
    fail('as_of_in_future', pathOf(source, 'balanceAsOf'), 'after today', source.subject);
  }
  const annualRate = source.fields.has('annualRate') ? rateAt(source, 'annualRate') : undefined;
  if (annualRate !== undefined) {
    checkBandRates(source, 'annualRate', annualRate, variance);
  }
  const contributions = elementsAt(source, 'contributions', (rule, rulePath) =>
    parseRule(rule, rulePath, id)
  );
  const account: Writable<Account> = {
    id,
    name,
    kind,
    included,
    balance,
    balanceAsOf,
    contributions
  };
  if (annualRate !== undefined) {
    account.annualRate = annualRate;
  }
  return account;
}

function checkUniqueIds(accounts: ReadonlyArray<Account>) {
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
  const version = source.fields.get('version');
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    failField(source, 'version', 'a whole number');
  }
  if (version !== 1) {
    fail('unsupported_version', 'version', 'expected 1', {});
  }
  checkKeys(source, SCENARIO_KEYS);
  const today = dateAt(readObject(options, 'options', ['today'], {}), 'today');

  const interest = objectAt(source, 'interest', INTEREST_KEYS);
  const annualRate = rateAt(interest, 'annualRate');
  const variance = interest.fields.has('variance') ? rateAt(interest, 'variance') : 0;
  checkNotNegative('invalid_rate', interest, 'variance', variance);
  checkBandRates(interest, 'annualRate', annualRate, variance);
  const compounding = interest.fields.has('compounding')
    ? oneOfAt(interest, 'compounding', ['monthly', 'daily'] as const)
    : 'monthly';

  const salary = objectAt(source, 'salary', SALARY_KEYS);
  const annualBase = numberAt(salary, 'annualBase');
  checkNotNegative('negative_amount', salary, 'annualBase', annualBase);
  const annualRaiseRate = salary.fields.has('annualRaiseRate')
    ? rateAt(salary, 'annualRaiseRate')
    : 0;
  if (annualRaiseRate <= -1) {
    fail('invalid_rate', 'salary.annualRaiseRate', 'at or below -1', {});
  }
  const asOf = dateAt(salary, 'asOf');

  const endDate = dateAt(source, 'endDate');
  if (compareDates(endDate, today) <= 0) {
    fail('end_not_after_today', 'endDate', 'on or before today', {});
  }

  const accounts = elementsAt(source, 'accounts', (account, accountPath) =>
    parseAccount(account, accountPath, today, variance)
  );
  checkUniqueIds(accounts);

  return {
    today,
    endDate,
    interest: { annualRate, variance, compounding },
    salary: { annualBase, annualRaiseRate, asOf },
    accounts
  };
}
