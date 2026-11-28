import { effectiveRate } from '../src/lib/effective-rate';
import { parseScenario } from '../src/lib/parse-scenario';
import { projectScenario } from '../src/lib/project-scenario';
import type { Compounding, Scenario } from '../src/lib/scenario';

const SOLVE_TRIALS = 201;
const PROJECTION_TRIALS = 51;

function referenceScenario(compounding: Compounding): Scenario {
  const account = { kind: 'other', included: true, balanceAsOf: '2026-01-01' } as const;
  return parseScenario(
    {
      version: 1,
      endDate: '2056-01-01',
      interest: { annualRate: 0.06, variance: 0.02, compounding },
      salary: { annualBase: 120_000, annualRaiseRate: 0.03, asOf: '2026-01-01' },
      accounts: [
        {
          ...account,
          id: '401k',
          name: '401k',
          balance: 150_000,
          annualRate: 0.07,
          contributions: [
            {
              id: '401k',
              type: 'salaryPercent',
              amount: 8,
              salaryBasis: 'perContribution',
              timing: { frequency: 'monthly', day: 15 }
            },
            {
              id: 'match',
              type: 'salaryPercent',
              amount: 4,
              salaryBasis: 'perContribution',
              timing: { frequency: 'monthly', placement: 'end' }
            }
          ]
        },
        {
          ...account,
          id: 'ira',
          name: 'IRA',
          balance: 60_000,
          contributions: [
            {
              id: 'ira',
              type: 'flat',
              amount: 7000,
              growth: { type: 'flat', amount: 100, cadence: 'annual' },
              timing: { frequency: 'annual', month: 4, day: 1 },
              startDate: '2026-01-01'
            }
          ]
        },
        {
          ...account,
          id: 'brokerage',
          name: 'Brokerage',
          balance: 40_000,
          annualRate: 0.045,
          contributions: [
            {
              id: 'brokerage',
              type: 'flat',
              amount: 500,
              growth: { type: 'percent', amount: 2, cadence: 'annual' },
              timing: { frequency: 'monthly', day: 28 },
              startDate: '2026-01-01'
            },
            {
              id: 'bonus',
              type: 'salaryPercent',
              amount: 10,
              salaryBasis: 'annual',
              timing: { frequency: 'annual', month: 12, placement: 'end' }
            }
          ]
        }
      ]
    },
    { today: '2026-01-01' }
  );
}

function medianMs(run: () => void, trials: number): number {
  run();
  const times: Array<number> = [];
  for (let trial = 0; trial < trials; trial++) {
    const started = performance.now();
    run();
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(trials / 2)] ?? Number.NaN;
}

const runtime =
  process.versions.bun === undefined ? `node ${process.version}` : `bun ${process.versions.bun}`;
process.stdout.write(
  `${runtime}: 30 years, 3 accounts, 5 rules; median of ${String(SOLVE_TRIALS)} solves and ${String(PROJECTION_TRIALS)} projections\n`
);

for (const compounding of ['monthly', 'daily'] as const) {
  const scenario = referenceScenario(compounding);
  const { total } = projectScenario(scenario).bands.baseline;
  const included = scenario.accounts.map((account) => ({
    account,
    annualRate: account.annualRate ?? scenario.interest.annualRate
  }));
  const solveMs = medianMs(() => effectiveRate(scenario, included, total), SOLVE_TRIALS);
  const projectionMs = medianMs(() => projectScenario(scenario), PROJECTION_TRIALS);

  process.stdout.write(
    `${compounding.padEnd(7)}  one effective-rate solve ${solveMs.toFixed(3)} ms  one projectScenario ${projectionMs.toFixed(2)} ms\n`
  );
}
