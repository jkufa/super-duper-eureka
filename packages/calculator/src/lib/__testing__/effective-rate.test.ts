import { describe, expect, it } from 'vite-plus/test';

import {
  BISECTION_PASSES,
  bisectRate,
  effectiveRate,
  poolAccounts,
  poolFinalBalance
} from '../effective-rate';
import { parseScenario } from '../parse-scenario';
import { projectScenario } from '../project-scenario';
import type { AccountFile, Compounding, ContributionRuleFile, ScenarioFile } from '../scenario';

const DOUBLING_MONTHLY_RATE = 4095;
const MODES: Array<Compounding> = ['monthly', 'daily'];

interface AccountSetup extends Partial<Omit<AccountFile, 'id'>> {
  id: string;
}

interface Setup {
  today: string;
  endDate: string;
  compounding?: Compounding;
  annualRate?: number;
  variance?: number;
  salary?: ScenarioFile['salary'];
  accounts: Array<AccountSetup>;
}

function scenarioOf(setup: Setup) {
  const { today, endDate, compounding = 'monthly', annualRate = 0, variance = 0 } = setup;
  return parseScenario(
    {
      version: 1,
      endDate,
      interest: { annualRate, variance, compounding },
      salary: setup.salary ?? { annualBase: 0, asOf: today },
      accounts: setup.accounts.map(({ id, ...fields }) => ({
        id,
        name: id,
        kind: 'other',
        included: true,
        balance: 0,
        balanceAsOf: today,
        contributions: [],
        ...fields
      }))
    },
    { today }
  );
}

function project(setup: Setup) {
  return projectScenario(scenarioOf(setup));
}

function includedPool(setup: Setup) {
  const scenario = scenarioOf(setup);
  const { total } = projectScenario(scenario).bands.baseline;
  return poolAccounts(
    scenario,
    scenario.accounts.filter(({ included }) => included),
    total.startBalance
  );
}

function flat(id: string, amount: number, timing: ContributionRuleFile['timing']) {
  return { id, type: 'flat', amount, timing } satisfies ContributionRuleFile;
}

function monthly(id: string, amount: number, placement: 'start' | 'end' = 'start') {
  return flat(id, amount, { frequency: 'monthly', placement });
}

function relativeError(actual: number, expected: number) {
  return Math.abs(actual - expected) / expected;
}

const README: Setup = {
  today: '2026-01-01',
  endDate: '2056-01-01',
  annualRate: 0.06,
  accounts: [
    { id: 'big', balance: 180_000 },
    { id: 'small', balance: 20_000, annualRate: 0.1 }
  ]
};

const MIXED: Setup = {
  today: '2026-11-16',
  endDate: '2041-07-20',
  annualRate: 0.05,
  salary: { annualBase: 90_000, annualRaiseRate: 0.03, asOf: '2026-01-01' },
  accounts: [
    {
      id: 'stale',
      balance: 40_000,
      balanceAsOf: '2025-03-10',
      annualRate: 0.08,
      contributions: [
        flat('day28', 300, { frequency: 'monthly', day: 28 }),
        flat('march', 2000, { frequency: 'annual', month: 3, day: 1 })
      ]
    },
    {
      id: 'salary',
      balance: 0,
      annualRate: -0.02,
      contributions: [
        {
          id: 'pct',
          type: 'salaryPercent',
          amount: 6,
          salaryBasis: 'monthly',
          timing: { frequency: 'monthly', placement: 'end' }
        }
      ]
    },
    { id: 'cash', balance: 5000, annualRate: 0.01, contributions: [monthly('cash-in', 50)] },
    { id: 'excluded', balance: 9e9, annualRate: 0.9, included: false }
  ]
};

const SHORT: Setup = {
  today: '2026-02-27',
  endDate: '2027-02-03',
  annualRate: 0.2,
  accounts: [
    {
      id: 'empty',
      annualRate: 0.5,
      contributions: [flat('once', 1000, { frequency: 'oneTime', on: '2026-12-31' })]
    },
    { id: 'kept', balance: 1, annualRate: 0, contributions: [monthly('end', 7, 'end')] }
  ]
};

const VARIED = [README, MIXED, SHORT];

