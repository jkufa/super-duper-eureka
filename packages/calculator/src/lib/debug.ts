import type { ProjectionRun, ProjectionStep } from './calculator';
import { calculateProjectionWithSteps } from './calculator';
import type { RetirementConfig } from './types';
import { getDefaultEnvironmentContext, type WideEvent, type WideEventBase, type WideEventInput, type WideEventLogger } from '@retirement/logger';

export interface DebugSessionOptions {
  logger: WideEventLogger;
  baseContext?: Partial<WideEventBase>;
  emitSteps?: boolean;
  includeContributionDetails?: boolean;
}

export interface DebugSessionResult extends ProjectionRun { events: WideEvent[] }

export function runDebugSession(config: RetirementConfig, options: DebugSessionOptions): DebugSessionResult {
  const baseContext = buildBaseContext(options.baseContext);
  const logger = options.logger;
  const emitSteps = options.emitSteps ?? true;

  const startedAt = Date.now();
  let projectionRun: ProjectionRun | undefined;
  const events: WideEvent[] = [];

  try {
    projectionRun = calculateProjectionWithSteps(config, config.interest.annualRate, { includeContributionDetails: options.includeContributionDetails ?? true });

    if (emitSteps) {
      for (const step of projectionRun.steps) {
        const event = buildStepWideEventInput(config, step, baseContext);
        events.push(logger.info(event));
      }
    }

    const runEvent = buildRunWideEvent(config, projectionRun, baseContext, {
      durationMs: Date.now() - startedAt,
      outcome: 'success',
    });
    events.push(logger.info(runEvent));

    return { ...projectionRun, events };
  }
  catch (error) {
    const runEvent = buildRunWideEvent(config, projectionRun ?? emptyRun(), baseContext, {
      durationMs: Date.now() - startedAt,
      outcome: 'error',
      error,
    });
    events.push(logger.error(runEvent));
    throw error;
  }
}

export function buildStepWideEventInput(
  config: RetirementConfig,
  step: ProjectionStep,
  base: WideEventBase,
): WideEventInput {
  return {
    ...base,
    event_type: 'retirement_calc_step',
    outcome: 'success',
    config: summarizeConfig(config),
    step: {
      step_index: step.stepIndex,
      year_index: step.yearIndex,
      month_index: step.monthIndex,
      compounding: step.compounding,
      annual_rate: step.annualRate,
      days_in_month: step.daysInMonth,
      days_in_year: step.daysInYear,
      balance_start: step.balanceStart,
      balance_end: step.balanceEnd,
      interest_earned: step.interestEarned,
      contributions_this_step: step.contributionsThisStep,
      contributions_start: step.contributionsStart,
      contributions_end: step.contributionsEnd,
      contributions_by_day: step.contributionsByDay,
      total_contributions: step.totalContributions,
      total_interest: step.totalInterest,
      salary: step.salary,
      active_contributions: step.activeContributions,
    },
  };
}

export function buildRunWideEvent(
  config: RetirementConfig,
  run: ProjectionRun,
  base: WideEventBase,
  meta: { durationMs: number; outcome: 'success' | 'error'; error?: unknown },
) {
  return {
    ...base,
    event_type: 'retirement_calc_run',
    outcome: meta.outcome,
    duration_ms: meta.durationMs,
    error: formatUnknownError(meta.error),
    config: summarizeConfig(config),
    summary: {
      total_steps: run.summary.totalSteps,
      total_contributions: run.summary.totalContributions,
      total_interest: run.summary.totalInterest,
      final_balance: run.summary.finalBalance,
    },
  };
}

export function buildBaseContext(overrides?: Partial<WideEventBase>): WideEventBase {
  const defaults = getDefaultEnvironmentContext();
  return {
    service_name: overrides?.service_name ?? 'retirement-calculator',
    service_version: overrides?.service_version,
    request_id: overrides?.request_id ?? randomId(),
    session_id: overrides?.session_id ?? randomId(),
    run_id: overrides?.run_id ?? randomId(),
    environment: overrides?.environment ?? defaults.environment,
    region: overrides?.region ?? defaults.region,
    instance_id: overrides?.instance_id ?? defaults.instance_id,
    commit_hash: overrides?.commit_hash ?? defaults.commit_hash,
    runtime: overrides?.runtime ?? defaults.runtime,
  };
}

function summarizeConfig(config: RetirementConfig) {
  return {
    time_horizon_years: config.timeHorizonYears,
    start_date: config.startDate ?? 'now',
    current_balance: config.currentBalance,
    interest: config.interest,
    salary: config.salary,
    contributions_count: config.contributions.length,
  };
}

function randomId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `run_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function emptyRun(): ProjectionRun {
  return {
    projection: {
      finalBalance: 0,
      totalContributions: 0,
      totalGrowth: 0,
      yearlyProjections: [],
      monthlyProjections: [],
    },
    steps: [],
    summary: {
      totalSteps: 0,
      totalContributions: 0,
      totalInterest: 0,
      finalBalance: 0,
    },
  };
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, type: error.name };
  }
  if (error && typeof error === 'object') {
    try {
      return { message: JSON.stringify(error) };
    }
    catch {
      return { message: '[object Error]' };
    }
  }
  if (error === undefined) return undefined;
  if (typeof error === 'string') return { message: error };
  if (typeof error === 'number' || typeof error === 'bigint' || typeof error === 'boolean') {
    return { message: String(error) };
  }
  if (typeof error === 'symbol') return { message: error.description ?? 'symbol' };
  return { message: 'unknown error' };
}
