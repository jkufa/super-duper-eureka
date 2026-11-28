import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { beforeAll, describe, expect, it } from 'vite-plus/test';

import { generateCase } from '../corpus/case';
import type { CorpusCase } from '../corpus/case';
import { ENGINE_FAULTS, PARSER_FAULTS } from '../corpus/faults';
import { stableJson } from '../corpus/json';
import { parseScenario, ScenarioError } from '../parse-scenario';
import { compareDates } from '../plain-date';
import { projectScenario } from '../project-scenario';
import type { Rule, Scenario } from '../scenario';

const SEEDS = 2000;
const ONE_IN_TEN = SEEDS / 10;
const CORPUS_TIMEOUT_MS = 120_000;

const PINNED_SHA256 = new Map([
  [1, '26f11b94d4ad77fb91c9b1d02a5597a3f7bab4a4759c601cfb58f7b24fdfad40'],
  [2, '72575ec6ad8f116820be2de476f8f9d4136be33f82da0e19fb6f798916b43139'],
  [20, '4c6794a2a745498d9b62f60569a4225e4244e726d21c3215cf2878936044680b'],
  [50, '95fa540bc8f496c81c4b35a8fc56be5e0c728069cdea9a19651267436a3cac72'],
  [777, '5a9a8a23462d336a4ae3e9d17d931fbd930156100bacd14ae7711c2f3bb2a600'],
  [1999, 'aac1ce7be584433fd9d736139577111213c8a52f3234866821c08403f2fef4cd']
]);

interface ExpectedError {
  code: string | undefined;
  accountId: string | undefined;
  ruleId: string | undefined;
}

/** What the projection shows about a case, without keeping its rows. */
interface Projected {
  stale: boolean;
  excluded: boolean;
  bandsEqual: boolean;
}

interface Outcome {
  corpusCase: CorpusCase;
  scenario?: Scenario;
  projected?: Projected;
  error?: ExpectedError;
}

function traitValue(corpusCase: CorpusCase, prefix: string): string | undefined {
  return corpusCase.traits.find((trait) => trait.startsWith(prefix))?.slice(prefix.length);
}

function expectedError(corpusCase: CorpusCase): ExpectedError {
  return {
    code: traitValue(corpusCase, 'error:'),
    accountId: traitValue(corpusCase, 'error_account:'),
    ruleId: traitValue(corpusCase, 'error_rule:')
  };
}

function run(corpusCase: CorpusCase): Outcome {
  const file: unknown = JSON.parse(stableJson(corpusCase.scenario));
  let scenario: Scenario | undefined;
  try {
    scenario = parseScenario(file, { today: corpusCase.today });
    const { staleAccounts, bands } = projectScenario(scenario);
    const projected = {
      stale: staleAccounts.length > 0,
      excluded: bands.baseline.accounts.some((account) => !account.included),
      bandsEqual:
        isDeepStrictEqual(bands.positive.accounts, bands.baseline.accounts) &&
        isDeepStrictEqual(bands.negative.accounts, bands.baseline.accounts)
    };
    return { corpusCase, scenario, projected };
  } catch (error) {
    if (!(error instanceof ScenarioError)) {
      throw error;
    }
    const { code, accountId, ruleId } = error;
    return { corpusCase, scenario, error: { code, accountId, ruleId } };
  }
}

function rulesOf(scenario: Scenario): Array<Rule> {
  return scenario.accounts.flatMap((account) => account.contributions);
}

