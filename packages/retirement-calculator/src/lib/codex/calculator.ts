import type {
  AnnualProjection,
  ContributionRule,
  ContributionTiming,
  MonthlyProjection,
  Projection,
  ProjectionByVariance,
  RetirementConfig,
  SalaryConfig,
} from './types';

const MONTHS_PER_YEAR = 12;
const DEFAULT_DAYS_PER_YEAR = 365;

export function calculateRetirement(config: RetirementConfig): ProjectionByVariance {
  const baseline = calculateProjection(config, config.interest.annualRate);

  if (config.interest.variance === undefined || config.interest.variance === 0) {
    return {
      baseline,
      positive: baseline,
      negative: baseline,
    };
  }

  const positive = calculateProjection(config, config.interest.annualRate + config.interest.variance);
  const negative = calculateProjection(config, config.interest.annualRate - config.interest.variance);
  return { baseline, positive, negative };
}

export function calculateProjection(config: RetirementConfig, annualRate: number): Projection {
  const startDate = normalizeStartDate(config.startDate);
  const totalMonths = config.timeHorizonYears * MONTHS_PER_YEAR;
  const compounding = config.interest.compounding ?? 'monthly';

  let runningBalance = config.currentBalance;
  let totalContributions = 0;
  let totalInterest = 0;

  const monthlyProjections: MonthlyProjection[] = [];
  const yearlyProjections: AnnualProjection[] = [];

  for (let monthOffset = 0; monthOffset < totalMonths; monthOffset++) {
    const monthStart = addMonths(startDate, monthOffset);
    const { yearIndex, monthIndex } = resolveYearMonth(startDate, monthOffset);
    const salary = calculateSalary(config.salary, yearIndex);

    const monthContributions = resolveMonthlyContributions({
      rules: config.contributions,
      yearIndex,
      monthIndex,
      timeHorizonYears: config.timeHorizonYears,
      salary,
      compounding,
      monthStart,
    });

    if (compounding === 'daily') {
      const { balance, contributions, interest } = applyDailyCompounding({
        balance: runningBalance,
        annualRate,
        contributions: monthContributions,
        monthStart,
      });
      runningBalance = balance;
      totalContributions += contributions;
      totalInterest += interest;
    }
    else {
      const { balance, contributions, interest } = applyMonthlyCompounding({
        balance: runningBalance,
        annualRate,
        contributions: monthContributions,
        monthStart,
      });
      runningBalance = balance;
      totalContributions += contributions;
      totalInterest += interest;
    }

    monthlyProjections.push({
      month: monthIndex,
      year: yearIndex,
      balance: runningBalance,
      contributions: totalContributions,
      interest: totalInterest,
      salary,
    });

    if ((monthOffset + 1) % MONTHS_PER_YEAR === 0) {
      yearlyProjections.push({
        year: yearIndex,
        balance: runningBalance,
        contributions: totalContributions,
        interest: totalInterest,
        salary,
      });
    }
  }

  return {
    finalBalance: runningBalance,
    totalContributions,
    totalGrowth: runningBalance - config.currentBalance,
    yearlyProjections,
    monthlyProjections,
  };
}

interface ResolveMonthlyContributionsParams {
  rules: ContributionRule[];
  yearIndex: number;
  monthIndex: number; // 0-11
  timeHorizonYears: number;
  salary: number;
  compounding: 'monthly' | 'daily';
  monthStart: Date;
}

interface MonthlyContributionBucket {
  start: number;
  end: number;
  byDay: Record<number, number>;
}

function resolveMonthlyContributions(params: ResolveMonthlyContributionsParams): MonthlyContributionBucket {
  const { rules, yearIndex, monthIndex, timeHorizonYears, salary, compounding, monthStart } = params;
  const bucket: MonthlyContributionBucket = {
    start: 0,
    end: 0,
    byDay: {},
  };

  for (const rule of rules) {
    if (!isContributionActive(rule, yearIndex, monthIndex, timeHorizonYears)) continue;

    const amount = resolveContributionAmount(rule, salary);
    if (amount === 0) continue;

    const day = resolveContributionDay(rule.timing, compounding, monthStart);
    if (day === 'start') {
      bucket.start += amount;
    }
    else if (day === 'end') {
      bucket.end += amount;
    }
    else {
      bucket.byDay[day] = (bucket.byDay[day] ?? 0) + amount;
    }
  }

  return bucket;
}

function isContributionActive(rule: ContributionRule, yearIndex: number, monthIndex: number, timeHorizonYears: number) {
  if (rule.enabled === false) return false;

  const timing = rule.timing;

  if (timing.frequency === 'oneTime') {
    return timing.on.year === yearIndex && timing.on.month === monthIndex;
  }

  const rangeStart = rule.yearRange?.start ?? 0;
  const rangeEnd = rule.yearRange?.end ?? timeHorizonYears;
  if (yearIndex < rangeStart || yearIndex > rangeEnd) return false;

  if (timing.frequency === 'annual') {
    return timing.month === monthIndex;
  }

  return true;
}