describe('effectiveRate: short cuts', () => {
  it('returns the shared rate exactly when every included account has it', () => {
    const projection = project({
      today: '2026-01-01',
      endDate: '2036-01-01',
      annualRate: 0.1,
      accounts: [
        { id: 'default', balance: 1, contributions: [monthly('a', 3)] },
        { id: 'override', balance: 2, annualRate: 0.1 },
        { id: 'excluded', balance: 5, annualRate: 0.3, included: false }
      ]
    });

    expect(projection.effectiveRate).toBe(0.1);
    expect(
      projection.bands.baseline.total.yearly.map(({ weightedRate }) => weightedRate)
    ).toStrictEqual(Array.from({ length: 10 }, () => 0.1));
  });

  it.each([
    [[0, -0], -0],
    [[-0, 0], -0],
    [[0, 0], 0]
  ])('treats 0 and -0 as one rate: %o returns %s, as Math.min does', (rates, expected) => {
    const projection = project({
      today: '2026-01-01',
      endDate: '2027-01-01',
      accounts: rates.map((annualRate, index) => ({
        id: `zero-${String(index)}`,
        balance: 1,
        annualRate
      }))
    });

    expect(projection.effectiveRate).toBe(expected);
  });

  it('takes the bracket from a million included accounts', () => {
    const scenario = scenarioOf({ ...README, accounts: [{ id: 'one', balance: 1 }] });
    const { total } = projectScenario(scenario).bands.baseline;
    const included = scenario.accounts.flatMap((account) =>
      Array.from({ length: 1_000_000 }, () => ({ account, annualRate: 0.05 }))
    );

    expect(effectiveRate(scenario, included, total)).toBe(0.05);
  });

  it.each([
    ['no accounts', []],
    ['only excluded accounts', [{ id: 'out', balance: 100, annualRate: 0.2, included: false }]]
  ] satisfies Array<[string, Array<AccountSetup>]>)(
    'returns the default rate when there are %s',
    (_, accounts) => {
      expect(
        project({ today: '2026-01-01', endDate: '2030-01-01', annualRate: 0.042, accounts })
          .effectiveRate
      ).toBe(0.042);
    }
  );

  it('returns the default rate when the pool has no balance and no deposits', () => {
    // A disabled rule and a rule of 0 leave no deposit in either schedule.
    const projection = project({
      today: '2026-01-01',
      endDate: '2030-01-01',
      annualRate: 0.05,
      accounts: [
        { id: 'low', annualRate: 0.03, contributions: [monthly('zero', 0)] },
        {
          id: 'high',
          annualRate: 0.09,
          contributions: [{ ...monthly('off', 100), enabled: false }]
        }
      ]
    });

    expect(projection.effectiveRate).toBe(0.05);
    expect(
      projection.bands.baseline.total.yearly.map(({ weightedRate }) => weightedRate)
    ).toStrictEqual([null, null, null, null]);
  });
});

