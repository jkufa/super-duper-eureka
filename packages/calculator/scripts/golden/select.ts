import type { CorpusCase } from '../../src/lib/corpus/case';
import { parseScenario } from '../../src/lib/parse-scenario';

/** A generated case and what keeping it would cost. */
export interface Candidate {
  seed: number;
  corpusCase: CorpusCase;
  /** Traits the selection covers: every trait but the ids of an expected error. */
  traits: Array<string>;
  /** Rows the expected output holds, roughly: months times series times bands, plus the trace. */
  cost: number;
}

const BANDS = 3;
/** A trait whose cheapest case costs more than this is needed once. */
const EXPENSIVE = 1000;
const ID_TRAITS = ['error_account:', 'error_rule:'];
const FAILURE_TRAITS = ['invalid', 'engine_error', 'fault:', 'error:'];

function isFailureTrait(trait: string): boolean {
  return FAILURE_TRAITS.some((prefix) => trait.startsWith(prefix));
}

function costOf(corpusCase: CorpusCase): number {
  try {
    const scenario = parseScenario(corpusCase.scenario, { today: corpusCase.today });
    const end = scenario.endDate.year * 12 + scenario.endDate.month;
    const today = scenario.today.year * 12 + scenario.today.month;
    const [first] = scenario.accounts;
    const traced = first ? end - (first.balanceAsOf.year * 12 + first.balanceAsOf.month) + 2 : 0;
    return (end - today + 1) * (scenario.accounts.length + 1) * BANDS + traced;
  } catch {
    return 1;
  }
}

export function candidateOf(seed: number, corpusCase: CorpusCase): Candidate {
  return {
    seed,
    corpusCase,
    traits: corpusCase.traits.filter((trait) => !ID_TRAITS.some((id) => trait.startsWith(id))),
    cost: costOf(corpusCase)
  };
}

/**
 * Picks `size` candidates. First, greedily by new traits per unit of cost, until every trait in
 * the pool appears `depth` times or as often as the pool allows, with the largest `depth` that
 * stays within `size`. A trait of a failing case, or one only costly cases carry, is needed once. Then the cheapest valid cases of
 * the rest, lowest seed first on ties.
 */
export function selectCases(pool: ReadonlyArray<Candidate>, size: number): Array<Candidate> {
  let best: Array<Candidate> = [];
  for (let depth = 1; ; depth++) {
    const chosen = cover(pool, depth);
    if (chosen.length > size) {
      break;
    }
    best = chosen;
    if (chosen.length === pool.length) {
      break;
    }
  }
  const picked = new Set(best.map(({ seed }) => seed));
  const rest = pool
    .filter(({ seed, traits }) => !picked.has(seed) && !traits.some(isFailureTrait))
    .toSorted((a, b) => a.cost - b.cost || a.seed - b.seed);
  return [...best, ...rest.slice(0, size - best.length)].toSorted((a, b) => a.seed - b.seed);
}

function cover(pool: ReadonlyArray<Candidate>, depth: number): Array<Candidate> {
  const available = new Map<string, number>();
  const cheapest = new Map<string, number>();
  for (const { traits, cost } of pool) {
    for (const trait of traits) {
      available.set(trait, (available.get(trait) ?? 0) + 1);
      cheapest.set(trait, Math.min(cheapest.get(trait) ?? cost, cost));
    }
  }
  const needed = new Map(
    [...available].map(([trait, count]) => {
      const once = isFailureTrait(trait) || (cheapest.get(trait) ?? 0) > EXPENSIVE;
      return [trait, Math.min(once ? 1 : depth, count)];
    })
  );
  const chosen: Array<Candidate> = [];
  const remaining = new Set(pool);
  for (;;) {
    let bestCandidate: Candidate | undefined;
    let bestScore = 0;
    for (const candidate of remaining) {
      const gain = candidate.traits.filter((trait) => (needed.get(trait) ?? 0) > 0).length;
      const score = gain / candidate.cost;
      if (
        gain > 0 &&
        (score > bestScore ||
          (score === bestScore && bestCandidate && candidate.seed < bestCandidate.seed))
      ) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }
    if (!bestCandidate) {
      return chosen;
    }
    chosen.push(bestCandidate);
    remaining.delete(bestCandidate);
    for (const trait of bestCandidate.traits) {
      needed.set(trait, (needed.get(trait) ?? 0) - 1);
    }
  }
}
