import { describe, expect, it } from 'vite-plus/test';

import { parseScenario, ScenarioError } from '../parse-scenario';
import { projectScenario, traceAccount } from '../project-scenario';
import type {
  Compounding,
  ContributionRuleFile,
  RuleSalaryBasis,
  RuleTiming,
  RuleType
} from '../scenario';
import { FACTORY_TODAY, makeAccount, makeRule, makeScenarioFile } from './factories';
import type { ScenarioFileOverrides } from './factories';

const ACCOUNT_ID = 'account';

interface Setup {
  today?: string;
  endDate: string;
  balance: number;
  interest: ScenarioFileOverrides['interest'];
  salary?: ScenarioFileOverrides['salary'];
  rules?: Array<ContributionRuleFile>;
}

function scenarioOf({
  today = FACTORY_TODAY,
  endDate,
  balance,
  interest,
  salary,
  rules = []
}: Setup) {
  const file = makeScenarioFile({
    endDate,
    interest,
    salary: { ...salary, asOf: today },
    accounts: [makeAccount({ id: ACCOUNT_ID, balance, balanceAsOf: today, contributions: rules })]
  });
  return parseScenario(file, { today });
}

function baseline(setup: Setup) {
  return projectScenario(scenarioOf(setup)).bands.baseline.total;
}

function trace(setup: Setup) {
  return traceAccount(scenarioOf(setup), ACCOUNT_ID, 'baseline');
}

