import type { ScenarioErrorCode } from '../parse-scenario';
import { compareDates, daysInMonth, formatPlainDate } from '../plain-date';
import type { AccountFile, ContributionRuleFile, RuleTiming, ScenarioFile } from '../scenario';
import { addDays, dateOf, itemAt } from './draw';
import type { Json } from './json';
import type { Draw } from './draw';

/** A case being broken. `today` is the string the harness passes as --today. */
export interface Target {
  file: ScenarioFile;
  today: string;
}

/** The ids the broken case's error is expected to carry. */
export interface Subject {
  accountId?: string;
  ruleId?: string;
}

export interface Fault {
  name: string;
  code: ScenarioErrorCode;
  apply: (target: Target, draw: Draw) => Subject;
}

/** Every object or array in a scenario file that a fault writes to. */
type FileNode =
  | ScenarioFile
  | ScenarioFile['interest']
  | ScenarioFile['salary']
  | AccountFile
  | Array<AccountFile>
  | ContributionRuleFile
  | RuleTiming;

/** Rule fields with any value, including ones the file format rejects. */
type RuleFields = { [Key in keyof ContributionRuleFile]?: Json };

const NO_IDS: Subject = {};
const HUGE = 1e308;
const HUGE_RATE = 1e300;

function setKey(target: FileNode, key: string, value: Json) {
  Reflect.set(target, key, value);
}

