import type {
  ContributionGrowth,
  ContributionRule,
  ContributionTiming,
  ContributionTimingAnnual,
  ContributionTimingMonthly,
  ContributionTimingOneTime,
  Interest,
  RetirementConfig,
  SalaryBasis,
  SalaryConfig,
  YearRange
} from '../types';

const SALARY_BASES: ReadonlyArray<SalaryBasis> = [
  'annual',
  'monthly',
  'biweekly',
  'weekly',
  'daily',
  'perContribution'
];

function fail(path: string): never {
  throw new Error(`Invalid retirement config at ${path}.`);
}

function asObject(value: unknown, path: string): object {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : fail(path);
}

function asNumber(value: unknown, path: string): number {
  return typeof value === 'number' ? value : fail(path);
}

function asString(value: unknown, path: string): string {
  return typeof value === 'string' ? value : fail(path);
}

function asBoolean(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : fail(path);
}

function asOneOf<T extends string>(value: unknown, options: ReadonlyArray<T>, path: string): T {
  return options.find((option) => option === value) ?? fail(path);
}

function parseInterest(value: unknown): Interest {
  const interest = asObject(value, 'interest');
  const parsed: Interest = {
    annualRate: asNumber(
      'annualRate' in interest ? interest.annualRate : undefined,
      'interest.annualRate'
    )
  };
  if ('variance' in interest) {
    parsed.variance = asNumber(interest.variance, 'interest.variance');
  }
  if ('compounding' in interest) {
    parsed.compounding = asOneOf(
      interest.compounding,
      ['monthly', 'daily'] as const,
      'interest.compounding'
    );
  }
  return parsed;
}

function parseSalary(value: unknown): SalaryConfig {
  const salary = asObject(value, 'salary');
  const parsed: SalaryConfig = {
    annualBase: asNumber(
      'annualBase' in salary ? salary.annualBase : undefined,
      'salary.annualBase'
    )
  };
  if ('annualRaiseRate' in salary) {
    parsed.annualRaiseRate = asNumber(salary.annualRaiseRate, 'salary.annualRaiseRate');
  }
  return parsed;
}

function parseGrowth(value: unknown, path: string): ContributionGrowth {
  const growth = asObject(value, path);
  return {
    type: asOneOf('type' in growth ? growth.type : undefined, ['percent', 'flat'] as const, path),
    amount: asNumber('amount' in growth ? growth.amount : undefined, path),
    cadence: asOneOf(
      'cadence' in growth ? growth.cadence : undefined,
      ['annual', 'monthly'] as const,
      path
    )
  };
}

function parseYearRange(value: unknown, path: string): YearRange {
  const range = asObject(value, path);
  const parsed: YearRange = {};
  if ('start' in range) {
    parsed.start = asNumber(range.start, path);
  }
  if ('end' in range) {
    parsed.end = asNumber(range.end, path);
  }
  return parsed;
}

function parseOneTime(value: unknown, path: string): ContributionTimingOneTime {
  const on = asObject(value, path);
  const parsed: ContributionTimingOneTime = {
    frequency: 'oneTime',
    on: {
      month: asNumber('month' in on ? on.month : undefined, path),
      year: asNumber('year' in on ? on.year : undefined, path)
    }
  };
  if ('day' in on) {
    parsed.on.day = asNumber(on.day, path);
  }
  return parsed;
}

function parseTiming(value: unknown, path: string): ContributionTiming {
  const timing = asObject(value, path);
  const frequency = asOneOf(
    'frequency' in timing ? timing.frequency : undefined,
    ['oneTime', 'monthly', 'annual'] as const,
    path
  );
  if (frequency === 'oneTime') {
    return parseOneTime('on' in timing ? timing.on : undefined, path);
  }

  const parsed: ContributionTimingMonthly | ContributionTimingAnnual =
    frequency === 'monthly'
      ? { frequency }
      : { frequency, month: asNumber('month' in timing ? timing.month : undefined, path) };
  if ('day' in timing) {
    parsed.day = asNumber(timing.day, path);
  }
  if ('placement' in timing) {
    parsed.placement = asOneOf(timing.placement, ['start', 'end'] as const, path);
  }
  return parsed;
}

function parseRule(value: unknown, index: number): ContributionRule {
  const path = `contributions[${index}]`;
  const rule = asObject(value, path);
  const parsed: ContributionRule = {
    id: asString('id' in rule ? rule.id : undefined, path),
    type: asOneOf('type' in rule ? rule.type : undefined, ['flat', 'salaryPercent'] as const, path),
    amount: asNumber('amount' in rule ? rule.amount : undefined, path),
    timing: parseTiming('timing' in rule ? rule.timing : undefined, path)
  };
  if ('name' in rule) {
    parsed.name = asString(rule.name, path);
  }
  if ('enabled' in rule) {
    parsed.enabled = asBoolean(rule.enabled, path);
  }
  if ('growth' in rule) {
    parsed.growth = parseGrowth(rule.growth, path);
  }
  if ('salaryBasis' in rule) {
    parsed.salaryBasis = asOneOf(rule.salaryBasis, SALARY_BASES, path);
  }
  if ('yearRange' in rule) {
    parsed.yearRange = parseYearRange(rule.yearRange, path);
  }
  return parsed;
}

export function parseRetirementConfig(value: unknown): RetirementConfig {
  const config = asObject(value, 'config');
  const contributions = 'contributions' in config ? config.contributions : undefined;
  if (!Array.isArray(contributions)) {
    return fail('contributions');
  }
  const parsed: RetirementConfig = {
    currentBalance: asNumber(
      'currentBalance' in config ? config.currentBalance : undefined,
      'currentBalance'
    ),
    timeHorizonYears: asNumber(
      'timeHorizonYears' in config ? config.timeHorizonYears : undefined,
      'timeHorizonYears'
    ),
    interest: parseInterest('interest' in config ? config.interest : undefined),
    salary: parseSalary('salary' in config ? config.salary : undefined),
    contributions: contributions.map((rule: unknown, index) => parseRule(rule, index))
  };
  if ('startDate' in config) {
    parsed.startDate = asString(config.startDate, 'startDate');
  }
  return parsed;
}
