import { parseScenario } from '../parse-scenario';
import { formatPlainDate } from '../plain-date';
import { itemAt, makeDraw } from './draw';
import type { Draw } from './draw';
import { ENGINE_FAULTS, parserFault } from './faults';
import type { Fault, Target } from './faults';
import { observeTraits } from './traits';
import { validCase } from './valid';

/** One parity case: a scenario file, the today to run it with, and what the generator knows about it. */
export interface CorpusCase {
  scenario: unknown;
  today: string;
  /** Sorted. The engine never reads these. */
  traits: Array<string>;
}

const INVALID_EVERY = 20;
const ENGINE_FAULT_EVERY = 100;
const ENGINE_FAULT_SEED = 50;

/** The case for `seed`, a whole number from 1. The same seed always gives the same case. */
export function generateCase(seed: number): CorpusCase {
  if (!Number.isSafeInteger(seed) || seed < 1) {
    throw new RangeError(`A seed is a whole number from 1, not ${String(seed)}.`);
  }
  const draw = makeDraw(seed);
  const { file, today } = validCase(draw);
  const target = { file, today: formatPlainDate(today) };
  if (seed % INVALID_EVERY === 0) {
    return failingCase(target, parserFault(seed / INVALID_EVERY - 1), draw, 'invalid');
  }
  if (seed % ENGINE_FAULT_EVERY === ENGINE_FAULT_SEED) {
    const fault = itemAt(
      ENGINE_FAULTS,
      ((seed - ENGINE_FAULT_SEED) / ENGINE_FAULT_EVERY) % ENGINE_FAULTS.length
    );
    return failingCase(target, fault, draw, 'engine_error');
  }
  return {
    scenario: file,
    today: target.today,
    traits: observeTraits(file, parseScenario(file, { today: target.today }))
  };
}

function failingCase(
  target: Target,
  fault: Fault,
  draw: Draw,
  kind: 'invalid' | 'engine_error'
): CorpusCase {
  const { accountId, ruleId } = fault.apply(target, draw);
  const traits = [kind, `fault:${fault.name}`, `error:${fault.code}`];
  if (accountId !== undefined) {
    traits.push(`error_account:${accountId}`);
  }
  if (ruleId !== undefined) {
    traits.push(`error_rule:${ruleId}`);
  }
  return { scenario: target.file, today: target.today, traits: traits.toSorted() };
}
