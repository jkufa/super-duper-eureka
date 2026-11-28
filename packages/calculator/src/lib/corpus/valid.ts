import { addMonths, daysInMonth, formatPlainDate } from '../plain-date';
import type { PlainDate } from '../plain-date';
import type {
  AccountFile,
  Compounding,
  ContributionRuleFile,
  RuleGrowth,
  RuleTiming,
  ScenarioFile
} from '../scenario';
import { addDays, dateIn, leapDayOnOrBefore } from './draw';
import type { Draw } from './draw';

export interface ValidCase {
  file: ScenarioFile;
  today: PlainDate;
}

interface Range {
  today: PlainDate;
  endDate: PlainDate;
}

interface AccountRange extends Range {
  balanceAsOf: PlainDate;
}

interface RateChoice {
  annualRate: number;
  uniformRates: boolean;
  allExcluded: boolean;
}

type MonthlyTiming = Extract<RuleTiming, { frequency: 'monthly' }>;
type AnnualTiming = Extract<RuleTiming, { frequency: 'annual' }>;

const KINDS = ['pretax', 'roth', 'taxable', 'other'] as const;
const ONE_TIME_BASES = ['annual', 'monthly', 'biweekly', 'weekly', 'daily'] as const;
const BASES = [...ONE_TIME_BASES, 'perContribution'] as const;
const PLACEMENTS = ['start', 'end'] as const;
const MONTH_END_DAYS = [29, 30, 31];
const ORDER_SENSITIVE_CENTS = [
  [10, 20, 30],
  [70, 20, 10],
  [30, 60, 10],
  [1_000_000_000_000_000_000, 100, 100]
];
const CLUSTER_TIMINGS: ReadonlyArray<MonthlyTiming> = [
  { frequency: 'monthly', day: 15 },
  { frequency: 'monthly', placement: 'end' },
  { frequency: 'monthly' }
];
const LEAP_YEARS_FROM = 499;
const LEAP_YEARS_TO = 515;
const LONG_GROWTH_DAYS = { from: 31_000, to: 34_000 };

export function validCase(draw: Draw): ValidCase {
  const today = drawToday(draw);
  const range = { today, endDate: drawEndDate(draw, today) };
  const compounding: Compounding = draw.pick(['monthly', 'daily']);
  const rates = {
    annualRate: drawRate(draw),
    uniformRates: draw.chance(30),
    allExcluded: draw.chance(5)
  };
  const variance = draw.chance(35) ? 0 : draw.int(1, 800) / 10_000;
  const interest: ScenarioFile['interest'] = { annualRate: rates.annualRate };
  if (variance !== 0 || draw.chance(50)) {
    interest.variance = variance;
  }
  if (compounding === 'daily' || draw.chance(70)) {
    interest.compounding = compounding;
  }
  const accounts = Array.from({ length: draw.int(1, 6) }, (_, index) =>
    drawAccount(draw, index + 1, range, rates)
  );
  const salary = drawSalary(draw, range);
  if (draw.chance(12)) {
    addOrderSensitiveRules(draw, draw.pick(accounts));
  }
  if (draw.chance(3)) {
    addLongGrowthRule(draw, draw.pick(accounts), today);
  }
  return {
    file: { version: 1, endDate: formatPlainDate(range.endDate), interest, salary, accounts },
    today
  };
}

function drawRate(draw: Draw): number {
  return draw.int(-300, 1500) / 10_000;
}

function drawToday(draw: Draw): PlainDate {
  if (draw.chance(6)) {
    return { year: draw.int(LEAP_YEARS_FROM, LEAP_YEARS_TO) * 4, month: 2, day: 29 };
  }
  const year = draw.int(1995, 2060);
  const month = draw.int(1, 12);
  const last = daysInMonth(year, month);
  const day = draw.pick([1, last, draw.int(2, last - 1)]);
  return { year, month, day };
}

function drawDayInYear(draw: Draw, year: number): PlainDate {
  const month = draw.int(1, 12);
  return { year, month, day: draw.int(1, daysInMonth(year, month)) };
}

function drawEndDate(draw: Draw, today: PlainDate): PlainDate {
  const roll = draw.int(1, 100);
  const last = daysInMonth(today.year, today.month);
  if (roll <= 8) {
    return addDays(today, draw.int(1, 7));
  }
  if (roll <= 14) {
    return today.day < last ? { ...today, day: draw.int(today.day + 1, last) } : addDays(today, 1);
  }
  if (roll <= 35) {
    const month = addMonths({ ...today, day: 1 }, draw.int(1, 24));
    return draw.chance(50)
      ? month
      : { ...month, day: draw.int(1, daysInMonth(month.year, month.month)) };
  }
  const year = today.year + (roll <= 85 ? draw.int(1, 30) : draw.int(31, 90));
  return draw.chance(55) ? { year, month: 1, day: 1 } : drawDayInYear(draw, year);
}