/** The spec's nine edges, read straight from the parsed scenario. */
const SPEC_EDGES: ReadonlyArray<[string, (scenario: Scenario) => boolean]> = [
  [
    'stale',
    ({ accounts, today }) =>
      accounts.some((account) => account.included && compareDates(account.balanceAsOf, today) < 0)
  ],
  [
    'as_of_feb_29',
    ({ accounts }) =>
      accounts.some(({ balanceAsOf }) => balanceAsOf.month === 2 && balanceAsOf.day === 29)
  ],
  [
    'rule_day_31',
    (scenario) =>
      rulesOf(scenario).some(({ timing }) => timing.frequency !== 'oneTime' && timing.day === 31)
  ],
  ['end_mid_month', ({ endDate }) => endDate.day !== 1],
  [
    'today_is_as_of',
    ({ accounts, today }) =>
      accounts.some((account) => compareDates(account.balanceAsOf, today) === 0)
  ],
  ['zero_balance', ({ accounts }) => accounts.some((account) => account.balance === 0)],
  ['disabled_rule', (scenario) => rulesOf(scenario).some((rule) => !rule.enabled)],
  ['excluded_account', ({ accounts }) => accounts.some((account) => !account.included)],
  ['zero_variance', ({ interest }) => interest.variance === 0]
];

const EXTRA_MINIMUMS: ReadonlyArray<[string, number]> = [
  ...[
    'monthly_bare',
    'monthly_day',
    'monthly_placement',
    'monthly_day_placement',
    'annual_bare',
    'annual_day',
    'annual_placement',
    'annual_day_placement',
    'one_time'
  ].map((shape): [string, number] => [`timing:${shape}`, 200]),
  ['annual_feb_29', 100],
  ...['before_range', 'in_roll_forward', 'first_day', 'last_day', 'on_end', 'after_end'].map(
    (position): [string, number] => [`one_time:${position}`, 100]
  ),
  ...[
    'start',
    'end',
    'equal',
    'start_before_range',
    'start_after_range',
    'end_before_today',
    'end_after_range'
  ].map((bound): [string, number] => [`rule_bound:${bound}`, 100]),
  ...['percent_annual', 'percent_monthly', 'flat_annual', 'flat_monthly'].map(
    (growth): [string, number] => [`growth:${growth}`, 200]
  ),
  ['growth_start_day:29', 100],
  ['growth_start_day:30', 100],
  ['growth_start_day:31', 100],
  ['growth_crosses_anniversary', 200],
  ...[
    'annual',
    'monthly',
    'biweekly',
    'weekly',
    'daily',
    'per_contribution_monthly',
    'per_contribution_annual'
  ].map((basis): [string, number] => [`basis:${basis}`, 100]),
  ['raise:zero', 200],
  ['raise:positive', 200],
  ['raise:negative', 200],
  ['salary_as_of:before_range', 200],
  ['salary_as_of:in_range', 200],
  ['salary_as_of:after_range', 100],
  ['rate_override', 200],
  ['rates:equal', 200],
  ['rates:differ', 200],
  ['negative_band_below_zero', 200],
  ['today:first_of_month', 200],
  ['today:mid_month', 200],
  ['today:last_of_month', 200],
  ['today_feb_29', 50],
  ['end:within_week', 100],
  ['end:same_month', 100],
  ['end:decades_away', 200],
  ['same_bucket_order_sensitive', 100],
  ['same_day_deposits', 200],
  ['account_without_rules', 200],
  ['all_excluded', 50],
  ['large_balance', 200],
  ['tiny_balance', 200],
  ['stale_excluded', 200],
  ['negative_salary_power', 20],
  ['growth_periods_over_1000', 20]
];

describe('generateCase', () => {
  it('gives the same case for the same seed', () => {
    for (const seed of [1, 2, 20, 50, 777, 1999]) {
      expect(generateCase(seed)).toStrictEqual(generateCase(seed));
    }
  });

  it.each([...PINNED_SHA256])('prints seed %i as the pinned JSON text', (seed, sha256) => {
    const text = stableJson(generateCase(seed));

    expect(createHash('sha256').update(text).digest('hex')).toBe(sha256);
  });

  it('prints sorted keys, a two-space indent and a trailing newline', () => {
    expect(stableJson({ b: 1, a: { d: [2, { f: 3, e: 4 }], c: null } })).toBe(
      '{\n  "a": {\n    "c": null,\n    "d": [\n      2,\n      {\n        "e": 4,\n        "f": 3\n      }\n    ]\n  },\n  "b": 1\n}\n'
    );
  });

  it('rejects a seed that is not a whole number from 1', () => {
    expect(() => generateCase(0)).toThrow(RangeError);
    expect(() => generateCase(1.5)).toThrow(RangeError);
  });
});

