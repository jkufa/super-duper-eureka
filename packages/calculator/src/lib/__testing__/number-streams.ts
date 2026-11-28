import { createHash } from 'node:crypto';

export interface MonthlyStreamRow {
  balance: number;
  contributions: number;
  interest: number;
}

export interface StepStreamRow {
  balanceStart: number;
  contributionsThisStep: number;
  interestEarned: number;
  balanceEnd: number;
}

export type MonthlyRowsByBand = Record<
  'baseline' | 'positive' | 'negative',
  ReadonlyArray<MonthlyStreamRow>
>;

const BAND_ORDER = ['baseline', 'positive', 'negative'] as const;

export function monthlyStream(bands: MonthlyRowsByBand): string {
  return BAND_ORDER.flatMap((band) =>
    bands[band].flatMap((row) => [row.balance, row.contributions, row.interest])
  )
    .map(String)
    .join(',');
}

export function stepStream(steps: ReadonlyArray<StepStreamRow>): string {
  return steps
    .flatMap((step) => [
      step.balanceStart,
      step.contributionsThisStep,
      step.interestEarned,
      step.balanceEnd
    ])
    .map(String)
    .join(',');
}

export function digest(stream: string): string {
  return createHash('sha256').update(stream).digest('hex');
}
