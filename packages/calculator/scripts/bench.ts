import { calculateProjection } from '../src/lib/calculator';
import { compound } from '../src/lib/compound';
import { makeConfig } from '../src/lib/factories';
import { buildSchedule } from '../src/lib/schedule';
import type { CompoundingFrequency, RetirementConfig } from '../src/lib/types';

const PASSES = 60;
const TRIALS = 25;

function referenceConfig(compounding: CompoundingFrequency): RetirementConfig {
  return makeConfig({
    currentBalance: 250_000,
    timeHorizonYears: 30,
    startDate: '2026-01-01T00:00:00.000Z',
    interest: { annualRate: 0.06, variance: 0.02, compounding },
    salary: { annualBase: 120_000, annualRaiseRate: 0.03 },
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
      },
      {
        id: 'ira',
        type: 'flat',
        amount: 7000,
        growth: { type: 'flat', amount: 100, cadence: 'annual' },
        timing: { frequency: 'annual', month: 3, day: 1 }
      },
      {
        id: 'brokerage',
        type: 'flat',
        amount: 500,
        growth: { type: 'percent', amount: 2, cadence: 'annual' },
        timing: { frequency: 'monthly', day: 28 }
      },
      {
        id: 'bonus',
        type: 'salaryPercent',
        amount: 10,
        salaryBasis: 'annual',
        timing: { frequency: 'annual', month: 11, placement: 'end' }
      }
    ]
  });
}

function medianMs(run: () => void): number {
  run();
  const times: Array<number> = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    const started = performance.now();
    run();
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(TRIALS / 2)] ?? Number.NaN;
}

const runtime =
  process.versions.bun === undefined ? `node ${process.version}` : `bun ${process.versions.bun}`;
process.stdout.write(
  `${runtime}: 30 years, 5 rules, median of ${String(TRIALS)} trials of ${String(PASSES)} passes\n`
);

for (const compounding of ['monthly', 'daily'] as const) {
  const config = referenceConfig(compounding);
  const schedule = buildSchedule(config);
  const rate = config.interest.annualRate;

  const compoundMs = medianMs(() => {
    for (let pass = 0; pass < PASSES; pass++) {
      compound(config.currentBalance, schedule, rate);
    }
  });
  const projectionMs = medianMs(() => {
    for (let pass = 0; pass < PASSES; pass++) {
      calculateProjection(config, rate);
    }
  });

  process.stdout.write(
    `${compounding.padEnd(7)}  compound ${compoundMs.toFixed(2)} ms  calculateProjection ${projectionMs.toFixed(2)} ms  (${String(schedule.deposits.length)} deposits)\n`
  );
}