describe('effectiveRate: a pool the rate cannot move', () => {
  const lowAccount: AccountSetup = {
    id: 'low',
    annualRate: 0.04,
    contributions: [monthly('fifty', 50, 'end')]
  };
  const highAccount: AccountSetup = {
    id: 'high',
    annualRate: 0.1,
    contributions: [monthly('ten', 10.01, 'end'), monthly('one', 1.23, 'end')]
  };

  it.each([
    ['low first', [lowAccount, highAccount]],
    ['high first', [highAccount, lowAccount]]
  ])('returns the lowest rate when no money earns interest, %s', (_, accounts) => {
    // Every deposit lands in the end bucket of the only month: 50 + 10.01 + 1.23 = 61.24 at any rate.
    const projection = project({ today: '2026-01-01', endDate: '2026-02-01', accounts });

    expect(projection.bands.baseline.total.finalBalance).toBe(61.24);
    expect(projection.bands.baseline.total.totalInterest).toBe(0);
    expect(projection.effectiveRate).toBe(0.04);
  });

  function threshold(endDeposit: number): Setup {
    // At 0% the pool ends on 1 + endDeposit. At 4095% the 1 doubles, so it ends on 2 + endDeposit.
    // The two differ by 1, and the threshold is 1e-9 times the pool at 0%.
    return {
      today: '2026-12-01',
      endDate: '2027-01-01',
      accounts: [
        { id: 'end', contributions: [monthly('end', endDeposit, 'end')] },
        { id: 'fast', balance: 1, annualRate: DOUBLING_MONTHLY_RATE }
      ]
    };
  }

  it('returns the lowest rate when the bracket ends differ by exactly 1e-9 of the pool at lo', () => {
    // 1 <= 1e-9 * (1 + 999,999,999) = 1.
    expect(project(threshold(999_999_999)).effectiveRate).toBe(0);
  });

  it('bisects when the bracket ends differ by just more than 1e-9 of the pool at lo', () => {
    // 1 > 1e-9 * (1 + 999,999,998) = 0.999999999.
    const setup = threshold(999_999_998);
    const projection = project(setup);
    const pooled = poolFinalBalance(includedPool(setup), 'monthly', projection.effectiveRate);

    expect(projection.effectiveRate).toBeGreaterThan(0);
    expect(relativeError(pooled, projection.bands.baseline.total.finalBalance)).toBeLessThan(1e-9);
  });

  it('bisects when the pool overflows at hi', () => {
    // At 4095% for 30 years the pool grows by 2^360 = 2.3e108, so 1e201 overflows while the total
    // is 1e201 + 1e196 * 2^360 = 2.3e304. Infinity - atLo is above 1e-9 * atLo.
    // (1e201 + 1e196) * (1 + r)^30 = 2.3e304 gives (1 + r)^30 = 2.3e103, so r is about 2790.
    const setup: Setup = {
      today: '2026-01-01',
      endDate: '2056-01-01',
      accounts: [
        { id: 'slow', balance: 1e201 },
        { id: 'fast', balance: 1e196, annualRate: DOUBLING_MONTHLY_RATE }
      ]
    };
    const projection = project(setup);

    expect(poolFinalBalance(includedPool(setup), 'monthly', DOUBLING_MONTHLY_RATE)).toBe(
      Number.POSITIVE_INFINITY
    );
    expect(Number.isFinite(projection.bands.baseline.total.finalBalance)).toBe(true);
    expect(projection.effectiveRate).toBe(2789.571384675445);
  });
});

describe('effectiveRate: the solve', () => {
  it('matches the README example: 6.66% effective, 7.0% weighted in the last year', () => {
    // 180,000 * 1.06^30 + 20,000 * 1.1^30 = 1,033,828.4 + 348,988.0 = 1,382,816.5.
    // 200,000 * (1 + r)^30 = 1,382,816.5 gives r = 6.914082^(1/30) - 1 = 0.066574.
    // Last year: (0.06 * 1,033,828.4 + 0.1 * 348,988.0) / 1,382,816.5 = 0.070095.
    const projection = project(README);
    const lastYear = projection.bands.baseline.total.yearly.at(-1);

    expect(projection.effectiveRate.toFixed(4)).toBe('0.0666');
    expect(lastYear?.weightedRate?.toFixed(3)).toBe('0.070');
  });

  it('regression pin, not a derivation: the README example to full precision', () => {
    const projection = project(README);

    expect(projection.effectiveRate).toBe(0.06657439005940458);
    expect(projection.bands.baseline.total.yearly.at(-1)?.weightedRate).toBe(0.07009499254183038);
  });

  it.each(MODES)(
    'lies within the included rates and reproduces the total in %s mode',
    (compounding) => {
      for (const setup of VARIED) {
        const withMode = { ...setup, compounding };
        const scenario = scenarioOf(withMode);
        const projection = projectScenario(scenario);
        const rates = projection.bands.baseline.accounts
          .filter(({ included }) => included)
          .map(({ annualRate }) => annualRate);
        const { effectiveRate } = projection;
        const pooled = poolFinalBalance(includedPool(withMode), compounding, effectiveRate);

        expect(effectiveRate).toBeGreaterThanOrEqual(Math.min(...rates));
        expect(effectiveRate).toBeLessThanOrEqual(Math.max(...rates));
        expect(relativeError(pooled, projection.bands.baseline.total.finalBalance)).toBeLessThan(
          1e-9
        );
      }
    }
  );

  it('pools a stale account from its balance at today, not its stored balance', () => {
    // stale doubles each month: 1000 on 1 October, 4000 at today, 8000 at the end. fresh: 1000 at 0%.
    // The pool goes from 5000 to 9000 in one month: a monthly factor of 1.8, so r = 1.8^12 - 1.
    const projection = project({
      today: '2026-12-01',
      endDate: '2027-01-01',
      accounts: [
        {
          id: 'stale',
          balance: 1000,
          balanceAsOf: '2026-10-01',
          annualRate: DOUBLING_MONTHLY_RATE
        },
        { id: 'fresh', balance: 1000 }
      ]
    });

    expect(projection.bands.baseline.total.startBalance).toBe(5000);
    expect(projection.bands.baseline.total.finalBalance).toBe(9000);
    expect(relativeError(projection.effectiveRate, 1.8 ** 12 - 1)).toBeLessThan(1e-9);
  });

  it('ignores excluded accounts, their balance, rate and deposits', () => {
    const setup = MIXED;
    const without = project({
      ...setup,
      accounts: setup.accounts.filter(({ id }) => id !== 'excluded')
    });
    const withExcluded = project({
      ...setup,
      accounts: setup.accounts.map((account) =>
        account.id === 'excluded' ? { ...account, contributions: [monthly('ex', 1e6)] } : account
      )
    });

    expect(withExcluded.effectiveRate).toBe(without.effectiveRate);
    expect(withExcluded.bands.baseline.total.yearly).toStrictEqual(
      without.bands.baseline.total.yearly
    );
  });

  it('bisects past midpoints where the pool overflows, staying finite and inside the rates', () => {
    // The first midpoint is 2047.5: 1e308 grows by 2048.5^(1/12) = 1.89 and overflows.
    // The total is 1e308 at 0% plus 1 doubling to 2, which rounds to 1e308. The pool at every
    // midpoint reaches it, so each pass moves hi down: 4095 / 2^60 after 60, returning 4095 / 2^61.
    const setup: Setup = {
      today: '2026-12-01',
      endDate: '2027-01-01',
      accounts: [
        { id: 'huge', balance: 1e308 },
        { id: 'fast', balance: 1, annualRate: DOUBLING_MONTHLY_RATE }
      ]
    };
    const projection = project(setup);
    const pool = includedPool(setup);

    expect(poolFinalBalance(pool, 'monthly', 2047.5)).toBe(Number.POSITIVE_INFINITY);
    expect(projection.effectiveRate).toBe(DOUBLING_MONTHLY_RATE / 2 ** 61);
    expect(projection.effectiveRate).toBeGreaterThanOrEqual(0);
    expect(projection.effectiveRate).toBeLessThanOrEqual(DOUBLING_MONTHLY_RATE);
    expect(
      relativeError(poolFinalBalance(pool, 'monthly', projection.effectiveRate), 1e308)
    ).toBeLessThan(1e-9);
  });
});

