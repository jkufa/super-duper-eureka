import { calculateProjection, makeConfig } from '@retirement/calculator';
import type { ProjectionPoint } from './chart-geometry';

/**
 * Spike Q4 data: one point per year for a starting balance and an annual return in percent, with
 * a variance band one point above and below. Year labels count from the config's 2026 start.
 */
export function projectionPoints(
  startingBalance: number,
  ratePercent: number
): Array<ProjectionPoint> {
  const config = makeConfig({ currentBalance: startingBalance, timeHorizonYears: 30 });
  const yearly = (percent: number) =>
    calculateProjection(config, percent / 100).yearlyProjections.map((year) => year.balance);
  const balance = yearly(ratePercent);
  const positive = yearly(ratePercent + 1);
  const negative = yearly(ratePercent - 1);
  return balance.map((value, index) => ({
    label: String(2026 + index),
    balance: value,
    positive: positive[index],
    negative: negative[index]
  }));
}
