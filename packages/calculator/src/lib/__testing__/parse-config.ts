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
} from './legacy-config';

const SALARY_BASES: ReadonlyArray<SalaryBasis> = [
  'annual',
  'monthly',
  'biweekly',
  'weekly',
  'daily',
  'perContribution'
];

const TIMING_KEYS = {
  oneTime: ['frequency', 'on'],
  monthly: ['frequency', 'day', 'placement'],
  annual: ['frequency', 'month', 'day', 'placement']
} as const;

export class ConfigParseError extends Error {
  readonly path: string;

  constructor(path: string, problem: string) {
    super(`${path || 'the root'}: ${problem}.`);
    this.name = 'ConfigParseError';
    this.path = path;
  }
}

export function childPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function fail(path: string, problem: string): never {
  throw new ConfigParseError(path, problem);
}

export function asObject(value: unknown, path: string, keys: ReadonlyArray<string>): object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  const unknownKey = Object.keys(value).find((key) => !keys.includes(key));
  if (unknownKey !== undefined) {
    return fail(childPath(path, unknownKey), 'unknown key');
  }
  return value;
}

function asNumber(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fail(path, 'expected a finite number');
}

export function asString(value: unknown, path: string): string {
  return typeof value === 'string' ? value : fail(path, 'expected a string');
}

function asBoolean(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : fail(path, 'expected a boolean');
}

function asOneOf<T extends string>(value: unknown, options: ReadonlyArray<T>, path: string): T {
  return (
    options.find((option) => option === value) ?? fail(path, `expected ${options.join(' | ')}`)
  );
}

function parseInterest(value: unknown, path: string): Interest {
  const interest = asObject(value, path, ['annualRate', 'variance', 'compounding']);
  const parsed: Interest = {
    annualRate: asNumber(
      'annualRate' in interest ? interest.annualRate : undefined,
      childPath(path, 'annualRate')
    )
  };
  if ('variance' in interest) {
    parsed.variance = asNumber(interest.variance, childPath(path, 'variance'));
  }
  if ('compounding' in interest) {
    parsed.compounding = asOneOf(
      interest.compounding,
      ['monthly', 'daily'] as const,
      childPath(path, 'compounding')
    );
  }
  return parsed;
}

function parseSalary(value: unknown, path: string): SalaryConfig {
  const salary = asObject(value, path, ['annualBase', 'annualRaiseRate']);
  const parsed: SalaryConfig = {
    annualBase: asNumber(
      'annualBase' in salary ? salary.annualBase : undefined,
      childPath(path, 'annualBase')
    )
  };
  if ('annualRaiseRate' in salary) {
    parsed.annualRaiseRate = asNumber(salary.annualRaiseRate, childPath(path, 'annualRaiseRate'));
  }
  return parsed;
}

function parseGrowth(value: unknown, path: string): ContributionGrowth {
  const growth = asObject(value, path, ['type', 'amount', 'cadence']);
  return {
    type: asOneOf(
      'type' in growth ? growth.type : undefined,
      ['percent', 'flat'] as const,
      childPath(path, 'type')
    ),
    amount: asNumber('amount' in growth ? growth.amount : undefined, childPath(path, 'amount')),
    cadence: asOneOf(
      'cadence' in growth ? growth.cadence : undefined,
      ['annual', 'monthly'] as const,
      childPath(path, 'cadence')
    )
  };
}

function parseYearRange(value: unknown, path: string): YearRange {
  const range = asObject(value, path, ['start', 'end']);
  const parsed: YearRange = {};
  if ('start' in range) {
    parsed.start = asNumber(range.start, childPath(path, 'start'));
  }
  if ('end' in range) {
    parsed.end = asNumber(range.end, childPath(path, 'end'));
  }
  return parsed;
}

function parseOneTime(value: unknown, path: string): ContributionTimingOneTime {
  const on = asObject(value, path, ['month', 'year', 'day']);
  const parsed: ContributionTimingOneTime = {
    frequency: 'oneTime',
    on: {
      month: asNumber('month' in on ? on.month : undefined, childPath(path, 'month')),
      year: asNumber('year' in on ? on.year : undefined, childPath(path, 'year'))
    }
  };
  if ('day' in on) {
    parsed.on.day = asNumber(on.day, childPath(path, 'day'));
  }
  return parsed;
}