describe('bisectRate', () => {
  it('makes exactly 60 passes at midpoints lo + (hi - lo) / 2, not counting the passes effectiveRate makes at lo and hi', () => {
    const calls: Array<number> = [];
    const rate = bisectRate(0, 1, 0.3, (midpoint) => {
      calls.push(midpoint);
      return midpoint;
    });

    expect(BISECTION_PASSES).toBe(60);
    expect(calls).toHaveLength(60);
    expect(calls.slice(0, 3)).toStrictEqual([0.5, 0.25, 0.375]);
    expect(Math.abs(rate - 0.3)).toBeLessThan(1e-15);
  });

  it('takes its first midpoint of 0.01 and 0.03 as 0.019999999999999997, where (lo + hi) / 2 is 0.02', () => {
    const calls: Array<number> = [];
    bisectRate(0.01, 0.03, 0, (midpoint) => {
      calls.push(midpoint);
      return midpoint;
    });

    expect(calls[0]).toBe(0.019999999999999997);
  });

  it('returns lo + (hi - lo) / 2, which stays finite where lo + hi overflows', () => {
    expect(bisectRate(1e308, 1.7e308, 1e308, (midpoint) => midpoint)).toBe(1e308);
  });

  it('moves hi down when the result equals the target, and lo up only when it is below', () => {
    const calls: Array<number> = [];
    bisectRate(0, 1, 0.5, (midpoint) => {
      calls.push(midpoint);
      return midpoint;
    });

    expect(calls.slice(0, 3)).toStrictEqual([0.5, 0.25, 0.375]);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN])(
    'treats a result of %s as above the target and stays inside the bracket',
    (overflow) => {
      const calls: Array<number> = [];
      const rate = bisectRate(0, 1, 0.2, (midpoint) => {
        calls.push(midpoint);
        return midpoint > 0.3 ? overflow : midpoint;
      });

      expect(calls.slice(0, 3)).toStrictEqual([0.5, 0.25, 0.125]);
      expect(Math.abs(rate - 0.2)).toBeLessThan(1e-15);
    }
  );
});

