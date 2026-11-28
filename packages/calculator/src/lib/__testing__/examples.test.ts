import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

import { parseScenario } from '../parse-scenario';
import { projectScenario, traceAccount } from '../project-scenario';
import type { AccountProjection, ScenarioProjection } from '../project-scenario';

const EXAMPLES_DIR = new URL('../../../../cli/examples/', import.meta.url);

const TODAY_BY_EXAMPLE = new Map([
  ['basic.json', '2026-01-01'],
  ['custom-growth.json', '2026-01-01'],
  ['daily.json', '2026-02-01'],
  ['one-time.json', '2026-01-01'],
  ['stale-and-excluded.json', '2026-06-15']
]);

function readExample(name: string) {
  const today = TODAY_BY_EXAMPLE.get(name);
  if (today === undefined) {
    throw new Error(`No fixed today for ${name}.`);
  }
  const file: unknown = JSON.parse(readFileSync(new URL(name, EXAMPLES_DIR), 'utf8'));
  return parseScenario(file, { today });
}

function project(name: string): ScenarioProjection {
  return projectScenario(readExample(name));
}

function baselineAccount(projection: ScenarioProjection, accountId: string): AccountProjection {
  const account = projection.bands.baseline.accounts.find(
    (candidate) => candidate.accountId === accountId
  );
  if (!account) {
    throw new Error(`The projection has no account ${accountId}.`);
  }
  return account;
}

describe('CLI examples', () => {
  it('fixes a today for every example file', () => {
    const files = readdirSync(EXAMPLES_DIR).filter((file) => file.endsWith('.json'));

    expect(files.toSorted()).toStrictEqual([...TODAY_BY_EXAMPLE.keys()].toSorted());
  });

  it.each([...TODAY_BY_EXAMPLE.keys()])('%s has at least two accounts', (name) => {
    const projection = project(name);

    expect(projection.bands.baseline.accounts.length).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(projection.bands.baseline.total.finalBalance)).toBe(true);
  });

  it('basic: twenty years of a growing salary share and a flat Roth deposit', () => {
    const projection = project('basic.json');
    const { total } = projection.bands.baseline;
    const salaryShare = Array.from(
      { length: 20 },
      (_, year) => ((110_000 * 1.03 ** year) / 12) * 0.06 * 12
    ).reduce((sum, value) => sum + value, 0);

    expect(total.startBalance).toBe(75_000);
    expect(total.monthly).toHaveLength(240);
    expect(total.yearly.map(({ year }) => year)).toStrictEqual(
      Array.from({ length: 20 }, (_, index) => 2026 + index)
    );
    expect(baselineAccount(projection, 'roth').series.totalContributions).toBe(120_000);
    expect(baselineAccount(projection, '401k').series.totalContributions).toBeCloseTo(
      salaryShare,
      6
    );
    expect(projection.effectiveRate).toBe(0.05);
    expect(projection.bands.positive.total.finalBalance).toBeGreaterThan(total.finalBalance);
    expect(projection.bands.negative.total.finalBalance).toBeLessThan(total.finalBalance);
  });

  it('custom-growth: the bonus grows 5% a year and the ESPP account earns its own rate', () => {
    const projection = project('custom-growth.json');
    const bonus = [0, 1, 2, 3, 4]
      .map((years) => 2000 * 1.05 ** years)
      .reduce((sum, value) => sum + value, 0);

    expect(baselineAccount(projection, 'brokerage').series.totalContributions).toBeCloseTo(
      bonus,
      9
    );
    expect(baselineAccount(projection, 'espp').annualRate).toBe(0.07);
    expect(projection.effectiveRate).toBeGreaterThan(0.05);
    expect(projection.effectiveRate).toBeLessThan(0.07);
  });

  it('daily: deposits land on their day in daily mode', () => {
    const scenario = readExample('daily.json');
    const projection = projectScenario(scenario);
    const [february] = traceAccount(scenario, 'brokerage', 'baseline');

    expect(projection.bands.baseline.total.yearly.map(({ year }) => year)).toStrictEqual([
      2026, 2027, 2028, 2029
    ]);
    expect(baselineAccount(projection, 'brokerage').series.totalContributions).toBe(36 * 200);
    expect(baselineAccount(projection, 'savings').series.totalContributions).toBe(3 * 3000);
    expect(february?.deposits).toStrictEqual([
      { ruleId: 'auto-invest', date: '2026-02-15', amount: 200, bucket: 15 }
    ]);
  });

  it('one-time: the inheritance is deposited once, on its date', () => {
    const scenario = readExample('one-time.json');
    const projection = projectScenario(scenario);
    const deposits = traceAccount(scenario, 'brokerage', 'baseline').flatMap(
      (segment) => segment.deposits
    );

    expect(deposits).toStrictEqual([
      { ruleId: 'inheritance', date: '2026-07-01', amount: 10_000, bucket: 'start' }
    ]);
    expect(baselineAccount(projection, 'brokerage').series.totalContributions).toBe(10_000);
    expect(baselineAccount(projection, '401k').series.totalContributions).toBe(10 * 2600);
  });

  it('stale-and-excluded: rolls the stale account forward and leaves the excluded one out', () => {
    const projection = project('stale-and-excluded.json');
    const { total, accounts } = projection.bands.baseline;
    const stale = baselineAccount(projection, '401k');
    const excluded = baselineAccount(projection, 'old-ira');

    expect(projection.staleAccounts).toStrictEqual([
      { accountId: '401k', balanceAsOf: '2026-03-31' }
    ]);
    expect(stale.rolledForward.contributions).toBe(3000);
    expect(stale.series.startBalance).toBeGreaterThan(90_000 + 3000);
    expect(stale.series.totalContributions).toBe(114 * 1000);
    expect(excluded.included).toBe(false);
    expect(excluded.rolledForward.interest).toBeGreaterThan(0);
    expect(total.startBalance).toBe(
      accounts
        .filter((account) => account.included)
        .reduce((sum, account) => sum + account.series.startBalance, 0)
    );
    expect(baselineAccount(projection, 'hsa').series.startBalance).toBe(8000);
  });
});
