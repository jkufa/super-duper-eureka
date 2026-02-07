import type { ContributionRule, ContributionTiming, RetirementConfig } from './types';

export interface RandomConfigOptions {
  /** Default: 65 */
  retirementAge?: number;
  /** Default: 22 */
  minWorkingAge?: number;
  /** Default: 60 */
  maxWorkingAge?: number;
}

export type SeededRandom = () => number;

const RANGE = {
  salary: { min: 25000, max: 250000, mu: Math.log(60000), sigma: 0.55, roundTo: 100 },
  age: { mean: 38, stddev: 9 },
  raiseRate: { min: 0, max: 0.06, mode: 0.03, low: 0.01, high: 0.05 },
  interestRate: { min: 0.03, max: 0.09, mode: 0.06, low: 0.045, high: 0.08 },
  interestVariance: { min: 0, max: 0.04, mode: 0.02, low: 0.01, high: 0.03 },
  savingsRate: { min: 0.01, max: 0.3, mode: 0.12, low: 0.05, high: 0.25 },
  balances: { min: 0, max: 2_000_000, roundTo: 100 },
  contributions: {
    employee401k: { min: 0, max: 20, mode: 8, low: 2, high: 15 },
    match401k: { min: 0, max: 6, mode: 3, low: 1, high: 6 },
    roth401k: { min: 0, max: 20, mode: 4, low: 0, high: 10 },
    bonusPercent: { min: 0, max: 30, mode: 8, low: 0, high: 20 },
    esppPercent: { min: 0, max: 15, mode: 4, low: 0, high: 10 },
    hsaEmployeeMonthly: { min: 0, max: 400, mode: 150, low: 0, high: 350 },
    hsaEmployerMonthly: { min: 0, max: 150, mode: 40, low: 0, high: 120 },
    iraAnnual: { min: 0, max: 8000, mode: 3500, low: 0, high: 7000 },
    brokerageMonthly: { min: 0, max: 2500, mode: 300, low: 0, high: 2000 },
    rsuAnnual: { min: 0, max: 50000, modeFactor: 0.08, highFactor: 0.3 },
    collegeMonthly: { min: 0, max: 600, mode: 120, low: 0, high: 500 },
    cryptoMonthly: { min: 0, max: 300, mode: 60, low: 0, high: 200 },
  },
};

export function createRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomRetirementConfig(
  seed: number,
  options: RandomConfigOptions = {},
): RetirementConfig {
  const rng = createSeededRandom(seed);
  const retirementAge = options.retirementAge ?? 65;
  const minWorkingAge = options.minWorkingAge ?? 22;
  const maxWorkingAge = options.maxWorkingAge ?? 60;

  const age = clampInt(
    roundNormal(rng, RANGE.age.mean, RANGE.age.stddev),
    minWorkingAge,
    maxWorkingAge,
  );
  const timeHorizonYears = clampInt(retirementAge - age, 5, 45);

  const annualBase = roundToRange(
    sampleLogNormal(rng, RANGE.salary.mu, RANGE.salary.sigma),
    RANGE.salary,
  );

  const annualRaiseRate = sampleTriangularClamped(rng, RANGE.raiseRate);
  const interestAnnualRate = sampleTriangularClamped(rng, RANGE.interestRate);
  const interestVariance = sampleTriangularClamped(rng, RANGE.interestVariance);

  const yearsWorking = Math.max(0, age - minWorkingAge);
  const savingsRate = sampleTriangularClamped(rng, RANGE.savingsRate);
  const avgSalary = annualBase * (0.7 + rng() * 0.6);
  const growthFactor = 0.6 + rng() * 1.2;
  const currentBalance = roundToRange(
    avgSalary * savingsRate * yearsWorking * growthFactor,
    RANGE.balances,
  );

  const contributions = buildContributionRules(rng, annualBase);
  const startDate = new Date(new Date().getFullYear(), 0, 1).toISOString();

  return {
    currentBalance,
    timeHorizonYears,
    startDate,
    interest: {
      annualRate: interestAnnualRate,
      variance: interestVariance,
      compounding: 'monthly',
    },
    salary: {
      annualBase,
      annualRaiseRate,
    },
    contributions,
  };
}