describe(`the corpus for seeds 1 to ${String(SEEDS)}`, () => {
  const outcomes: Array<Outcome> = [];
  const count = (trait: string) =>
    outcomes.filter(({ corpusCase }) => corpusCase.traits.includes(trait)).length;
  const valid = () =>
    outcomes.filter(({ corpusCase }) => expectedError(corpusCase).code === undefined);

  beforeAll(() => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      outcomes.push(run(generateCase(seed)));
    }
  }, CORPUS_TIMEOUT_MS);

  it('projects every case that expects no error, and fails every other with exactly its predicted error', () => {
    const mismatches = outcomes.flatMap(({ corpusCase, error }, index) => {
      const expected = expectedError(corpusCase);
      const actual = error ?? { code: undefined, accountId: undefined, ruleId: undefined };
      return isDeepStrictEqual(expected, actual) ? [] : [{ seed: index + 1, expected, actual }];
    });

    expect(mismatches).toStrictEqual([]);
  });

  it('marks failing cases as invalid or as an engine error, and nothing else', () => {
    for (const { corpusCase } of outcomes) {
      const failing = expectedError(corpusCase).code !== undefined;
      const kinds = corpusCase.traits.filter(
        (trait) => trait === 'invalid' || trait === 'engine_error'
      );

      expect(kinds.length).toBe(failing ? 1 : 0);
    }
  });

  it.each(SPEC_EDGES)(
    'has %s in at least one case in ten, exactly where the scenario shows it',
    (trait, holds) => {
      const disagreements = valid().filter(
        ({ corpusCase, scenario }) =>
          scenario && holds(scenario) !== corpusCase.traits.includes(trait)
      );

      expect(disagreements).toStrictEqual([]);
      expect(count(trait)).toBeGreaterThanOrEqual(ONE_IN_TEN);
    }
  );

  it('agrees with the projection on stale, excluded and zero-variance cases', () => {
    const disagreements = valid().filter(({ corpusCase: { traits }, projected }) => {
      if (!projected) {
        return true;
      }
      return (
        projected.stale !== traits.includes('stale') ||
        projected.excluded !== traits.includes('excluded_account') ||
        (traits.includes('zero_variance') && !projected.bandsEqual)
      );
    });

    expect(disagreements.map(({ corpusCase }) => corpusCase.traits)).toStrictEqual([]);
  });

  it('splits the compounding modes within three percent of half', () => {
    const daily = count('compounding:daily');
    const monthly = count('compounding:monthly');

    expect(Math.abs(daily - monthly) / (daily + monthly)).toBeLessThan(0.06);
  });

  it('makes one case in twenty invalid, taking each parser code in turn', () => {
    const invalid = outcomes.filter(({ corpusCase }) => corpusCase.traits.includes('invalid'));
    const codes = invalid.map(({ corpusCase }) => expectedError(corpusCase).code);
    const turn = PARSER_FAULTS.map((shapes) => shapes[0]?.code);

    expect(invalid.length).toBe(SEEDS / 20);
    expect(codes.slice(0, turn.length)).toStrictEqual(turn);
    expect(new Set(codes)).toStrictEqual(new Set(turn));
  });

  it('builds every invalid_field and invalid_rate shape, and every engine fault', () => {
    const shapes = PARSER_FAULTS.flat()
      .filter(({ code }) => code === 'invalid_field' || code === 'invalid_rate')
      .concat(ENGINE_FAULTS)
      .map(({ name }) => name);

    expect(shapes.filter((name) => count(`fault:${name}`) === 0)).toStrictEqual([]);
  });

  it.each(EXTRA_MINIMUMS)('has %s in at least %i cases', (trait, minimum) => {
    expect(count(trait)).toBeGreaterThanOrEqual(minimum);
  });
});
