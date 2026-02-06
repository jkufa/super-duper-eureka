import { describe, expect, it, vi } from 'vitest';

import { calculateProjection, calculateRetirement } from '../calculator';
import { makeConfig, makeContribution } from '../factories';

const setSystemTime = (isoDate: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate));
};

const resetTimers = () => {
  vi.useRealTimers();
};

type Compounding = 'monthly' | 'daily';
type Frequency = 'oneTime' | 'monthly' | 'annual';
type Placement = 'start' | 'end';
type DayVariant = 'none' | 'mid' | 'end';
type YearRangeVariant = 'none' | 'startOnly' | 'endOnly' | 'range' | 'outOfRange';
type ContributionType = 'flat' | 'salaryPercent';
type SalaryBasis = 'annual' | 'monthly' | 'biweekly' | 'weekly' | 'daily' | 'perContribution';

const axes = {
  compounding: ['monthly', 'daily'] as Compounding[],
  frequency: ['oneTime', 'monthly', 'annual'] as Frequency[],
  placement: ['start', 'end'] as Placement[],
  day: ['none', 'mid', 'end'] as DayVariant[],
  startMonth: [0, 1, 11],
  yearRange: ['none', 'startOnly', 'endOnly', 'range', 'outOfRange'] as YearRangeVariant[],
  enabled: [true, false],
  contributionType: ['flat', 'salaryPercent'] as ContributionType[],
  salaryBasis: ['annual', 'monthly', 'biweekly', 'weekly', 'daily', 'perContribution'] as SalaryBasis[],
  raise: [0, 0.05],
  annualRate: [0, 0.05],
  variance: [0, 0.02],
};

interface Case {
  compounding: Compounding;
  frequency: Frequency;
  placement: Placement;
  day: DayVariant;
  startMonth: number;
  yearRange: YearRangeVariant;
  enabled: boolean;
  contributionType: ContributionType;
  salaryBasis: SalaryBasis;
  raise: number;
  annualRate: number;
  variance: number;
}

const defaultCase: Case = {
  compounding: axes.compounding[0],
  frequency: axes.frequency[0],
  placement: axes.placement[0],
  day: axes.day[0],
  startMonth: axes.startMonth[0],
  yearRange: axes.yearRange[0],
  enabled: axes.enabled[0],
  contributionType: axes.contributionType[0],
  salaryBasis: axes.salaryBasis[0],
  raise: axes.raise[0],
  annualRate: axes.annualRate[0],
  variance: axes.variance[0],
};

const axisEntries = Object.entries(axes) as [keyof Case, Case[keyof Case][]][];

const buildPairwiseCases = () => {
  const cases = new Map<string, Case>();

  for (let i = 0; i < axisEntries.length; i++) {
    const [axisA, valuesA] = axisEntries[i];
    for (let j = i + 1; j < axisEntries.length; j++) {
      const [axisB, valuesB] = axisEntries[j];
      for (const valueA of valuesA) {
        for (const valueB of valuesB) {
          const next: Case = { ...defaultCase };
          setCaseValue(next, axisA, valueA);
          setCaseValue(next, axisB, valueB);
          cases.set(JSON.stringify(next), next);
        }
      }
    }
  }

  return [...cases.values()];
};

const resolveYearRange = (variant: YearRangeVariant) => {
  if (variant === 'none') return undefined;
  if (variant === 'startOnly') return { start: 1 };
  if (variant === 'endOnly') return { end: 0 };
  if (variant === 'range') return { start: 0, end: 1 };
  return { start: 3, end: 4 };
};

const resolveTiming = (frequency: Frequency, placement: Placement, day: DayVariant, startMonth: number) => {
  const dayValue = day === 'none' ? undefined : day === 'mid' ? 15 : 28;

  if (frequency === 'oneTime') {
    return {
      frequency: 'oneTime' as const,
      on: { year: 0, month: startMonth, day: dayValue },
    };
  }

  if (frequency === 'annual') {
    return {
      frequency: 'annual' as const,
      month: startMonth,
      day: dayValue,
      placement,
    };
  }

  return {
    frequency: 'monthly' as const,
    day: dayValue,
    placement,
  };
};

const shouldThrow = (testCase: Case) =>
  testCase.contributionType === 'salaryPercent'
  && testCase.salaryBasis === 'perContribution'
  && testCase.frequency === 'oneTime';

const shouldContribute = (testCase: Case) => {
  if (!testCase.enabled) return false;
  if (testCase.frequency === 'oneTime') return true;
  if (testCase.yearRange === 'outOfRange') return false;
  return true;
};