function parseTiming(value: unknown, path: string): ContributionTiming {
  const anyTiming = asObject(value, path, ['frequency', 'on', 'month', 'day', 'placement']);
  const frequency = asOneOf(
    'frequency' in anyTiming ? anyTiming.frequency : undefined,
    ['oneTime', 'monthly', 'annual'] as const,
    childPath(path, 'frequency')
  );
  const timing = asObject(anyTiming, path, TIMING_KEYS[frequency]);
  if (frequency === 'oneTime') {
    return parseOneTime('on' in timing ? timing.on : undefined, childPath(path, 'on'));
  }

  const parsed: ContributionTimingMonthly | ContributionTimingAnnual =
    frequency === 'monthly'
      ? { frequency }
      : {
          frequency,
          month: asNumber('month' in timing ? timing.month : undefined, childPath(path, 'month'))
        };
  if ('day' in timing) {
    parsed.day = asNumber(timing.day, childPath(path, 'day'));
  }
  if ('placement' in timing) {
    parsed.placement = asOneOf(
      timing.placement,
      ['start', 'end'] as const,
      childPath(path, 'placement')
    );
  }
  return parsed;
}

function parseRule(value: unknown, path: string): ContributionRule {
  const rule = asObject(value, path, [
    'id',
    'name',
    'enabled',
    'type',
    'amount',
    'growth',
    'salaryBasis',
    'timing',
    'yearRange'
  ]);
  const parsed: ContributionRule = {
    id: asString('id' in rule ? rule.id : undefined, childPath(path, 'id')),
    type: asOneOf(
      'type' in rule ? rule.type : undefined,
      ['flat', 'salaryPercent'] as const,
      childPath(path, 'type')
    ),
    amount: asNumber('amount' in rule ? rule.amount : undefined, childPath(path, 'amount')),
    timing: parseTiming('timing' in rule ? rule.timing : undefined, childPath(path, 'timing'))
  };
  if ('name' in rule) {
    parsed.name = asString(rule.name, childPath(path, 'name'));
  }
  if ('enabled' in rule) {
    parsed.enabled = asBoolean(rule.enabled, childPath(path, 'enabled'));
  }
  if ('growth' in rule) {
    parsed.growth = parseGrowth(rule.growth, childPath(path, 'growth'));
  }
  if ('salaryBasis' in rule) {
    parsed.salaryBasis = asOneOf(rule.salaryBasis, SALARY_BASES, childPath(path, 'salaryBasis'));
  }
  if ('yearRange' in rule) {
    parsed.yearRange = parseYearRange(rule.yearRange, childPath(path, 'yearRange'));
  }
  return parsed;
}

export function parseRetirementConfig(value: unknown, path = ''): RetirementConfig {
  const config = asObject(value, path, [
    'currentBalance',
    'timeHorizonYears',
    'startDate',
    'interest',
    'salary',
    'contributions'
  ]);
  const contributionsPath = childPath(path, 'contributions');
  const contributions = 'contributions' in config ? config.contributions : undefined;
  if (!Array.isArray(contributions)) {
    return fail(contributionsPath, 'expected an array');
  }
  const parsed: RetirementConfig = {
    currentBalance: asNumber(
      'currentBalance' in config ? config.currentBalance : undefined,
      childPath(path, 'currentBalance')
    ),
    timeHorizonYears: asNumber(
      'timeHorizonYears' in config ? config.timeHorizonYears : undefined,
      childPath(path, 'timeHorizonYears')
    ),
    interest: parseInterest(
      'interest' in config ? config.interest : undefined,
      childPath(path, 'interest')
    ),
    salary: parseSalary('salary' in config ? config.salary : undefined, childPath(path, 'salary')),
    contributions: contributions.map((rule: unknown, index) =>
      parseRule(rule, `${contributionsPath}[${index}]`)
    )
  };
  if ('startDate' in config) {
    parsed.startDate = asString(config.startDate, childPath(path, 'startDate'));
  }
  return parsed;
}