describe('the pool', () => {
  it('merges by month, then account order, then rule order', () => {
    // In file order the start bucket is 1 + 1 + 1e16 = 10000000000000002.
    // Rule order first (1, 1e16, 1) or accounts reversed (1e16, 1, 1) loses both 1s: 1e16 + 1 rounds to 1e16.
    const pool = includedPool({
      today: '2026-12-01',
      endDate: '2027-01-01',
      accounts: [
        { id: 'ones', contributions: [monthly('one', 1), monthly('another', 1)] },
        { id: 'big', annualRate: 0.5, contributions: [monthly('big', 1e16)] }
      ]
    });

    expect(poolFinalBalance(pool, 'monthly', 0)).toBe(10_000_000_000_000_002);
  });

  it.each(MODES)(
    'gives the same final balance as the series for one account in %s mode',
    (compounding) => {
      const setup: Setup = { ...MIXED, compounding };
      const scenario = scenarioOf(setup);
      const { accounts } = projectScenario(scenario).bands.baseline;

      scenario.accounts.forEach((account, index) => {
        const projected = accounts[index];
        const pool = poolAccounts(
          scenario,
          [account],
          projected?.series.startBalance ?? Number.NaN
        );
        expect(poolFinalBalance(pool, compounding, projected?.annualRate ?? Number.NaN)).toBe(
          projected?.series.finalBalance
        );
      });
    }
  );

  it.each(MODES)('does not shrink as the rate rises in %s mode', (compounding) => {
    const pool = includedPool({ ...MIXED, compounding });
    const rates = Array.from({ length: 61 }, (_, step) => -0.5 + step * 0.025);
    const balances = rates.map((rate) => poolFinalBalance(pool, compounding, rate));

    balances.slice(1).forEach((balance, index) => {
      expect(balance).toBeGreaterThanOrEqual(balances[index] ?? Number.NaN);
    });
  });
});

describe('weightedRate', () => {
  it('weights each included rate by its balance on the row', () => {
    // zero: 1000 at 0%. doubling: 1000 to 2000 in December. (0 * 1000 + 4095 * 2000) / 3000 = 2730.
    const projection = project({
      today: '2026-12-01',
      endDate: '2027-01-01',
      accounts: [
        { id: 'zero', balance: 1000 },
        { id: 'doubling', balance: 1000, annualRate: DOUBLING_MONTHLY_RATE },
        { id: 'excluded', balance: 1000, annualRate: 7, included: false }
      ]
    });

    expect(projection.bands.baseline.total.yearly).toStrictEqual([
      { year: 2026, balance: 3000, contributions: 0, interest: 1000, weightedRate: 2730 }
    ]);
  });

  it('sums the numerator in file order', () => {
    // Every deposit lands in the end bucket of the only month, so the row balances are 2e16, 1 and 1.
    // The total is 2e16 + 1 + 1 = 2e16. In file order 0.5 * 2e16 + 1 + 1 = 1e16, which gives 0.5.
    // Reversed, 1 + 1 + 1e16 = 10000000000000002, which gives 0.5000000000000001.
    const projection = project({
      today: '2026-12-01',
      endDate: '2027-01-01',
      accounts: [
        { id: 'big', annualRate: 0.5, contributions: [monthly('big', 2e16, 'end')] },
        { id: 'one', annualRate: 1, contributions: [monthly('one', 1, 'end')] },
        { id: 'another', annualRate: 1, contributions: [monthly('another', 1, 'end')] }
      ]
    });

    expect(
      projection.bands.baseline.accounts.map(({ series }) => series.yearly[0]?.balance)
    ).toStrictEqual([2e16, 1, 1]);
    expect(projection.bands.baseline.total.yearly[0]?.weightedRate).toBe(0.5);
  });

  it('is present only on the baseline total yearly rows', () => {
    const { bands } = project({ ...MIXED, variance: 0.01 });
    const rowsWithout = [
      ...bands.baseline.total.monthly,
      ...bands.positive.total.monthly,
      ...bands.positive.total.yearly,
      ...bands.negative.total.monthly,
      ...bands.negative.total.yearly,
      ...Object.values(bands).flatMap(({ accounts }) =>
        accounts.flatMap(({ series }) => [...series.monthly, ...series.yearly])
      )
    ];

    expect(bands.baseline.total.yearly.every((row) => typeof row.weightedRate === 'number')).toBe(
      true
    );
    expect(rowsWithout.some((row) => 'weightedRate' in row)).toBe(false);
  });
});