function scenarioErrorFrom(run: () => void): ScenarioError {
  try {
    run();
  } catch (error) {
    if (error instanceof ScenarioError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a ScenarioError.');
}

type Frequency = RuleTiming['frequency'];
type Placement = 'start' | 'end';
type DayVariant = 'none' | 'mid' | 'end';
type YearRangeVariant = 'none' | 'startOnly' | 'endOnly' | 'range' | 'outOfRange';

interface Case {
  compounding: Compounding;
  frequency: Frequency;
  placement: Placement;
  day: DayVariant;
  startMonth: number;
  yearRange: YearRangeVariant;
  enabled: boolean;
  contributionType: RuleType;
  salaryBasis: RuleSalaryBasis;
  raise: number;
  annualRate: number;
  variance: number;
}

type Axes = { [K in keyof Case]: readonly [Case[K], ...Array<Case[K]>] };

const axes: Axes = {
  compounding: ['monthly', 'daily'],
  frequency: ['oneTime', 'monthly', 'annual'],
  placement: ['start', 'end'],
  day: ['none', 'mid', 'end'],
  startMonth: [1, 2, 12],
  yearRange: ['none', 'startOnly', 'endOnly', 'range', 'outOfRange'],
  enabled: [true, false],
  contributionType: ['flat', 'salaryPercent'],
  salaryBasis: ['annual', 'monthly', 'biweekly', 'weekly', 'daily', 'perContribution'],
  raise: [0, 0.05],
  annualRate: [0, 0.05],
  variance: [0, 0.02]
};

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
  variance: axes.variance[0]
};

const isCaseKey = (key: string): key is keyof Case => key in defaultCase;

const axisEntries = Object.entries(axes).flatMap(([key, values]) =>
  isCaseKey(key) ? [{ key, values }] : []
);

function setCaseValue<K extends keyof Case>(target: Case, key: K, value: Case[K]) {
  target[key] = value;
}

function buildPairwiseCases(): Array<Case> {
  const cases = new Map<string, Case>();
  for (const [i, axisA] of axisEntries.entries()) {
    for (const axisB of axisEntries.slice(i + 1)) {
      for (const valueA of axisA.values) {
        for (const valueB of axisB.values) {
          const next: Case = { ...defaultCase };
          setCaseValue(next, axisA.key, valueA);
          setCaseValue(next, axisB.key, valueB);
          cases.set(JSON.stringify(next), next);
        }
      }
    }
  }
  return [...cases.values()];
}

function monthText(month: number): string {
  return String(month).padStart(2, '0');
}

const RULE_BOUNDS: Record<YearRangeVariant, Pick<ContributionRuleFile, 'startDate' | 'endDate'>> = {
  none: {},
  startOnly: { startDate: '2027-01-01' },
  endOnly: { endDate: '2026-12-31' },
  range: { startDate: '2026-01-01', endDate: '2027-12-31' },
  outOfRange: { startDate: '2029-01-01', endDate: '2030-12-31' }
};

function pairwiseRule(testCase: Case): ContributionRuleFile {
  const day = { none: undefined, mid: 15, end: 28 }[testCase.day];
  const shared =
    testCase.contributionType === 'flat'
      ? { enabled: testCase.enabled, type: 'flat' as const, amount: 500 }
      : {
          enabled: testCase.enabled,
          type: 'salaryPercent' as const,
          amount: 5,
          salaryBasis: testCase.salaryBasis
        };
  if (testCase.frequency === 'oneTime') {
    const on = `2026-${monthText(testCase.startMonth)}-${monthText(day ?? 1)}`;
    return makeRule({ id: 'pairwise', ...shared, timing: { frequency: 'oneTime', on } });
  }
  const timing: RuleTiming =
    testCase.frequency === 'annual'
      ? { frequency: 'annual', month: testCase.startMonth, placement: testCase.placement }
      : { frequency: 'monthly', placement: testCase.placement };
  return makeRule({
    id: 'pairwise',
    ...shared,
    timing: day === undefined ? timing : { ...timing, day },
    ...RULE_BOUNDS[testCase.yearRange]
  });
}

function pairwiseSetup(testCase: Case): Setup {
  const start = monthText(testCase.startMonth);
  return {
    today: `2026-${start}-01`,
    endDate: `2028-${start}-01`,
    balance: 1000,
    interest: {
      annualRate: testCase.annualRate,
      variance: testCase.variance,
      compounding: testCase.compounding
    },
    salary: { annualBase: 120_000, annualRaiseRate: testCase.raise },
    rules: [pairwiseRule(testCase)]
  };
}

const salaryYear: Omit<Setup, 'rules'> = {
  endDate: '2027-01-01',
  balance: 0,
  salary: { annualBase: 120_000 },
  interest: { annualRate: 0, compounding: 'monthly' }
};

function percentRule(
  id: string,
  salaryBasis: RuleSalaryBasis,
  timing: RuleTiming = { frequency: 'monthly', placement: 'start' }
) {
  return makeRule({ id, type: 'salaryPercent', amount: 10, salaryBasis, timing });
}

function growing(
  id: string,
  years: number,
  growth: ContributionRuleFile['growth'],
  timing: RuleTiming
): Setup {
  const fixed = makeRule({ id, amount: 100, timing });
  return {
    endDate: `${String(2026 + years)}-01-01`,
    balance: 0,
    interest: { annualRate: 0, compounding: 'monthly' },
    rules: [growth === undefined ? fixed : { ...fixed, growth, startDate: FACTORY_TODAY }]
  };
}

const MONTHLY_START: RuleTiming = { frequency: 'monthly', placement: 'start' };
const JANUARY_START: RuleTiming = { frequency: 'annual', month: 1, placement: 'start' };

function bands(variance: number) {
  return projectScenario(
    scenarioOf({
      endDate: '2027-01-01',
      balance: 1000,
      interest: { annualRate: 0.05, variance, compounding: 'monthly' }
    })
  ).bands;
}

function shouldContribute(testCase: Case): boolean {
  if (!testCase.enabled) {
    return false;
  }
  return testCase.frequency === 'oneTime' || testCase.yearRange !== 'outOfRange';
}

describe('behaviour ported from the old calculator tests', () => {
  describe('pairwise coverage', () => {
    it.each(buildPairwiseCases())('covers pairwise permutations %o', (testCase) => {
      const setup = pairwiseSetup(testCase);

      if (
        testCase.contributionType === 'salaryPercent' &&
        testCase.frequency === 'oneTime' &&
        testCase.salaryBasis === 'perContribution'
      ) {
        const error = scenarioErrorFrom(() => baseline(setup));
        expect([error.code, error.ruleId]).toStrictEqual([
          'per_contribution_on_one_time',
          'pairwise'
        ]);
        return;
      }

      const total = baseline(setup);
      expect(total.monthly).toHaveLength(24);
      expect(total.yearly).toHaveLength(testCase.startMonth === 1 ? 2 : 3);
      expect(Number.isFinite(total.finalBalance)).toBe(true);
      if (testCase.annualRate === 0 && testCase.variance === 0) {
        expect(total.totalInterest).toBeCloseTo(0, 6);
      }
      if (shouldContribute(testCase)) {
        expect(total.totalContributions).toBeGreaterThan(0);
      } else {
        expect(total.totalContributions).toBe(0);
      }
    });
  });

  describe('core behaviours', () => {
    it('reports each calendar year including the first and last partial years', () => {
      const total = baseline({
        today: '2026-11-12',
        endDate: '2028-11-12',
        balance: 180_000,
        interest: { annualRate: 0 },
        rules: [
          makeRule({ id: 'end', amount: 3000, timing: { frequency: 'monthly', placement: 'end' } })
        ]
      });

      expect(total.yearly).toMatchObject([
        { year: 2026, balance: 186_000, contributions: 6000 },
        { year: 2027, balance: 222_000, contributions: 42_000 },
        { year: 2028, balance: 252_000, contributions: 72_000 }
      ]);
      expect(total.yearly.at(-1)?.balance).toBe(total.finalBalance);
    });

    it('compounds a balance monthly over ten years', () => {
      const total = baseline({
        endDate: '2036-01-01',
        balance: 100_000,
        interest: { annualRate: 0.05, variance: 0.02, compounding: 'monthly' }
      });
      const monthlyRate = 1.05 ** (1 / 12) - 1;

      expect(total.finalBalance).toBeCloseTo(100_000 * (1 + monthlyRate) ** 120, 2);
    });

    it('rejects an end date before today', () => {
      const error = scenarioErrorFrom(() =>
        baseline({ endDate: '2025-01-01', balance: 0, interest: { annualRate: 0.05 } })
      );

      expect(error.code).toBe('end_not_after_today');
    });

    it('credits a one-time deposit in the first month', () => {
      const total = baseline({
        endDate: '2027-01-01',
        balance: 1000,
        interest: { annualRate: 0, compounding: 'monthly' },
        rules: [
          makeRule({
            id: 'one-time',
            amount: 500,
            timing: { frequency: 'oneTime', on: '2026-01-01' }
          })
        ]
      });

      expect(total.monthly[0]?.balance).toBe(1500);
    });

    it('uses real calendar days for daily compounding and clamps day 31 to 29 February', () => {
      const total = baseline({
        today: '2024-02-01',
        endDate: '2025-02-01',
        balance: 1000,
        interest: { annualRate: 0, compounding: 'daily' },
        rules: [
          makeRule({ id: 'monthly-day-31', amount: 200, timing: { frequency: 'monthly', day: 31 } })
        ]
      });

      expect(total.monthly[0]?.balance).toBe(1200);
    });
  });

  describe('salary percent rules', () => {
    it('takes a monthly share of salary', () => {
      const total = baseline({ ...salaryYear, rules: [percentRule('percent-monthly', 'monthly')] });

      expect(total.monthly[0]?.balance).toBe(1000);
    });

    it('rejects perContribution on a one-time rule', () => {
      const error = scenarioErrorFrom(() =>
        baseline({
          ...salaryYear,
          rules: [
            percentRule('one-time-percent', 'perContribution', {
              frequency: 'oneTime',
              on: '2026-01-01'
            })
          ]
        })
      );

      expect([error.code, error.ruleId]).toStrictEqual([
        'per_contribution_on_one_time',
        'one-time-percent'
      ]);
    });

    it('calculates salary percent contributions across all bases', () => {
      const total = baseline({
        ...salaryYear,
        rules: [
          percentRule('annual', 'annual'),
          percentRule('monthly', 'monthly'),
          percentRule('biweekly', 'biweekly'),
          percentRule('weekly', 'weekly'),
          percentRule('daily', 'daily'),
          percentRule('per-contrib-annual', 'perContribution', {
            frequency: 'annual',
            month: 1,
            placement: 'start'
          }),
          percentRule('per-contrib-monthly', 'perContribution')
        ]
      });
      const annual = 120_000 * 0.1;
      const monthly = (120_000 / 12) * 0.1;
      const biweekly = (120_000 / 26) * 0.1;
      const weekly = (120_000 / 52) * 0.1;
      const daily = (120_000 / 365) * 0.1;
      const perMonthTotal = annual + monthly + biweekly + weekly + daily + monthly;

      expect(total.totalContributions).toBeCloseTo(perMonthTotal * 12 + annual, 6);
    });

    it('applies salary raises for later years', () => {
      const total = baseline({
        endDate: '2028-01-01',
        balance: 0,
        salary: { annualBase: 100_000, annualRaiseRate: 0.1 },
        interest: { annualRate: 0, compounding: 'monthly' },
        rules: [
          percentRule('raise-check', 'annual', {
            frequency: 'annual',
            month: 1,
            placement: 'start'
          })
        ]
      });

      expect(total.totalContributions).toBeCloseTo(100_000 * 0.1 + 110_000 * 0.1, 6);
    });
  });

  describe('contribution growth', () => {
    it('keeps the amount when growth is omitted', () => {
      const total = baseline(growing('baseline', 1, undefined, MONTHLY_START));

      expect(total.totalContributions).toBeCloseTo(1200, 6);
    });

    it('applies annual percent growth for flat annual contributions', () => {
      const growth = { type: 'percent', amount: 10, cadence: 'annual' } as const;
      const total = baseline(growing('annual-percent', 3, growth, JANUARY_START));

      expect(total.totalContributions).toBeCloseTo(100 + 110 + 121, 6);
    });

    it('applies monthly percent growth for flat monthly contributions', () => {
      const growth = { type: 'percent', amount: 10, cadence: 'monthly' } as const;
      const total = baseline(growing('monthly-percent', 1, growth, MONTHLY_START));
      const expected = Array.from({ length: 12 }, (_, index) => 100 * 1.1 ** index).reduce(
        (sum, value) => sum + value,
        0
      );

      expect(total.totalContributions).toBeCloseTo(expected, 6);
    });

    it('applies annual flat growth for flat annual contributions', () => {
      const growth = { type: 'flat', amount: 20, cadence: 'annual' } as const;
      const total = baseline(growing('annual-flat', 3, growth, JANUARY_START));

      expect(total.totalContributions).toBeCloseTo(100 + 120 + 140, 6);
    });

    it('applies monthly flat growth for flat monthly contributions', () => {
      const growth = { type: 'flat', amount: 20, cadence: 'monthly' } as const;
      const total = baseline(growing('monthly-flat', 1, growth, MONTHLY_START));

      expect(total.totalContributions).toBeCloseTo(2520, 6);
    });

    it('applies growth to salaryPercent rules using the grown percent', () => {
      const setup: Setup = {
        endDate: '2028-01-01',
        balance: 0,
        salary: { annualBase: 120_000 },
        interest: { annualRate: 0, compounding: 'monthly' },
        rules: [
          makeRule({
            id: 'salary-growth',
            type: 'salaryPercent',
            amount: 10,
            growth: { type: 'flat', amount: 2, cadence: 'annual' },
            salaryBasis: 'monthly',
            timing: MONTHLY_START,
            startDate: FACTORY_TODAY
          })
        ]
      };
      const segments = trace(setup);

      expect(segments[0]?.contributions).toBeCloseTo(1000, 6);
      expect(segments[12]?.contributions).toBeCloseTo(1200, 6);
      expect(baseline(setup).totalContributions).toBeCloseTo(1000 * 12 + 1200 * 12, 6);
    });

    it('rejects negative growth amounts', () => {
      const growth = { type: 'percent', amount: -1, cadence: 'annual' } as const;
      const error = scenarioErrorFrom(() =>
        baseline(growing('invalid-growth', 1, growth, MONTHLY_START))
      );

      expect([error.code, error.ruleId]).toStrictEqual(['negative_amount', 'invalid-growth']);
    });
  });

  describe('dates and daily mapping', () => {
    it.each(['monthly', 'daily'] as const)(
      'skips a first-month day that is before today in %s mode',
      (compounding) => {
        const segments = trace({
          today: '2026-01-20',
          endDate: '2027-01-20',
          balance: 0,
          interest: { annualRate: 0, compounding },
          rules: [
            makeRule({
              id: 'monthly-day',
              amount: 100,
              timing: { frequency: 'monthly', day: 16, placement: 'start' }
            })
          ]
        });

        expect(segments[0]?.contributions).toBe(0);
        expect(segments[1]?.contributions).toBe(100);
      }
    );

    it('maps start and end placements to the first and last day in daily mode', () => {
      const april: Omit<Setup, 'rules'> = {
        today: '2026-04-01',
        endDate: '2027-04-01',
        balance: 1000,
        interest: { annualRate: 0.05, compounding: 'daily' }
      };
      const placed = baseline({
        ...april,
        rules: [
          makeRule({
            id: 'start',
            amount: 100,
            timing: { frequency: 'annual', month: 4, placement: 'start' }
          }),
          makeRule({
            id: 'end',
            amount: 150,
            timing: { frequency: 'annual', month: 4, placement: 'end' }
          })
        ]
      });
      const dated = baseline({
        ...april,
        rules: [
          makeRule({ id: 'day-1', amount: 100, timing: { frequency: 'annual', month: 4, day: 1 } }),
          makeRule({
            id: 'day-last',
            amount: 150,
            timing: { frequency: 'annual', month: 4, day: 30 }
          })
        ]
      });

      expect(placed.finalBalance).toBe(dated.finalBalance);
    });
  });

  describe('bands', () => {
    it('moves the positive band up and the negative band down by the variance', () => {
      const { baseline: middle, positive, negative } = bands(0.02);

      expect(middle.total.finalBalance).toBeGreaterThan(0);
      expect(positive.total.finalBalance).toBeGreaterThan(middle.total.finalBalance);
      expect(negative.total.finalBalance).toBeLessThan(middle.total.finalBalance);
    });

    it('gives every band the baseline balance when the variance is zero', () => {
      const { baseline: middle, positive, negative } = bands(0);

      expect(positive.total.finalBalance).toBe(middle.total.finalBalance);
      expect(negative.total.finalBalance).toBe(middle.total.finalBalance);
    });
  });
});