function drawSalary(draw: Draw, { today, endDate }: Range): ScenarioFile['salary'] {
  const annualBase = draw.chance(10) ? 0 : draw.int(1_000_000, 30_000_000) / 100;
  const asOfRoll = draw.int(1, 100);
  let asOf = addDays(endDate, draw.int(0, 2000));
  if (asOfRoll <= 55) {
    asOf = addDays(today, -draw.int(1, 4000));
  } else if (asOfRoll <= 65) {
    asOf = today;
  } else if (asOfRoll <= 72) {
    asOf = leapDayOnOrBefore(today);
  } else if (asOfRoll <= 92) {
    asOf = dateIn(draw, today, endDate);
  }
  const salary: ScenarioFile['salary'] = { annualBase, asOf: formatPlainDate(asOf) };
  const raiseRoll = draw.int(1, 100);
  if (raiseRoll <= 15) {
    return salary;
  }
  if (raiseRoll <= 35) {
    salary.annualRaiseRate = 0;
  } else if (raiseRoll <= 70) {
    salary.annualRaiseRate = draw.int(1, 800) / 10_000;
  } else if (raiseRoll <= 97) {
    salary.annualRaiseRate = -draw.int(1, 3000) / 10_000;
  } else {
    salary.annualRaiseRate = -draw.int(9000, 9999) / 10_000;
  }
  return salary;
}

function drawBalance(draw: Draw): number {
  const roll = draw.int(1, 100);
  if (roll <= 15) {
    return 0;
  }
  if (roll <= 23) {
    return draw.int(1, 99) / 100;
  }
  if (roll <= 30) {
    return draw.int(100_000_000_000, 100_000_000_000_000) / 100;
  }
  return draw.int(1, 50_000_000) / 100;
}

function drawBalanceAsOf(draw: Draw, today: PlainDate): PlainDate {
  const roll = draw.int(1, 100);
  if (roll <= 45) {
    return today;
  }
  if (roll <= 60) {
    return leapDayOnOrBefore(today);
  }
  return addDays(today, roll <= 75 ? -draw.int(1, 31) : -draw.int(32, 4000));
}

function drawAccountRate(draw: Draw, rates: RateChoice): number | undefined {
  if (rates.uniformRates) {
    return draw.chance(40) ? rates.annualRate : undefined;
  }
  if (!draw.chance(55)) {
    return undefined;
  }
  return draw.chance(15) ? rates.annualRate : drawRate(draw);
}

function drawAccount(draw: Draw, number: number, range: Range, rates: RateChoice): AccountFile {
  const id = `a${String(number)}`;
  const balanceAsOf = drawBalanceAsOf(draw, range.today);
  const accountRange = { ...range, balanceAsOf };
  const account: AccountFile = {
    id,
    name: `Account ${String(number)}`,
    kind: draw.pick(KINDS),
    included: !rates.allExcluded && !draw.chance(20),
    balance: drawBalance(draw),
    balanceAsOf: formatPlainDate(balanceAsOf),
    contributions: Array.from({ length: draw.chance(20) ? 0 : draw.int(1, 5) }, (_, index) =>
      drawRule(draw, `${id}r${String(index + 1)}`, accountRange)
    )
  };
  const annualRate = drawAccountRate(draw, rates);
  if (annualRate !== undefined) {
    account.annualRate = annualRate;
  }
  return account;
}

function drawDay(draw: Draw): number {
  return draw.chance(50) ? draw.pick([1, 28, ...MONTH_END_DAYS]) : draw.int(1, 31);
}

function drawMonthlyTiming(draw: Draw): MonthlyTiming {
  const timing: MonthlyTiming = { frequency: 'monthly' };
  if (draw.chance(55)) {
    timing.day = drawDay(draw);
  }
  if (draw.chance(50)) {
    timing.placement = draw.pick(PLACEMENTS);
  }
  return timing;
}

function drawAnnualTiming(draw: Draw): AnnualTiming {
  const leapDay = draw.chance(12);
  const month = leapDay ? 2 : draw.int(1, 12);
  const timing: AnnualTiming = { frequency: 'annual', month };
  if (leapDay) {
    timing.day = 29;
  } else if (draw.chance(55)) {
    timing.day = Math.min(drawDay(draw), daysInMonth(2000, month));
  }
  if (draw.chance(50)) {
    timing.placement = draw.pick(PLACEMENTS);
  }
  return timing;
}

function drawOneTimeDate(draw: Draw, { today, endDate, balanceAsOf }: AccountRange): PlainDate {
  const position = draw.int(1, 7);
  if (position === 1) {
    return addDays(today, -draw.int(1, 2000));
  }
  if (position === 2) {
    return today;
  }
  if (position === 3) {
    return addDays(endDate, -1);
  }
  if (position === 4) {
    return endDate;
  }
  if (position === 5) {
    return addDays(endDate, draw.int(1, 400));
  }
  return position === 6 ? dateIn(draw, today, endDate) : dateIn(draw, balanceAsOf, today);
}