function buildContributionRules(rng: SeededRandom, annualBase: number): ContributionRule[] {
  const employee401k = sampleTriangularClamped(rng, RANGE.contributions.employee401k);
  const match401k = employee401k > 0
    ? clampFloat(
        sampleTriangular(rng, RANGE.contributions.match401k.low, RANGE.contributions.match401k.mode, RANGE.contributions.match401k.high),
        RANGE.contributions.match401k.min,
        Math.min(RANGE.contributions.match401k.max, Math.max(0, employee401k * 0.75)),
      )
    : 0;

  const roth401k = clampFloat(
    sampleTriangular(rng, RANGE.contributions.roth401k.low, RANGE.contributions.roth401k.mode, RANGE.contributions.roth401k.high),
    RANGE.contributions.roth401k.min,
    Math.min(RANGE.contributions.roth401k.max, Math.max(0, 20 - employee401k)),
  );

  const bonusPercent = sampleTriangularClamped(rng, RANGE.contributions.bonusPercent);
  const esppPercent = sampleTriangularClamped(rng, RANGE.contributions.esppPercent);

  const hsaEmployeeMonthly = sampleTriangularRounded(rng, RANGE.contributions.hsaEmployeeMonthly, 1);
  const hsaEmployerMonthly = sampleTriangularRounded(rng, RANGE.contributions.hsaEmployerMonthly, 1);
  const iraAnnual = sampleTriangularRounded(rng, RANGE.contributions.iraAnnual, 1);
  const brokerageMonthly = sampleTriangularRounded(rng, RANGE.contributions.brokerageMonthly, 1);
  const rsuAnnual = sampleTriangularRounded(
    rng,
    {
      min: RANGE.contributions.rsuAnnual.min,
      max: RANGE.contributions.rsuAnnual.max,
      mode: annualBase * RANGE.contributions.rsuAnnual.modeFactor,
      low: 0,
      high: annualBase * RANGE.contributions.rsuAnnual.highFactor,
    },
    1,
  );
  const collegeMonthly = sampleTriangularRounded(rng, RANGE.contributions.collegeMonthly, 1);
  const cryptoMonthly = sampleTriangularRounded(rng, RANGE.contributions.cryptoMonthly, 1);

  const bonusTiming = annualTiming(rng);
  const rsuTiming = annualTiming(rng);
  const hsaEmployeeTiming = pickTiming(rng, ['monthly', 'annual'], [0.7, 0.3]);
  const hsaEmployerTiming = pickTiming(rng, ['monthly', 'annual'], [0.6, 0.4]);
  const cryptoTiming = pickTiming(rng, ['monthly', 'annual'], [0.65, 0.35]);

  return [
    makeRule(rng, {
      id: '401k-employee',
      name: '401(k) employee contribution',
      type: 'salaryPercent',
      amount: employee401k,
      salaryBasis: 'monthly',
      timing: monthlyTiming('start'),
    }),
    makeRule(rng, {
      id: '401k-match',
      name: '401(k) employer match',
      type: 'salaryPercent',
      amount: match401k,
      salaryBasis: 'monthly',
      timing: monthlyTiming('start'),
    }),
    makeRule(rng, {
      id: '401k-roth',
      name: 'Roth 401(k) contribution',
      type: 'salaryPercent',
      amount: roth401k,
      salaryBasis: 'monthly',
      timing: monthlyTiming('start'),
    }),
    makeRule(rng, {
      id: 'hsa-employee',
      name: 'HSA employee contribution',
      type: 'flat',
      amount: hsaEmployeeTiming === 'monthly' ? hsaEmployeeMonthly : hsaEmployeeMonthly * 12,
      timing: hsaEmployeeTiming === 'monthly' ? monthlyTiming('end') : annualTiming(rng),
    }),
    makeRule(rng, {
      id: 'hsa-employer',
      name: 'HSA employer contribution',
      type: 'flat',
      amount: hsaEmployerTiming === 'monthly' ? hsaEmployerMonthly : hsaEmployerMonthly * 12,
      timing: hsaEmployerTiming === 'monthly' ? monthlyTiming('start') : annualTiming(rng),
    }),
    makeRule(rng, {
      id: 'ira',
      name: 'IRA contribution',
      type: 'flat',
      amount: iraAnnual,
      timing: annualTiming(rng),
    }),
    makeRule(rng, {
      id: 'brokerage',
      name: 'Brokerage auto-invest',
      type: 'flat',
      amount: brokerageMonthly,
      timing: monthlyTiming('end'),
    }),
    makeRule(rng, {
      id: 'espp',
      name: 'ESPP contribution',
      type: 'salaryPercent',
      amount: esppPercent,
      salaryBasis: 'monthly',
      timing: monthlyTiming('start'),
    }),
    makeRule(rng, {
      id: 'annual-bonus',
      name: 'Annual bonus contribution',
      type: 'salaryPercent',
      amount: bonusPercent,
      salaryBasis: 'annual',
      timing: bonusTiming,
    }),
    makeRule(rng, {
      id: 'rsu-vesting',
      name: 'RSU vesting proceeds',
      type: 'flat',
      amount: rsuAnnual,
      timing: rsuTiming,
    }),
    makeRule(rng, {
      id: 'college-529',
      name: '529 contribution',
      type: 'flat',
      amount: collegeMonthly,
      timing: monthlyTiming('end'),
    }),
    makeRule(rng, {
      id: 'crypto',
      name: 'Crypto allocation',
      type: 'flat',
      amount: cryptoTiming === 'monthly' ? cryptoMonthly : cryptoMonthly * 12,
      timing: cryptoTiming === 'monthly' ? monthlyTiming('end') : annualTiming(rng),
    }),
  ];
}

