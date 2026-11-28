import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

const SRC_DIR = new URL('../../', import.meta.url);
const TEST_DIR = '__testing__';
const FORBIDDEN = ['new Date', 'Date.now', 'Math.random'];

function engineFiles(): Array<string> {
  return readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.split('/').includes(TEST_DIR))
    .toSorted();
}

describe('engine source', () => {
  it('scans every engine module', () => {
    expect(engineFiles()).toContain('lib/project-scenario.ts');
    expect(engineFiles()).toContain('index.ts');
  });

  it.each(engineFiles())('%s reads no clock and no unseeded randomness', (file) => {
    const text = readFileSync(new URL(file, SRC_DIR), 'utf8');

    expect(FORBIDDEN.filter((call) => text.includes(call))).toStrictEqual([]);
  });
});