function drawGrowth(draw: Draw): RuleGrowth {
  const type = draw.pick(['percent', 'flat'] as const);
  const cadence = draw.pick(['annual', 'monthly'] as const);
  if (type === 'flat') {
    return { type, amount: draw.int(0, 50_000) / 100, cadence };
  }
  return { type, amount: draw.chance(10) ? 0 : draw.int(1, 1000) / 100, cadence };
}

/** `date` moved to `day`, in the next month when its own month is too short. */
function onDay(date: PlainDate, day: number): PlainDate {
  return day <= daysInMonth(date.year, date.month)
    ? { ...date, day }
    : { ...date, month: date.month + 1, day };
}

function drawRuleStart(draw: Draw, { endDate, balanceAsOf }: AccountRange): PlainDate {
  const roll = draw.int(1, 100);
  let start = addDays(endDate, draw.int(0, 500));
  if (roll <= 45) {
    start = addDays(balanceAsOf, -draw.int(1, 3000));
  } else if (roll <= 85) {
    start = dateIn(draw, balanceAsOf, endDate);
  }
  return draw.chance(35) ? onDay(start, draw.pick(MONTH_END_DAYS)) : start;
}

function drawRuleEnd(draw: Draw, range: AccountRange, start: PlainDate | undefined): PlainDate {
  if (start) {
    return draw.chance(20) ? start : addDays(start, draw.int(1, 6000));
  }
  const roll = draw.int(1, 3);
  if (roll === 1) {
    return addDays(range.today, -draw.int(1, 3000));
  }
  return roll === 2
    ? dateIn(draw, range.balanceAsOf, range.endDate)
    : addDays(range.endDate, draw.int(0, 500));
}

function drawRuleTiming(draw: Draw, range: AccountRange): RuleTiming {
  const roll = draw.int(1, 100);
  if (roll <= 20) {
    return { frequency: 'oneTime', on: formatPlainDate(drawOneTimeDate(draw, range)) };
  }
  return roll <= 65 ? drawMonthlyTiming(draw) : drawAnnualTiming(draw);
}

function drawRule(draw: Draw, id: string, range: AccountRange): ContributionRuleFile {
  const timing = drawRuleTiming(draw, range);
  const type = draw.chance(35) ? 'salaryPercent' : 'flat';
  const amount =
    type === 'flat'
      ? draw.chance(8)
        ? 0
        : draw.int(1, 500_000) / 100
      : draw.chance(5)
        ? 0
        : draw.int(1, 2000) / 100;
  const rule: ContributionRuleFile = { id, type, amount, timing };
  if (draw.chance(50)) {
    rule.name = `Rule ${id}`;
  }
  const enabledRoll = draw.int(1, 100);
  if (enabledRoll <= 10) {
    rule.enabled = false;
  } else if (enabledRoll <= 25) {
    rule.enabled = true;
  }
  if (type === 'salaryPercent' ? draw.chance(75) : draw.chance(5)) {
    rule.salaryBasis = draw.pick(timing.frequency === 'oneTime' ? ONE_TIME_BASES : BASES);
  }
  if (timing.frequency === 'oneTime') {
    return rule;
  }
  const growth = draw.chance(25) ? drawGrowth(draw) : undefined;
  const start = growth || draw.chance(30) ? drawRuleStart(draw, range) : undefined;
  if (growth) {
    rule.growth = growth;
  }
  if (start) {
    rule.startDate = formatPlainDate(start);
  }
  if (draw.chance(25)) {
    rule.endDate = formatPlainDate(drawRuleEnd(draw, range, start));
  }
  return rule;
}

function addOrderSensitiveRules(draw: Draw, account: AccountFile) {
  const timing = draw.pick(CLUSTER_TIMINGS);
  draw.pick(ORDER_SENSITIVE_CENTS).forEach((cents, index) => {
    account.contributions.push({
      id: `${account.id}s${String(index + 1)}`,
      type: 'flat',
      amount: cents / 100,
      timing: { ...timing }
    });
  });
}

function addLongGrowthRule(draw: Draw, account: AccountFile, today: PlainDate) {
  account.contributions.push({
    id: `${account.id}g`,
    type: 'flat',
    amount: draw.int(100, 100_000) / 100,
    growth: { type: 'percent', amount: draw.int(1, 50) / 100, cadence: 'monthly' },
    timing: { frequency: 'monthly', day: drawDay(draw) },
    startDate: formatPlainDate(
      addDays(today, -draw.int(LONG_GROWTH_DAYS.from, LONG_GROWTH_DAYS.to))
    )
  });
}
