import { buildAccountSchedule, wholeMonthsBetween } from '../account-schedule';
import type { ScheduledDeposit } from '../account-schedule';
import { totalByBucket } from '../compound';
import { compareDates, daysInMonth, formatPlainDate } from '../plain-date';
import type { PlainDate } from '../plain-date';
import type { Account, Rule, RuleTiming, Scenario, ScenarioFile } from '../scenario';
import { addDays } from './draw';

const LARGE_BALANCE = 1_000_000_000;
const MONTH_END_DAYS = new Set([29, 30, 31]);
const DECADES = 30;
const MAX_AGREED_POWER = 1000;

/** The edges a valid case reaches, read from the parsed scenario and its account schedules. */
export function observeTraits(file: ScenarioFile, scenario: Scenario): Array<string> {
  const traits = new Set<string>();
  const note = (condition: boolean, trait: string) => {
    if (condition) {
      traits.add(trait);
    }
  };
  scenarioTraits(file, scenario, note);
  scenario.accounts.forEach((account, accountIndex) => {
    accountTraits(scenario, account, note);
    const fileRules = file.accounts[accountIndex]?.contributions ?? [];
    account.contributions.forEach((rule, ruleIndex) => {
      const fileRule = fileRules[ruleIndex];
      if (!fileRule) {
        throw new RangeError(`The file has no rule ${rule.id}.`);
      }
      ruleTraits(scenario, account, rule, fileRule.timing, note);
    });
    depositTraits(scenario, account, note);
  });
  return [...traits].toSorted();
}

type Note = (condition: boolean, trait: string) => void;

function isLeapDay(date: PlainDate): boolean {
  return date.month === 2 && date.day === 29;
}

function isBefore(a: PlainDate, b: PlainDate): boolean {
  return compareDates(a, b) < 0;
}

function isSame(a: PlainDate, b: PlainDate): boolean {
  return compareDates(a, b) === 0;
}

function accountRate(scenario: Scenario, account: Account): number {
  return account.annualRate ?? scenario.interest.annualRate;
}

function scenarioTraits(file: ScenarioFile, scenario: Scenario, note: Note) {
  const { today, endDate, interest, salary, accounts } = scenario;
  note(true, `compounding:${interest.compounding}`);
  note(file.interest.compounding === undefined, 'compounding_default');
  note(interest.variance === 0, 'zero_variance');
  note(endDate.day !== 1, 'end_mid_month');
  note(endDate.day === 1 && endDate.month === 1, 'end:jan_1');
  note(!isBefore(addDays(today, 7), endDate), 'end:within_week');
  note(endDate.year === today.year && endDate.month === today.month, 'end:same_month');
  note(endDate.year - today.year >= DECADES, 'end:decades_away');
  note(today.day === 1, 'today:first_of_month');
  note(today.day === daysInMonth(today.year, today.month), 'today:last_of_month');
  note(today.day !== 1 && today.day !== daysInMonth(today.year, today.month), 'today:mid_month');
  note(isLeapDay(today), 'today_feb_29');

  note(salary.annualRaiseRate === 0, 'raise:zero');
  note(salary.annualRaiseRate > 0, 'raise:positive');
  note(salary.annualRaiseRate < 0, 'raise:negative');
  note(salary.annualBase === 0, 'salary_zero');
  note(isBefore(salary.asOf, today), 'salary_as_of:before_range');
  note(!isBefore(salary.asOf, today) && isBefore(salary.asOf, endDate), 'salary_as_of:in_range');
  note(!isBefore(salary.asOf, endDate), 'salary_as_of:after_range');
  note(isLeapDay(salary.asOf), 'salary_as_of_feb_29');
  note(hasSalaryPower(salary) && salary.asOf.year > today.year, 'negative_salary_power');

  note(true, `accounts:${String(accounts.length)}`);
  note(
    accounts.every((account) => !account.included),
    'all_excluded'
  );
  const includedRates = accounts
    .filter((account) => account.included)
    .map((account) => accountRate(scenario, account));
  const [firstRate] = includedRates;
  const ratesAgree = includedRates.every((rate) => rate === firstRate);
  note(includedRates.length >= 2 && ratesAgree, 'rates:equal');
  note(!ratesAgree, 'rates:differ');
}

function hasSalaryPower(salary: Scenario['salary']): boolean {
  return salary.annualRaiseRate !== 0 && salary.annualBase !== 0;
}

function accountTraits(scenario: Scenario, account: Account, note: Note) {
  const { today, interest } = scenario;
  const stale = isBefore(account.balanceAsOf, today);
  note(stale && account.included, 'stale');
  note(stale && !account.included, 'stale_excluded');
  note(isSame(account.balanceAsOf, today), 'today_is_as_of');
  note(isLeapDay(account.balanceAsOf), 'as_of_feb_29');
  note(account.balance === 0, 'zero_balance');
  note(account.balance > 0 && account.balance < 1, 'tiny_balance');
  note(account.balance >= LARGE_BALANCE, 'large_balance');
  note(!account.included, 'excluded_account');
  note(account.contributions.length === 0, 'account_without_rules');
  note(account.annualRate !== undefined, 'rate_override');
  note(
    interest.variance > 0 && accountRate(scenario, account) - interest.variance < 0,
    'negative_band_below_zero'
  );
}

