import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateCase } from '../src/lib/corpus/case';
import { stableJson } from '../src/lib/corpus/json';

const USAGE = `Usage: write-corpus <outputDir> <firstSeed> <lastSeed>

Writes two files per seed, from firstSeed to lastSeed, both whole numbers from 1:
  <seed>.json           the case: { scenario, today, traits }
  <seed>.scenario.json  the case's scenario alone, for --scenario`;

const SEED_PATTERN = /^[1-9][0-9]*$/;

function seedFrom(text: string | undefined): number | undefined {
  return text !== undefined && SEED_PATTERN.test(text) && Number.isSafeInteger(Number(text))
    ? Number(text)
    : undefined;
}

function main(args: Array<string>): number {
  const [outputDir, firstText, lastText, ...rest] = args;
  const first = seedFrom(firstText);
  const last = seedFrom(lastText);
  if (
    outputDir === undefined ||
    first === undefined ||
    last === undefined ||
    last < first ||
    rest.length > 0
  ) {
    process.stderr.write(`${USAGE}\n`);
    return 1;
  }
  mkdirSync(outputDir, { recursive: true });
  for (let seed = first; seed <= last; seed++) {
    const corpusCase = generateCase(seed);
    writeFileSync(join(outputDir, `${String(seed)}.json`), stableJson(corpusCase));
    writeFileSync(
      join(outputDir, `${String(seed)}.scenario.json`),
      stableJson(corpusCase.scenario)
    );
  }
  process.stderr.write(`Wrote seeds ${String(first)} to ${String(last)} to ${outputDir}.\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
