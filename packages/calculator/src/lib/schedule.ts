import type {
  CompoundingFrequency,
  ContributionRule,
  ContributionTiming,
  Interest,
  RetirementConfig,
  SalaryConfig
} from './types';

const MONTHS_PER_YEAR = 12;
const DEFAULT_DAYS_PER_YEAR = 365;

export type ScheduleConfig = Pick<
  RetirementConfig,
  'timeHorizonYears' | 'startDate' | 'salary' | 'contributions'
> & { interest: Pick<Interest, 'compounding'> };

export type DepositBucket = 'start' | 'end' | number;

export interface Deposit {
  ruleId: string;
  ruleIndex: number;
  monthOffset: number;
  amount: number;
  bucket: DepositBucket;
}

export interface ScheduleMonth {
  yearIndex: number;
  monthIndex: number;
  daysInMonth: number;
  daysInYear: number;
  salary: number;
}

export interface Schedule {
  compounding: CompoundingFrequency;
  months: Array<ScheduleMonth>;
  deposits: Array<Deposit>;
}

export function buildSchedule(config: ScheduleConfig): Schedule {
  if (!Number.isFinite(config.timeHorizonYears) || config.timeHorizonYears < 0) {
    throw new Error(
      `timeHorizonYears must be 0 or greater (received ${String(config.timeHorizonYears)}).`
    );
  }

  const startDate = normalizeStartDate(config.startDate);
  const totalMonths = config.timeHorizonYears * MONTHS_PER_YEAR;
  const compounding = config.interest.compounding ?? 'monthly';
  validateContributionRules(config.contributions);

  const months: Array<ScheduleMonth> = [];
  const deposits: Array<Deposit> = [];

  for (let monthOffset = 0; monthOffset < totalMonths; monthOffset++) {
    const monthStart = addMonths(startDate, monthOffset);
    const { yearIndex, monthIndex } = resolveYearMonth(startDate, monthOffset);
    const salary = calculateSalary(config.salary, yearIndex);
    const daysInMonth = getDaysInMonth(monthStart);
    months.push({
      yearIndex,
      monthIndex,
      daysInMonth,
      daysInYear: getDaysInYear(monthStart),
      salary
    });

    for (const [ruleIndex, rule] of config.contributions.entries()) {
      if (
        !isContributionActive(
          rule,
          yearIndex,
          monthIndex,
          config.timeHorizonYears,
          monthStart,
          startDate
        )
      ) {
        continue;
      }

      const amount = resolveContributionAmount(rule, salary, yearIndex, monthIndex);
      if (amount === 0) {
        continue;
      }

      deposits.push({
        ruleId: rule.id,
        ruleIndex,
        monthOffset,
        amount,
        bucket: resolveBucket(rule.timing, compounding, daysInMonth)
      });
    }
  }

  return { compounding, months, deposits };
}

function isContributionActive(
  rule: ContributionRule,
  yearIndex: number,
  monthIndex: number,
  timeHorizonYears: number,
  monthStart: Date,
  projectionStartDate: Date
) {
  if (rule.enabled === false) {
    return false;
  }

  const timing = rule.timing;
  const isStartMonth =
    monthStart.getFullYear() === projectionStartDate.getFullYear() &&
    monthStart.getMonth() === projectionStartDate.getMonth();
  const startDay = projectionStartDate.getDate();
  const isPastStartDay = (day: number) => clampDay(day, getDaysInMonth(monthStart)) < startDay;

  if (timing.frequency === 'oneTime') {
    if (timing.on.year !== yearIndex || timing.on.month !== monthIndex) {
      return false;
    }
    if (!isStartMonth || yearIndex !== 0) {
      return true;
    }
    if (!timing.on.day) {
      return true;
    }
    return !isPastStartDay(timing.on.day);
  }

  const rangeStart = rule.yearRange?.start ?? 0;
  const rangeEnd = rule.yearRange?.end ?? timeHorizonYears;
  if (yearIndex < rangeStart || yearIndex > rangeEnd) {
    return false;
  }

  if (timing.frequency === 'annual') {
    if (timing.month !== monthIndex) {
      return false;
    }
    if (!isStartMonth || yearIndex !== 0) {
      return true;
    }
    if (!timing.day) {
      return true;
    }
    return !isPastStartDay(timing.day);
  }

  if (isStartMonth && yearIndex === 0 && timing.day) {
    return !isPastStartDay(timing.day);
  }

  return true;
}