describe('calculator', () => {
  describe('pairwise coverage', () => {
    const cases = buildPairwiseCases();

    for (const testCase of cases) {
      const label = [
        `compounding=${testCase.compounding}`,
        `frequency=${testCase.frequency}`,
        `placement=${testCase.placement}`,
        `day=${testCase.day}`,
        `startMonth=${String(testCase.startMonth)}`,
        `yearRange=${testCase.yearRange}`,
        `enabled=${String(testCase.enabled)}`,
        `type=${testCase.contributionType}`,
        `salaryBasis=${testCase.salaryBasis}`,
        `raise=${String(testCase.raise)}`,
        `annualRate=${String(testCase.annualRate)}`,
        `variance=${String(testCase.variance)}`,
      ].join(' ');

      it(`covers pairwise permutations (${label})`, () => {
        setSystemTime('2026-01-01T00:00:00.000Z');

        const config = makeConfig({
          currentBalance: 1000,
          timeHorizonYears: 2,
          startDate: new Date(2026, testCase.startMonth, 1),
          interest: { annualRate: testCase.annualRate, variance: testCase.variance, compounding: testCase.compounding },
          salary: { annualBase: 120000, annualRaiseRate: testCase.raise },
          contributions: [
            makeContribution({
              id: 'pairwise',
              enabled: testCase.enabled,
              type: testCase.contributionType,
              amount: testCase.contributionType === 'flat' ? 500 : 5,
              salaryBasis: testCase.salaryBasis,
              timing: resolveTiming(testCase.frequency, testCase.placement, testCase.day, testCase.startMonth),
              yearRange: resolveYearRange(testCase.yearRange),
            }),
          ],
        });

        if (shouldThrow(testCase)) {
          expect(() => calculateProjection(config, config.interest.annualRate)).toThrow(
            'salaryBasis "perContribution" is not supported for oneTime contributions (id: pairwise).',
          );
          resetTimers();
          return;
        }

        const result = calculateProjection(config, config.interest.annualRate);
        expect(result.monthlyProjections).toHaveLength(config.timeHorizonYears * 12);
        expect(result.yearlyProjections).toHaveLength(config.timeHorizonYears);
        expect(Number.isFinite(result.finalBalance)).toBe(true);

        if (testCase.annualRate === 0 && testCase.variance === 0) {
          expect(result.totalGrowth).toBeCloseTo(result.totalContributions, 6);
        }

        if (shouldContribute(testCase)) {
          expect(result.totalContributions).toBeGreaterThan(0);
        }
        else {
          expect(result.totalContributions).toBe(0);
        }

        resetTimers();
      });
    }
  });

  describe('core behaviors', () => {
    it('should calculate projections', () => {
      setSystemTime('2026-02-03T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 100000,
        timeHorizonYears: 10,
        interest: { annualRate: 0.05, variance: 0.02, compounding: 'monthly' },
        salary: { annualBase: 100000, annualRaiseRate: 0 },
        contributions: [],
      });

      const result = calculateProjection(config, config.interest.annualRate);
      expect(result).toBeDefined();

      const monthlyRate = (1 + config.interest.annualRate) ** (1 / 12) - 1;
      const expectedBalance = config.currentBalance * (1 + monthlyRate) ** (config.timeHorizonYears * 12);

      expect(result.finalBalance).toBeCloseTo(expectedBalance, 2);
      resetTimers();
    });

    it('respects JS month indexing for one-time contributions', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [
          makeContribution({
            id: 'one-time',
            type: 'flat',
            amount: 500,
            timing: { frequency: 'oneTime', on: { year: 0, month: 0 } },
          }),
        ],
      });

      const result = calculateProjection(config, config.interest.annualRate);

      expect(result.monthlyProjections[0]?.balance).toBe(1500);
      resetTimers();
    });

    it('uses real calendar days for daily compounding and clamps day in February', () => {
      setSystemTime('2024-02-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        startDate: '2024-02-01T00:00:00.000Z',
        interest: { annualRate: 0, compounding: 'daily' },
        contributions: [
          makeContribution({
            id: 'monthly-day-31',
            type: 'flat',
            amount: 200,
            timing: { frequency: 'monthly', day: 31 },
          }),
        ],
      });

      const result = calculateProjection(config, config.interest.annualRate);

      expect(result.monthlyProjections[0]?.balance).toBe(1200);
      resetTimers();
    });
  });

  describe('salary percent rules', () => {
    it('supports salary basis for salaryPercent contributions', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 0,
        timeHorizonYears: 1,
        salary: { annualBase: 120000, annualRaiseRate: 0 },
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [
          makeContribution({
            id: 'percent-monthly',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'monthly',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
        ],
      });

      const result = calculateProjection(config, config.interest.annualRate);

      expect(result.monthlyProjections[0]?.balance).toBe(1000);
      resetTimers();
    });

    it('throws when perContribution is used with oneTime contributions', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 0,
        timeHorizonYears: 1,
        salary: { annualBase: 120000, annualRaiseRate: 0 },
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [
          makeContribution({
            id: 'one-time-percent',
            type: 'salaryPercent',
            amount: 5,
            salaryBasis: 'perContribution',
            timing: { frequency: 'oneTime', on: { year: 0, month: 0 } },
          }),
        ],
      });

      expect(() => calculateProjection(config, config.interest.annualRate)).toThrow(
        'salaryBasis "perContribution" is not supported for oneTime contributions (id: one-time-percent).',
      );
      resetTimers();
    });

    it('calculates salary percent contributions across all bases', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 0,
        timeHorizonYears: 1,
        startDate: new Date(2026, 0, 1),
        salary: { annualBase: 120000, annualRaiseRate: 0 },
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [
          makeContribution({
            id: 'annual',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'annual',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
          makeContribution({
            id: 'monthly',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'monthly',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
          makeContribution({
            id: 'biweekly',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'biweekly',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
          makeContribution({
            id: 'weekly',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'weekly',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
          makeContribution({
            id: 'daily',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'daily',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
          makeContribution({
            id: 'per-contrib-annual',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'perContribution',
            timing: { frequency: 'annual', month: 0, placement: 'start' },
          }),
          makeContribution({
            id: 'per-contrib-monthly',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'perContribution',
            timing: { frequency: 'monthly', placement: 'start' },
          }),
        ],
      });

      const result = calculateProjection(config, config.interest.annualRate);
      const annual = 120000 * 0.1;
      const monthly = (120000 / 12) * 0.1;
      const biweekly = (120000 / 26) * 0.1;
      const weekly = (120000 / 52) * 0.1;
      const daily = (120000 / 365) * 0.1;
      const perAnnual = annual;
      const perMonthly = monthly;
      const perMonthTotal = annual + monthly + biweekly + weekly + daily + perMonthly;
      const expectedTotal = perMonthTotal * 12 + perAnnual;

      expect(result.totalContributions).toBeCloseTo(expectedTotal, 6);

      resetTimers();
    });

    it('applies salary raises for later years', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 0,
        timeHorizonYears: 2,
        startDate: new Date(2026, 0, 1),
        salary: { annualBase: 100000, annualRaiseRate: 0.1 },
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [
          makeContribution({
            id: 'raise-check',
            type: 'salaryPercent',
            amount: 10,
            salaryBasis: 'annual',
            timing: { frequency: 'annual', month: 0, placement: 'start' },
          }),
        ],
      });

      const result = calculateProjection(config, config.interest.annualRate);
      const yearOne = 100000 * 0.1;
      const yearTwo = 110000 * 0.1;

      expect(result.totalContributions).toBeCloseTo(yearOne + yearTwo, 6);

      resetTimers();
    });
  });

  describe('date normalization and daily mapping', () => {
    it('normalizes startDate from string, Date, and system time', () => {
      setSystemTime('2026-03-15T12:00:00.000Z');

      const fromSystem = {
        currentBalance: 1000,
        timeHorizonYears: 1,
        interest: { annualRate: 0, compounding: 'monthly' as const },
        salary: { annualBase: 100000, annualRaiseRate: 0 },
        contributions: [],
      };
      const systemResult = calculateProjection(fromSystem, fromSystem.interest.annualRate);
      expect(systemResult.monthlyProjections[0]?.month).toBe(2);

      const fromString = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        startDate: '2026-02-01T00:00:00.000Z',
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [],
      });
      const stringResult = calculateProjection(fromString, fromString.interest.annualRate);
      expect(stringResult.monthlyProjections[0]?.month).toBe(1);

      const fromDate = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        startDate: new Date(2026, 5, 20),
        interest: { annualRate: 0, compounding: 'monthly' },
        contributions: [],
      });
      const dateResult = calculateProjection(fromDate, fromDate.interest.annualRate);
      expect(dateResult.monthlyProjections[0]?.month).toBe(5);

      resetTimers();
    });

    it('clamps daily contribution days at month boundaries', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const baseConfig = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        startDate: new Date(2026, 3, 1),
        interest: { annualRate: 0.05, compounding: 'daily' },
        contributions: [
          makeContribution({
            id: 'clamp-low',
            type: 'flat',
            amount: 200,
            timing: { frequency: 'oneTime', on: { year: 0, month: 3, day: 0 } },
          }),
        ],
      });
      const lowResult = calculateProjection(baseConfig, baseConfig.interest.annualRate);

      const explicitLow = makeConfig({
        ...baseConfig,
        contributions: [
          makeContribution({
            id: 'explicit-low',
            type: 'flat',
            amount: 200,
            timing: { frequency: 'oneTime', on: { year: 0, month: 3, day: 1 } },
          }),
        ],
      });
      const explicitLowResult = calculateProjection(explicitLow, explicitLow.interest.annualRate);

      expect(lowResult.finalBalance).toBeCloseTo(explicitLowResult.finalBalance, 6);

      const highConfig = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        startDate: new Date(2026, 3, 1),
        interest: { annualRate: 0.05, compounding: 'daily' },
        contributions: [
          makeContribution({
            id: 'clamp-high',
            type: 'flat',
            amount: 200,
            timing: { frequency: 'oneTime', on: { year: 0, month: 3, day: 99 } },
          }),
        ],
      });
      const highResult = calculateProjection(highConfig, highConfig.interest.annualRate);

      const explicitHigh = makeConfig({
        ...highConfig,
        contributions: [
          makeContribution({
            id: 'explicit-high',
            type: 'flat',
            amount: 200,
            timing: { frequency: 'oneTime', on: { year: 0, month: 3, day: 30 } },
          }),
        ],
      });
      const explicitHighResult = calculateProjection(explicitHigh, explicitHigh.interest.annualRate);

      expect(highResult.finalBalance).toBeCloseTo(explicitHighResult.finalBalance, 6);

      resetTimers();
    });

    it('maps start/end contributions to daily boundaries', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const startEndConfig = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        startDate: new Date(2026, 3, 1),
        interest: { annualRate: 0.05, compounding: 'daily' },
        contributions: [
          makeContribution({
            id: 'start',
            type: 'flat',
            amount: 100,
            timing: { frequency: 'annual', month: 3, placement: 'start' },
          }),
          makeContribution({
            id: 'end',
            type: 'flat',
            amount: 150,
            timing: { frequency: 'annual', month: 3, placement: 'end' },
          }),
        ],
      });

      const explicitConfig = makeConfig({
        ...startEndConfig,
        contributions: [
          makeContribution({
            id: 'day-1',
            type: 'flat',
            amount: 100,
            timing: { frequency: 'annual', month: 3, day: 1 },
          }),
          makeContribution({
            id: 'day-last',
            type: 'flat',
            amount: 150,
            timing: { frequency: 'annual', month: 3, day: 30 },
          }),
        ],
      });

      const startEndResult = calculateProjection(startEndConfig, startEndConfig.interest.annualRate);
      const explicitResult = calculateProjection(explicitConfig, explicitConfig.interest.annualRate);

      expect(startEndResult.finalBalance).toBeCloseTo(explicitResult.finalBalance, 6);

      resetTimers();
    });
  });

  describe('projection variants', () => {
    it('calculates retirement projections with variance paths', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        interest: { annualRate: 0.05, variance: 0.02, compounding: 'monthly' },
        contributions: [],
      });

      const result = calculateRetirement(config);
      expect(result.baseline.finalBalance).toBeGreaterThan(0);
      expect(result.positive.finalBalance).toBeGreaterThan(result.baseline.finalBalance);
      expect(result.negative.finalBalance).toBeLessThan(result.baseline.finalBalance);

      resetTimers();
    });

    it('reuses baseline when variance is zero', () => {
      setSystemTime('2026-01-01T00:00:00.000Z');

      const config = makeConfig({
        currentBalance: 1000,
        timeHorizonYears: 1,
        interest: { annualRate: 0.05, variance: 0, compounding: 'monthly' },
        contributions: [],
      });

      const result = calculateRetirement(config);
      expect(result.positive.finalBalance).toBe(result.baseline.finalBalance);
      expect(result.negative.finalBalance).toBe(result.baseline.finalBalance);

      resetTimers();
    });
  });
});

function setCaseValue<K extends keyof Case>(target: Case, key: K, value: Case[K]) {
  target[key] = value;
}