function resolveContributionAmount(rule: ContributionRule, salary: number) {
  if (rule.type === 'salaryPercent') {
    const basis = rule.salaryBasis ?? 'annual';
    const annualSalary = salary;

    if (basis === 'annual') {
      return annualSalary * (rule.amount / 100);
    }
    if (basis === 'monthly') {
      return (annualSalary / 12) * (rule.amount / 100);
    }
    if (basis === 'biweekly') {
      return (annualSalary / 26) * (rule.amount / 100);
    }
    if (basis === 'weekly') {
      return (annualSalary / 52) * (rule.amount / 100);
    }
    if (basis === 'daily') {
      return (annualSalary / DEFAULT_DAYS_PER_YEAR) * (rule.amount / 100);
    }

    if (rule.timing.frequency === 'annual') {
      return annualSalary * (rule.amount / 100);
    }
    if (rule.timing.frequency === 'monthly') {
      return (annualSalary / 12) * (rule.amount / 100);
    }
    throw new Error(`salaryBasis \"perContribution\" is not supported for oneTime contributions (id: ${rule.id}).`);
  }

  return rule.amount;
}

function resolveContributionDay(
  timing: ContributionTiming,
  compounding: 'monthly' | 'daily',
  monthStart: Date,
): 'start' | 'end' | number {
  const daysInMonth = getDaysInMonth(monthStart);
  if (compounding === 'daily') {
    if (timing.frequency === 'oneTime') {
      return clampDay(timing.on.day ?? 1, daysInMonth);
    }
    if (timing.day) return clampDay(timing.day, daysInMonth);
  }

  const placement = timing.frequency === 'oneTime' ? 'start' : timing.placement ?? 'start';
  if (timing.frequency === 'annual' || timing.frequency === 'monthly') {
    if (timing.day && compounding === 'monthly') {
      const midpoint = Math.ceil(daysInMonth / 2);
      return timing.day <= midpoint ? 'start' : 'end';
    }
  }

  return placement;
}

function applyMonthlyCompounding(params: {
  balance: number;
  annualRate: number;
  contributions: MonthlyContributionBucket;
  monthStart?: Date;
}) {
  const monthlyRate = annualToMonthlyRate(params.annualRate);
  const daysInMonth = params.monthStart ? getDaysInMonth(params.monthStart) : 30;
  const midpoint = Math.ceil(daysInMonth / 2);
  const startContribution = params.contributions.start + sumByDay(params.contributions.byDay, 1, midpoint);
  const endContribution = params.contributions.end + sumByDay(params.contributions.byDay, midpoint + 1, daysInMonth);

  const balanceAfterStart = params.balance + startContribution;
  const interest = balanceAfterStart * monthlyRate;
  const balance = balanceAfterStart + interest + endContribution;

  return {
    balance,
    contributions: startContribution + endContribution,
    interest,
  };
}

function applyDailyCompounding(params: {
  balance: number;
  annualRate: number;
  contributions: MonthlyContributionBucket;
  monthStart: Date;
}) {
  const daysInMonth = getDaysInMonth(params.monthStart);
  const daysInYear = getDaysInYear(params.monthStart);
  const dailyRate = annualToDailyRate(params.annualRate, daysInYear);
  let balance = params.balance;
  let contributions = 0;
  let interest = 0;

  const dailyContributions = toDailyMap(params.contributions, daysInMonth);

  for (let day = 1; day <= daysInMonth; day++) {
    const added = dailyContributions[day] ?? 0;
    if (added) {
      balance += added;
      contributions += added;
    }
    const dailyInterest = balance * dailyRate;
    balance += dailyInterest;
    interest += dailyInterest;
  }

  return { balance, contributions, interest };
}

function toDailyMap(bucket: MonthlyContributionBucket, daysInMonth: number) {
  const daily: Record<number, number> = { ...bucket.byDay };
  if (bucket.start) daily[1] = (daily[1] ?? 0) + bucket.start;
  if (bucket.end) daily[daysInMonth] = (daily[daysInMonth] ?? 0) + bucket.end;
  return daily;
}

function sumByDay(byDay: Record<number, number>, start: number, end: number) {
  let total = 0;
  for (let day = start; day <= end; day++) {
    total += byDay[day] ?? 0;
  }
  return total;
}

function resolveYearMonth(startDate: Date, monthOffset: number) {
  const startMonthIndex = startDate.getMonth();
  const startYear = startDate.getFullYear();
  const absoluteMonthIndex = startMonthIndex + monthOffset;
  const yearIndex = Math.floor(absoluteMonthIndex / MONTHS_PER_YEAR);
  const monthIndex = absoluteMonthIndex % MONTHS_PER_YEAR;

  return { yearIndex, monthIndex, absoluteYear: startYear + yearIndex };
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

function annualToMonthlyRate(annualRate: number) {
  return (1 + annualRate) ** (1 / MONTHS_PER_YEAR) - 1;
}

function annualToDailyRate(annualRate: number, daysInYear: number) {
  return (1 + annualRate) ** (1 / daysInYear) - 1;
}

function clampDay(day: number, daysInMonth: number) {
  if (day < 1) return 1;
  if (day > daysInMonth) return daysInMonth;
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