function removeKey(target: FileNode, key: string) {
  Reflect.deleteProperty(target, key);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function pickAccount(target: Target, draw: Draw): AccountFile {
  return draw.pick(target.file.accounts);
}

function accountSubject(account: AccountFile): Subject {
  return { accountId: account.id };
}

function ruleSubject(account: AccountFile, rule: ContributionRuleFile): Subject {
  return { accountId: account.id, ruleId: rule.id };
}

/** Puts `rule` at a drawn position among the account's rules. */
function insertRule(draw: Draw, account: AccountFile, rule: ContributionRuleFile): Subject {
  account.contributions.splice(draw.int(0, account.contributions.length), 0, rule);
  return ruleSubject(account, rule);
}

function newRule(account: AccountFile): ContributionRuleFile {
  return { id: `${account.id}x`, type: 'flat', amount: 100, timing: { frequency: 'monthly' } };
}

/** A rule of a drawn account, added when the account has none. */
function someRule(target: Target, draw: Draw) {
  const account = pickAccount(target, draw);
  if (account.contributions.length === 0) {
    account.contributions.push(newRule(account));
  }
  return { account, rule: draw.pick(account.contributions) };
}

/** Adds a rule to a drawn account, with `fields` over a valid monthly rule. */
function brokenRule(fields: RuleFields): Fault['apply'] {
  return (target, draw) => {
    const account = pickAccount(target, draw);
    const rule = Object.assign(newRule(account), fields);
    return insertRule(draw, account, rule);
  };
}

/** Two accounts in file order, after appending an empty one when the file has only one. */
function twoAccounts(target: Target, draw: Draw): [AccountFile, AccountFile] {
  if (target.file.accounts.length < 2) {
    target.file.accounts.push({
      id: 'extra',
      name: 'Extra',
      kind: 'other',
      included: true,
      balance: 0,
      balanceAsOf: target.today,
      contributions: []
    });
  }
  const { accounts } = target.file;
  const later = draw.int(1, accounts.length - 1);
  return [itemAt(accounts, draw.int(0, later - 1)), itemAt(accounts, later)];
}

const unsupportedVersion: Array<Fault> = [
  { name: 'version_2', value: 2 },
  { name: 'version_0', value: 0 },
  { name: 'version_negative', value: -1 }
].map(({ name, value }) => ({
  name,
  code: 'unsupported_version',
  apply: (target) => {
    setKey(target.file, 'version', value);
    return NO_IDS;
  }
}));

const invalidField: Array<Fault> = [
  {
    name: 'unknown_key_top',
    code: 'invalid_field',
    apply: (target) => {
      setKey(target.file, 'comment', 'not part of version 1');
      return NO_IDS;
    }
  },
  {
    name: 'unknown_key_nested',
    code: 'invalid_field',
    apply: (target, draw) => {
      const place = draw.int(1, 4);
      if (place === 1) {
        setKey(target.file.interest, 'inflation', 0.02);
        return NO_IDS;
      }
      if (place === 2) {
        const account = pickAccount(target, draw);
        setKey(account, 'nickname', 'savings');
        return accountSubject(account);
      }
      const { account, rule } = someRule(target, draw);
      setKey(place === 3 ? rule : rule.timing, 'weekday', 3);
      return ruleSubject(account, rule);
    }
  },
  {
    name: 'misplaced_key',
    code: 'invalid_field',
    apply: (target, draw) => {
      const misplaced = draw.pick<RuleFields>([
        { timing: { frequency: 'oneTime', on: target.today }, startDate: target.today },
        { timing: { frequency: 'oneTime', on: target.today }, endDate: target.today },
        { timing: { frequency: 'monthly', on: target.today } },
        { timing: { frequency: 'monthly', month: 3 } }
      ]);
      return brokenRule(misplaced)(target, draw);
    }
  },
  {
    name: 'wrong_type',
    code: 'invalid_field',
    apply: (target, draw) => {
      const kind = draw.int(1, 5);
      if (kind === 1) {
        setKey(target.file, 'endDate', Number(target.file.endDate.replaceAll('-', '')));
        return NO_IDS;
      }
      if (kind === 2) {
        setKey(target.file.interest, 'annualRate', String(target.file.interest.annualRate));
        return NO_IDS;
      }
      const account = pickAccount(target, draw);
      if (kind === 3) {
        setKey(account, 'balance', String(account.balance));
        return accountSubject(account);
      }
      if (kind === 4) {
        setKey(account, 'included', account.included ? 1 : 0);
        return accountSubject(account);
      }
      return brokenRule({ timing: { frequency: 'monthly', day: '15' } })(target, draw);
    }
  },
  {
    name: 'missing_required',
    code: 'invalid_field',
    apply: (target, draw) => {
      const kind = draw.int(1, 5);
      if (kind === 1) {
        removeKey(target.file, 'version');
        return NO_IDS;
      }
      if (kind === 2) {
        removeKey(target.file.salary, 'asOf');
        return NO_IDS;
      }
      if (kind === 3) {
        removeKey(target.file.interest, 'annualRate');
        return NO_IDS;
      }
      if (kind === 4) {
        const account = pickAccount(target, draw);
        removeKey(account, 'name');
        return accountSubject(account);
      }
      const { account, rule } = someRule(target, draw);
      removeKey(rule, 'type');
      return ruleSubject(account, rule);
    }
  },
  {
    name: 'null_optional',
    code: 'invalid_field',
    apply: (target, draw) => {
      const kind = draw.int(1, 6);
      if (kind === 1) {
        setKey(target.file.interest, 'variance', null);
        return NO_IDS;
      }
      if (kind === 2) {
        setKey(target.file.salary, 'annualRaiseRate', null);
        return NO_IDS;
      }
      if (kind === 3) {
        const account = pickAccount(target, draw);
        setKey(account, 'annualRate', null);
        return accountSubject(account);
      }
      const nulled = itemAt(
        [{ name: null }, { enabled: null }, { timing: { frequency: 'monthly', placement: null } }],
        kind - 4
      );
      return brokenRule(nulled)(target, draw);
    }
  },
  {
    name: 'not_an_object',
    code: 'invalid_field',
    apply: (target, draw) => {
      const kind = draw.int(1, 3);
      const account = pickAccount(target, draw);
      if (kind === 1) {
        const index = target.file.accounts.indexOf(account);
        setKey(target.file.accounts, String(index), account.id);
        return NO_IDS;
      }
      if (kind === 2) {
        const rules: Array<unknown> = account.contributions;
        rules.splice(draw.int(0, rules.length), 0, 42);
        return accountSubject(account);
      }
      return brokenRule({ timing: null })(target, draw);
    }
  }
];

const invalidDate: Array<Fault> = [
  {
    name: 'impossible_day',
    code: 'invalid_date',
    apply: (target, draw) => {
      const account = pickAccount(target, draw);
      const { year } = dateOf(account.balanceAsOf);
      account.balanceAsOf = draw.pick([
        `${String(year).padStart(4, '0')}-02-30`,
        `${String(year).padStart(4, '0')}-04-31`
      ]);
      return accountSubject(account);
    }
  },
  {
    name: 'bad_format',
    code: 'invalid_date',
    apply: (target, draw) => {
      const { year, day } = dateOf(target.file.salary.asOf);
      const shortDay = String(Math.min(day, 28)).padStart(2, '0');
      target.file.salary.asOf = draw.pick([
        `${String(year)}-${String(draw.int(1, 9))}-${shortDay}`,
        `${target.file.salary.asOf}T00:00:00Z`,
        ` ${target.file.salary.asOf}`,
        target.file.salary.asOf.replaceAll('-', '/')
      ]);
      return NO_IDS;
    }
  },
  {
    name: 'year_zero',
    code: 'invalid_date',
    apply: (target) => {
      target.file.endDate = `0000${target.file.endDate.slice(4)}`;
      return NO_IDS;
    }
  },
  {
    name: 'bad_today',
    code: 'invalid_date',
    apply: (target, draw) => {
      const { year, month } = dateOf(target.today);
      target.today = draw.pick([
        `${String(year)}-${pad(month)}-${pad(daysInMonth(year, month) + 1)}`,
        `${String(year)}-13-01`,
        `${String(year)}-${pad(month)}-01 `
      ]);
      return NO_IDS;
    }
  },
  {
    name: 'bad_rule_date',
    code: 'invalid_date',
    apply: (target, draw) =>
      brokenRule(
        draw.pick([
          { startDate: '2023-02-29' },
          { endDate: '2030-06-31' },
          { timing: { frequency: 'oneTime', on: '2031-11-31' } }
        ])
      )(target, draw)
  }
];

const endNotAfterToday: Array<Fault> = [
  {
    name: 'end_equals_today',
    code: 'end_not_after_today',
    apply: (target) => {
      target.file.endDate = target.today;
      return NO_IDS;
    }
  },
  {
    name: 'end_before_today',
    code: 'end_not_after_today',
    apply: (target, draw) => {
      target.file.endDate = formatPlainDate(addDays(dateOf(target.today), -draw.int(1, 3000)));
      return NO_IDS;
    }
  }
];

const asOfInFuture: Array<Fault> = [
  { name: 'as_of_tomorrow', days: [1, 1] },
  { name: 'as_of_later', days: [2, 3000] }
].map(({ name, days: [from = 1, to = 1] }) => ({
  name,
  code: 'as_of_in_future',
  apply: (target, draw) => {
    const account = pickAccount(target, draw);
    account.balanceAsOf = formatPlainDate(addDays(dateOf(target.today), draw.int(from, to)));
    return accountSubject(account);
  }
}));

const negativeBalance: Array<Fault> = [
  { name: 'negative_cents', cents: [1, 99] },
  { name: 'negative_dollars', cents: [100, 100_000_000] }
].map(({ name, cents: [from = 1, to = 1] }) => ({
  name,
  code: 'negative_balance',
  apply: (target, draw) => {
    const account = pickAccount(target, draw);
    account.balance = -draw.int(from, to) / 100;
    return accountSubject(account);
  }
}));

const invalidRate: Array<Fault> = [
  {
    name: 'negative_variance',
    code: 'invalid_rate',
    apply: (target, draw) => {
      target.file.interest.variance = -draw.int(1, 800) / 10_000;
      return NO_IDS;
    }
  },
  {
    name: 'default_rate_at_minus_one',
    code: 'invalid_rate',
    apply: (target, draw) => {
      target.file.interest.annualRate = -1 - draw.int(0, 50) / 100;
      return NO_IDS;
    }
  },
  {
    name: 'account_rate_at_minus_one',
    code: 'invalid_rate',
    apply: (target, draw) => {
      const account = pickAccount(target, draw);
      account.annualRate = -1 - draw.int(0, 50) / 100;
      return accountSubject(account);
    }
  },
  {
    name: 'rate_plus_variance_overflows',
    code: 'invalid_rate',
    apply: (target) => {
      for (const account of target.file.accounts) {
        removeKey(account, 'annualRate');
      }
      target.file.interest.annualRate = HUGE;
      target.file.interest.variance = HUGE;
      return NO_IDS;
    }
  },
  {
    name: 'raise_at_minus_one',
    code: 'invalid_rate',
    apply: (target, draw) => {
      target.file.salary.annualRaiseRate = -1 - draw.int(0, 100) / 100;
      return NO_IDS;
    }
  }
];

const negativeAmount: Array<Fault> = [
  {
    name: 'rule_amount',
    code: 'negative_amount',
    apply: (target, draw) => {
      const { account, rule } = someRule(target, draw);
      rule.amount = -draw.int(1, 100_000) / 100;
      return ruleSubject(account, rule);
    }
  },
  {
    name: 'growth_amount',
    code: 'negative_amount',
    apply: (target, draw) =>
      brokenRule({
        growth: { type: draw.pick(['percent', 'flat']), amount: -1, cadence: 'annual' },
        startDate: target.today
      })(target, draw)
  },
  {
    name: 'salary_base',
    code: 'negative_amount',
    apply: (target, draw) => {
      target.file.salary.annualBase = -draw.int(1, 10_000_000) / 100;
      return NO_IDS;
    }
  }
];

const duplicateId: Array<Fault> = [
  {
    name: 'account_id',
    code: 'duplicate_id',
    apply: (target, draw) => {
      const [first, later] = twoAccounts(target, draw);
      later.id = first.id;
      return accountSubject(later);
    }
  },
  {
    name: 'rule_id_across_accounts',
    code: 'duplicate_id',
    apply: (target, draw) => {
      const [first, later] = twoAccounts(target, draw);
      const original = insertRule(draw, first, newRule(first));
      return insertRule(draw, later, { ...newRule(later), id: original.ruleId ?? '' });
    }
  },
  {
    name: 'rule_id_within_account',
    code: 'duplicate_id',
    apply: (target, draw) => {
      const account = pickAccount(target, draw);
      account.contributions.push(newRule(account), newRule(account));
      return ruleSubject(account, newRule(account));
    }
  }
];

const invalidDay: Array<Fault> = [
  { name: 'day_zero', timing: () => ({ frequency: 'monthly', day: 0 }) },
  {
    name: 'day_too_large',
    timing: (draw: Draw) => ({ frequency: 'monthly', day: draw.int(32, 40) })
  },
  {
    name: 'day_fraction',
    timing: (draw: Draw) => ({ frequency: 'annual', month: 5, day: draw.int(1, 30) + 0.5 })
  },
  {
    name: 'month_out_of_range',
    timing: (draw: Draw) => ({ frequency: 'annual', month: draw.pick([0, 13]) })
  },
  {
    name: 'day_not_in_month',
    timing: (draw: Draw) =>
      draw.pick([
        { frequency: 'annual', month: 2, day: 30 },
        { frequency: 'annual', month: 4, day: 31 },
        { frequency: 'annual', month: 11, day: 31 }
      ])
  }
].map(({ name, timing }) => ({
  name,
  code: 'invalid_day',
  apply: (target, draw) => brokenRule({ timing: timing(draw) })(target, draw)
}));

const growthWithoutStart: Array<Fault> = (['monthly', 'annual'] as const).map((frequency) => ({
  name: `growth_without_start_${frequency}`,
  code: 'growth_without_start',
  apply: (target, draw) =>
    brokenRule({
      timing: frequency === 'monthly' ? { frequency } : { frequency, month: draw.int(1, 12) },
      growth: { type: 'percent', amount: 3, cadence: draw.pick(['annual', 'monthly']) }
    })(target, draw)
}));

const growthOnOneTime: Array<Fault> = [
  {
    name: 'growth_on_one_time',
    code: 'growth_on_one_time',
    apply: (target, draw) =>
      brokenRule({
        timing: { frequency: 'oneTime', on: target.today },
        growth: { type: 'flat', amount: 10, cadence: 'annual' }
      })(target, draw)
  }
];

const ruleEndBeforeStart: Array<Fault> = [
  { name: 'end_one_day_before_start', days: [1, 1] },
  { name: 'end_years_before_start', days: [366, 4000] }
].map(({ name, days: [from = 1, to = 1] }) => ({
  name,
  code: 'rule_end_before_start',
  apply: (target, draw) => {
    const start = dateOf(target.today);
    return brokenRule({
      startDate: formatPlainDate(start),
      endDate: formatPlainDate(addDays(start, -draw.int(from, to)))
    })(target, draw);
  }
}));

const perContributionOnOneTime: Array<Fault> = (['flat', 'salaryPercent'] as const).map((type) => ({
  name: `per_contribution_on_one_time_${type}`,
  code: 'per_contribution_on_one_time',
  apply: (target, draw) =>
    brokenRule({
      type,
      salaryBasis: 'perContribution',
      timing: { frequency: 'oneTime', on: target.today }
    })(target, draw)
}));

/** One list per parser code, in the order the invalid cases take them. */
export const PARSER_FAULTS: ReadonlyArray<ReadonlyArray<Fault>> = [
  unsupportedVersion,
  invalidField,
  invalidDate,
  endNotAfterToday,
  asOfInFuture,
  negativeBalance,
  invalidRate,
  negativeAmount,
  duplicateId,
  invalidDay,
  growthWithoutStart,
  growthOnOneTime,
  ruleEndBeforeStart,
  perContributionOnOneTime
];

/** The k-th invalid case takes the next code in turn, and that code's next shape. */
export function parserFault(index: number): Fault {
  const shapes = itemAt(PARSER_FAULTS, index % PARSER_FAULTS.length);
  return itemAt(shapes, Math.floor(index / PARSER_FAULTS.length) % shapes.length);
}

function overflowingSalary(target: Target, draw: Draw) {
  const nextYear = { year: dateOf(target.today).year + 1, month: 1, day: 1 };
  if (compareDates(dateOf(target.file.endDate), nextYear) <= 0) {
    target.file.endDate = formatPlainDate(addDays(nextYear, draw.int(1, 400)));
  }
  target.file.salary = { annualBase: HUGE, annualRaiseRate: 1, asOf: target.today };
  for (const account of target.file.accounts) {
    for (const rule of account.contributions) {
      rule.type = 'flat';
    }
  }
}

/** Faults the parser accepts and the engine rejects with not_finite. */
export const ENGINE_FAULTS: ReadonlyArray<Fault> = [
  {
    name: 'overflowing_balance',
    code: 'not_finite',
    apply: (target, draw) => {
      const account = pickAccount(target, draw);
      account.balance = HUGE;
      account.annualRate = HUGE_RATE;
      return accountSubject(account);
    }
  },
  {
    name: 'overflowing_total',
    code: 'not_finite',
    apply: (target, draw) => {
      for (const account of twoAccounts(target, draw)) {
        Object.assign(account, {
          included: true,
          balance: HUGE,
          balanceAsOf: target.today,
          annualRate: 0,
          contributions: []
        });
      }
      return NO_IDS;
    }
  },
  {
    name: 'non_finite_deposit',
    code: 'not_finite',
    apply: (target, draw) => {
      const account = pickAccount(target, draw);
      const asOf = dateOf(account.balanceAsOf);
      insertRule(draw, account, {
        ...newRule(account),
        amount: draw.pick([0, 1]),
        growth: { type: 'percent', amount: HUGE_RATE, cadence: 'monthly' },
        startDate: formatPlainDate(addDays(asOf, -draw.int(100, 3000))),
        timing: { frequency: 'monthly', day: asOf.day }
      });
      return accountSubject(account);
    }
  },
  {
    name: 'overflowing_salary',
    code: 'not_finite',
    apply: (target, draw) => {
      overflowingSalary(target, draw);
      return NO_IDS;
    }
  },
  {
    name: 'overflowing_salary_deposit',
    code: 'not_finite',
    apply: (target, draw) => {
      overflowingSalary(target, draw);
      const account = pickAccount(target, draw);
      insertRule(draw, account, { ...newRule(account), type: 'salaryPercent', amount: 1 });
      return accountSubject(account);
    }
  }
];
