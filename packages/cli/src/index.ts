#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  buildBaseContext,
  buildRunWideEvent,
  buildStepWideEvent,
  calculateProjection,
  calculateProjectionWithSteps,
  createWideEventLogger,
  type RetirementConfig,
} from '@retirement/calculator';

const args = process.argv.slice(2);

const usage = `
Usage:
  retirement-calc --config <path> [--debug] [--no-interactive]

Options:
  --config <path>       Path to RetirementConfig JSON
  --debug               Emit step-by-step wide events
  --no-interactive      Do not pause between steps (only with --debug)
  --raw                 Emit raw JSON (no pretty formatting)
  --skip <spec>         Skip prompts for steps. Example: "1,3-5,next:10"
  --help                Show help
`;

if (args.includes('--help') || args.length === 0) {
  console.log(usage.trim());
  process.exit(0);
}

const configPath = getArgValue(args, '--config') ?? firstPositional(args);
if (!configPath) {
  console.error('Missing config file path.');
  console.log(usage.trim());
  process.exit(1);
}

const debug = args.includes('--debug');
const interactive = debug && !args.includes('--no-interactive');
const raw = args.includes('--raw');
const skipSpecs = getArgValues(args, '--skip');
const skipSet = new Set<number>();
let skipRemaining = 0;
let skippedCount = 0;

for (const spec of skipSpecs) {
  const { steps, nextCount } = parseSkipSpec(spec);
  for (const step of steps) skipSet.add(step);
  if (nextCount > 0) skipRemaining = Math.max(skipRemaining, nextCount);
}

const config = JSON.parse(readFileSync(configPath, 'utf8')) as RetirementConfig;

if (!debug) {
  const projection = calculateProjection(config, config.interest.annualRate);
  console.log(JSON.stringify(projection, null, 2));
  process.exit(0);
}

const baseContext = buildBaseContext({
  service_name: 'retirement-cli',
  service_version: process.env.npm_package_version,
});
const logger = createWideEventLogger({ base: baseContext, pretty: !raw });

const startedAt = Date.now();
const projectionRun = calculateProjectionWithSteps(config, config.interest.annualRate, { includeContributionDetails: true });

const rl = interactive ? createInterface({ input, output }) : null;

let interrupted = false;
for (const step of projectionRun.steps) {
  if (skipSet.has(step.stepIndex)) {
    skippedCount += 1;
    continue;
  }
  if (skipRemaining > 0) {
    skipRemaining -= 1;
    skippedCount += 1;
    continue;
  }

  const event = buildStepWideEvent(config, step, baseContext);
  logger.info(event);

  if (interactive && rl) {
    const answer = await rl.question('Press Enter for next step, or q to quit, or s <n|spec> to skip: ');
    const trimmed = answer.trim().toLowerCase();
    if (trimmed === 'q') {
      interrupted = true;
      break;
    }
    if (trimmed.startsWith('s ')) {
      const spec = trimmed.slice(2).trim();
      const { steps, nextCount } = parseSkipSpec(spec);
      for (const stepIndex of steps) skipSet.add(stepIndex);
      if (nextCount > 0) skipRemaining = Math.max(skipRemaining, nextCount);
    }
  }
}

if (rl) {
  rl.close();
}

const runEvent = buildRunWideEvent(config, projectionRun, baseContext, {
  durationMs: Date.now() - startedAt,
  outcome: 'success',
});
if (skipSpecs.length > 0) {
  (runEvent as Record<string, unknown>).skip = {
    spec: skipSpecs,
    skipped_steps: skippedCount,
  };
}
if (interrupted) {
  (runEvent as Record<string, unknown>).debug_interrupted = true;
}
logger.info(runEvent);

function getArgValue(argv: string[], key: string) {
  const index = argv.indexOf(key);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function getArgValues(argv: string[], key: string) {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === key && argv[i + 1]) {
      values.push(argv[i + 1]);
      i += 1;
    }
  }
  return values;
}

function firstPositional(argv: string[]) {
  return argv.find(arg => !arg.startsWith('-'));
}

function parseSkipSpec(spec: string): { steps: Set<number>; nextCount: number } {
  const steps = new Set<number>();
  let nextCount = 0;
  if (!spec) return { steps, nextCount };

  const tokens = spec.split(',').map(token => token.trim()).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith('next:')) {
      const count = Number(token.slice(5));
      if (Number.isFinite(count) && count > 0) nextCount = Math.max(nextCount, count);
      continue;
    }

    if (token.includes('-')) {
      const [startStr, endStr] = token.split('-', 2);
      const start = Number(startStr);
      const end = Number(endStr);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        for (let i = min; i <= max; i++) steps.add(i);
      }
      continue;
    }

    const value = Number(token);
    if (Number.isFinite(value)) steps.add(value);
  }

  if (!Number.isFinite(nextCount)) nextCount = 0;
  return { steps, nextCount };
}