function ruleTraits(
  scenario: Scenario,
  account: Account,
  rule: Rule,
  fileTiming: RuleTiming,
  note: Note
) {
  const { today, endDate } = scenario;
  const { timing } = rule;
  note(!rule.enabled, 'disabled_rule');
  note(true, timingTrait(fileTiming));
  if (rule.type === 'salaryPercent') {
    const basis =
      rule.salaryBasis === 'perContribution'
        ? `per_contribution_${timing.frequency}`
        : rule.salaryBasis;
    note(true, `basis:${basis}`);
  }
  if (timing.frequency === 'oneTime') {
    const { on } = timing;
    note(isBefore(on, account.balanceAsOf), 'one_time:before_range');
    note(!isBefore(on, account.balanceAsOf) && isBefore(on, today), 'one_time:in_roll_forward');
    note(isSame(on, today), 'one_time:first_day');
    note(isSame(on, addDays(endDate, -1)), 'one_time:last_day');
    note(isSame(on, endDate), 'one_time:on_end');
    note(isBefore(endDate, on), 'one_time:after_end');
    return;
  }
  note(timing.day === 31, 'rule_day_31');
  note(timing.frequency === 'annual' && timing.month === 2 && timing.day === 29, 'annual_feb_29');
  boundTraits(scenario, account, rule, note);
  if (rule.growth && rule.startDate) {
    note(true, `growth:${rule.growth.type}_${rule.growth.cadence}`);
    note(MONTH_END_DAYS.has(rule.startDate.day), `growth_start_day:${String(rule.startDate.day)}`);
  }
}

function timingTrait(timing: RuleTiming): string {
  if (timing.frequency === 'oneTime') {
    return 'timing:one_time';
  }
  const day = timing.day === undefined ? '' : '_day';
  const placement = timing.placement === undefined ? '' : '_placement';
  return `timing:${timing.frequency}${day || placement ? `${day}${placement}` : '_bare'}`;
}

function boundTraits(scenario: Scenario, account: Account, rule: Rule, note: Note) {
  const { startDate, endDate } = rule;
  note(startDate !== undefined, 'rule_bound:start');
  note(endDate !== undefined, 'rule_bound:end');
  note(Boolean(startDate && endDate && isSame(startDate, endDate)), 'rule_bound:equal');
  note(
    Boolean(startDate && isBefore(startDate, account.balanceAsOf)),
    'rule_bound:start_before_range'
  );
  note(
    Boolean(startDate && !isBefore(startDate, scenario.endDate)),
    'rule_bound:start_after_range'
  );
  note(Boolean(endDate && isBefore(endDate, scenario.today)), 'rule_bound:end_before_today');
  note(Boolean(endDate && !isBefore(endDate, scenario.endDate)), 'rule_bound:end_after_range');
}

function depositTraits(scenario: Scenario, account: Account, note: Note) {
  const months = [
    ...buildAccountSchedule(scenario, account, account.balanceAsOf, scenario.today),
    ...buildAccountSchedule(scenario, account, scenario.today, scenario.endDate)
  ];
  const rules = new Map(account.contributions.map((rule) => [rule.id, rule]));
  const periodsByRule = new Map<string, Set<number>>();
  for (const { deposits } of months) {
    note(isOrderSensitive(deposits), 'same_bucket_order_sensitive');
    const dates = deposits.map(({ date }) => formatPlainDate(date));
    note(new Set(dates).size < dates.length, 'same_day_deposits');
    for (const deposit of deposits) {
      const rule = rules.get(deposit.ruleId);
      if (!rule) {
        throw new RangeError(`Deposit from unknown rule ${deposit.ruleId}.`);
      }
      note(
        rule.type === 'salaryPercent' &&
          hasSalaryPower(scenario.salary) &&
          deposit.date.year < scenario.salary.asOf.year,
        'negative_salary_power'
      );
      if (rule.growth && rule.startDate) {
        const periods = growthPeriods(rule.startDate, deposit.date, rule.growth.cadence);
        note(
          rule.growth.type === 'percent' && rule.growth.amount !== 0 && periods > MAX_AGREED_POWER,
          'growth_periods_over_1000'
        );
        const seen = periodsByRule.get(rule.id) ?? new Set();
        seen.add(periods);
        periodsByRule.set(rule.id, seen);
        note(rule.growth.cadence === 'annual' && seen.size > 1, 'growth_crosses_anniversary');
      }
    }
  }
}

function growthPeriods(start: PlainDate, date: PlainDate, cadence: 'annual' | 'monthly'): number {
  const months = wholeMonthsBetween(start, date);
  return cadence === 'annual' ? Math.floor(months / 12) : months;
}

function isOrderSensitive(deposits: ReadonlyArray<ScheduledDeposit>): boolean {
  const forward = totalByBucket(deposits);
  const backward = totalByBucket(deposits.toReversed());
  return (
    forward.start !== backward.start ||
    forward.end !== backward.end ||
    [...forward.byDay].some(([day, total]) => backward.byDay.get(day) !== total)
  );
}
