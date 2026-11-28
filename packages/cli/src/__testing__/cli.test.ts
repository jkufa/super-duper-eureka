import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vite-plus/test';

const CLI = fileURLToPath(new URL('../index.ts', import.meta.url));
const EXAMPLES = fileURLToPath(new URL('../../examples/', import.meta.url));
const BASIC = join(EXAMPLES, 'basic.json');
const DAILY = join(EXAMPLES, 'daily.json');
const SCRATCH = mkdtempSync(join(tmpdir(), 'retirement-cli-'));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

function cli(...args: Array<string>) {
  const { status, stdout, stderr } = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { status, stdout, stderr };
}

function scratchFile(name: string, text: string): string {
  const path = join(SCRATCH, name);
  writeFileSync(path, text);
  return path;
}

describe('retirement-calc', () => {
  it('prints the projection as one JSON document and exits 0', () => {
    const { status, stdout, stderr } = cli('--scenario', BASIC, '--today', '2026-01-01');
    const projection: unknown = JSON.parse(stdout);

    expect([status, stderr]).toStrictEqual([0, '']);
    expect(stdout.endsWith('}\n')).toBe(true);
    expect(Object.keys(projection ?? {})).toStrictEqual([
      'today',
      'endDate',
      'effectiveRate',
      'staleAccounts',
      'salaryByYear',
      'bands'
    ]);
  });

  it('prints the trace of one account with --trace and --band', () => {
    const args = ['--scenario', BASIC, '--today', '2026-01-01', '--trace', 'roth'];
    const baseline = cli(...args);
    const positive = cli(...args, '--band', 'positive');
    const segments: unknown = JSON.parse(baseline.stdout);

    expect([baseline.status, baseline.stderr, positive.status]).toStrictEqual([0, '', 0]);
    expect(Array.isArray(segments) && segments.length > 0).toBe(true);
    expect(baseline.stdout.startsWith('[\n  {\n    "from": "2026-01-01",')).toBe(true);
    expect(positive.stdout).not.toBe(baseline.stdout);
  });

  it('prints the usage text to stdout with --help and exits 0', () => {
    const { status, stdout, stderr } = cli('--help');

    expect([status, stderr]).toStrictEqual([0, '']);
    expect(stdout.startsWith('Usage:\n  retirement-calc --scenario <file>')).toBe(true);
  });

  it.each([
    ['no --scenario', ['--today', '2026-01-01'], '--scenario is required.'],
    ['--band without --trace', ['--scenario', BASIC, '--band', 'positive'], '--band applies'],
    ['an unknown option', ['--scenario', BASIC, '--bogus'], 'bogus']
  ])('exits 1 with nothing on stdout for %s', (_, args, message) => {
    const { status, stdout, stderr } = cli(...args);

    expect([status, stdout]).toStrictEqual([1, '']);
    expect(stderr).toContain(message);
    expect(stderr).toContain('Usage:');
  });

  it('exits 1 with nothing on stdout for a file that is not JSON', () => {
    const path = scratchFile('not-json.json', '{ "version": 1,');
    const { status, stdout, stderr } = cli('--scenario', path, '--today', '2026-01-01');

    expect([status, stdout]).toStrictEqual([1, '']);
    expect(stderr).toContain(`${path} is not JSON`);
  });

  it('exits 1 with nothing on stdout for a file that cannot be read', () => {
    const path = join(SCRATCH, 'missing.json');
    const { status, stdout, stderr } = cli('--scenario', path, '--today', '2026-01-01');

    expect([status, stdout]).toStrictEqual([1, '']);
    expect(stderr).toContain(`Cannot read ${path}`);
  });

  it('prints the error code and ids and exits 2 for a scenario the parser rejects', () => {
    const path = scratchFile(
      'negative-amount.json',
      JSON.stringify({
        version: 1,
        endDate: '2027-01-01',
        interest: { annualRate: 0.05 },
        salary: { annualBase: 0, asOf: '2026-01-01' },
        accounts: [
          {
            id: 'savings',
            name: 'Savings',
            kind: 'other',
            included: true,
            balance: 0,
            balanceAsOf: '2026-01-01',
            contributions: [
              { id: 'monthly', type: 'flat', amount: -1, timing: { frequency: 'monthly' } }
            ]
          }
        ]
      })
    );
    const { status, stdout, stderr } = cli('--scenario', path, '--today', '2026-01-01');

    expect([status, stdout]).toStrictEqual([
      2,
      '{\n  "error": {\n    "code": "negative_amount",\n    "accountId": "savings",\n    "ruleId": "monthly"\n  }\n}\n'
    ]);
    expect(stderr).not.toBe('');
  });

  it('exits 2 with only the code for a bad --today', () => {
    const { status, stdout } = cli('--scenario', BASIC, '--today', '2026-02-30');

    expect([status, stdout]).toStrictEqual([
      2,
      '{\n  "error": {\n    "code": "invalid_date"\n  }\n}\n'
    ]);
  });

  it('takes the last value of a scalar option given twice', () => {
    const { status, stdout } = cli(
      '--scenario',
      BASIC,
      '--today',
      '2026-01-01',
      '--today',
      '2026-03-01'
    );

    expect(status).toBe(0);
    expect(stdout.startsWith('{\n  "today": "2026-03-01",')).toBe(true);
  });

  it('prints byte-identical output for the same input', () => {
    const args = ['--scenario', DAILY, '--today', '2026-02-01'];

    expect(cli(...args).stdout).toBe(cli(...args).stdout);
  });
});