function makeRule(rng: SeededRandom, rule: ContributionRule): ContributionRule {
  if (rule.type === 'salaryPercent' && rule.amount <= 0) {
    return { ...rule, enabled: false };
  }
  if (rule.type === 'flat' && rule.amount < 1) {
    return { ...rule, enabled: false };
  }
  const enabled = rng() < 0.85;
  return { ...rule, enabled };
}

function monthlyTiming(placement: 'start' | 'end'): ContributionTiming {
  return {
    frequency: 'monthly',
    placement,
  };
}

function annualTiming(rng: SeededRandom): ContributionTiming {
  return {
    frequency: 'annual',
    month: clampInt(Math.floor(rng() * 12), 0, 11),
    placement: rng() < 0.5 ? 'start' : 'end',
  };
}

function pickTiming<T extends string>(
  rng: SeededRandom,
  options: readonly T[],
  weights: readonly number[],
): T {
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = rng() * total;
  for (let index = 0; index < options.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll <= 0) {
      const selection = options[index];
      if (selection !== undefined) {
        return selection;
      }
    }
  }
  const timing = options[0] ?? options[options.length - 1] ?? options[0];
  if (!timing) {
    throw new Error('No timing selected');
  }
  return timing;
}

function sampleTriangular(rng: SeededRandom, min: number, mode: number, max: number): number {
  const u = rng();
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function sampleTriangularClamped(
  rng: SeededRandom,
  range: { min: number; max: number; low: number; mode: number; high: number },
): number {
  return clampFloat(sampleTriangular(rng, range.low, range.mode, range.high), range.min, range.max);
}

function sampleTriangularRounded(
  rng: SeededRandom,
  range: { min: number; max: number; low: number; mode: number; high: number },
  step: number,
): number {
  return roundTo(clampFloat(sampleTriangular(rng, range.low, range.mode, range.high), range.min, range.max), step);
}

function roundNormal(rng: SeededRandom, mean: number, stddev: number): number {
  return Math.round(mean + stddev * sampleNormal(rng));
}

function sampleNormal(rng: SeededRandom): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleLogNormal(rng: SeededRandom, mu: number, sigma: number): number {
  return Math.exp(mu + sigma * sampleNormal(rng));
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function roundToRange(
  value: number,
  range: { min: number; max: number; roundTo: number },
): number {
  return roundTo(clampFloat(value, range.min, range.max), range.roundTo);
}