function resolveContributionAmount(
  rule: ContributionRule,
  salary: number,
  yearIndex: number,
  monthIndex: number
) {
  const effectiveAmount = resolveEffectiveRuleAmount(rule, yearIndex, monthIndex);

  if (rule.type === 'salaryPercent') {
    const basis = rule.salaryBasis ?? 'annual';
    const annualSalary = salary;

    if (basis === 'annual') {
      return annualSalary * (effectiveAmount / 100);
    }
    if (basis === 'monthly') {
      return (annualSalary / 12) * (effectiveAmount / 100);
    }
    if (basis === 'biweekly') {
      return (annualSalary / 26) * (effectiveAmount / 100);
    }
    if (basis === 'weekly') {
      return (annualSalary / 52) * (effectiveAmount / 100);
    }
    if (basis === 'daily') {
      return (annualSalary / DEFAULT_DAYS_PER_YEAR) * (effectiveAmount / 100);
    }

    if (rule.timing.frequency === 'annual') {
      return annualSalary * (effectiveAmount / 100);
    }
    if (rule.timing.frequency === 'monthly') {
      return (annualSalary / 12) * (effectiveAmount / 100);
    }
    throw new Error(
      `salaryBasis "perContribution" is not supported for oneTime contributions (id: ${rule.id}).`
    );
  }

  return effectiveAmount;
}

function resolveEffectiveRuleAmount(rule: ContributionRule, yearIndex: number, monthIndex: number) {
  const baseAmount = rule.amount;
  const growth = rule.growth;
  if (!growth) {
    return Math.max(0, baseAmount);
  }

  const growthPeriods =
    growth.cadence === 'annual' ? yearIndex : yearIndex * MONTHS_PER_YEAR + monthIndex;

  if (growth.type === 'percent') {
    const rate = growth.amount / 100;
    return Math.max(0, baseAmount * (1 + rate) ** growthPeriods);
  }

  return Math.max(0, baseAmount + growth.amount * growthPeriods);
}

function validateContributionRules(rules: Array<ContributionRule>) {
  for (const rule of rules) {
    if (!rule.growth) {
      continue;
    }
    if (!Number.isFinite(rule.growth.amount) || rule.growth.amount < 0) {
      throw new Error(`growth.amount must be 0 or greater for contribution "${rule.id}".`);
    }
  }
}

function resolveBucket(
  timing: ContributionTiming,
  compounding: CompoundingFrequency,
  daysInMonth: number
): DepositBucket {
  if (compounding === 'daily') {
    if (timing.frequency === 'oneTime') {
      return clampDay(timing.on.day ?? 1, daysInMonth);
    }
    if (timing.day) {
      return clampDay(timing.day, daysInMonth);
    }
  }

  const placement = timing.frequency === 'oneTime' ? 'start' : (timing.placement ?? 'start');
  if (timing.frequency === 'annual' || timing.frequency === 'monthly') {
    if (timing.day && compounding === 'monthly') {
      const midpoint = Math.ceil(daysInMonth / 2);
      return timing.day <= midpoint ? 'start' : 'end';
    }
  }

  return placement;
}

function resolveYearMonth(startDate: Date, monthOffset: number) {
  const absoluteMonthIndex = startDate.getMonth() + monthOffset;
  return {
    yearIndex: Math.floor(absoluteMonthIndex / MONTHS_PER_YEAR),
    monthIndex: absoluteMonthIndex % MONTHS_PER_YEAR
  };
}

function normalizeStartDate(startDate?: Date | string) {
  if (!startDate) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (typeof startDate === 'string') {
    const parsed = new Date(startDate);
    return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
}

function calculateSalary(salary: SalaryConfig, yearIndex: number) {
  const raiseRate = salary.annualRaiseRate ?? 0;
  return salary.annualBase * (1 + raiseRate) ** yearIndex;
}

function clampDay(day: number, daysInMonth: number) {
  if (day < 1) {
    return 1;
  }
  if (day > daysInMonth) {
    return daysInMonth;
  }
  return day;
}

function addMonths(date: Date, monthsToAdd: number) {
  return new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
}

function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getDaysInYear(date: Date) {
  const year = date.getFullYear();
  const isLeap = new Date(year, 1, 29).getDate() === 29;
  return isLeap ? 366 : 365;
}
