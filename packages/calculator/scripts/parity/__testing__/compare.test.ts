import { describe, expect, it } from 'vite-plus/test';

import type { Json } from '../../../src/lib/corpus/json';
import {
  compareDocuments,
  compareErrors,
  errorReportOf,
  expectedErrorOf,
  parseJson,
  TOLERANCE
} from '../compare';

const DOCUMENT = {
  today: '2026-01-01',
  effectiveRate: 0.05,
  rows: [
    { year: 2026, balance: 100.5, weightedRate: null },
    { year: 2027, balance: 205.25, weightedRate: 0.05 }
  ],
  included: true
};

function edited(edit: (document: typeof DOCUMENT) => void): Json {
  const copy = structuredClone(DOCUMENT);
  edit(copy);
  return copy;
}

function nextUp(value: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
}

describe('compareDocuments', () => {
  it('passes identical documents and counts every number', () => {
    const comparison = compareDocuments(DOCUMENT, structuredClone(DOCUMENT));

    expect(comparison).toStrictEqual({ numbers: 6, differences: [], signedZeros: 0 });
  });

  it('passes a number one ulp away and reports it as a difference', () => {
    const balance = nextUp(205.25);
    const comparison = compareDocuments(
      DOCUMENT,
      edited((document) => {
        const [, row] = document.rows;
        if (row) {
          row.balance = balance;
        }
      })
    );

    expect(comparison.structure).toBeUndefined();
    expect(comparison.differences).toStrictEqual([
      {
        path: '$.rows[1].balance',
        ts: 205.25,
        rust: balance,
        relative: (balance - 205.25) / balance,
        beyondTolerance: false
      }
    ]);
  });

  it('marks a difference just beyond the tolerance', () => {
    const comparison = compareDocuments({ a: 1 }, { a: 1 + 2 * TOLERANCE });

    expect(comparison.differences.map(({ beyondTolerance }) => beyondTolerance)).toStrictEqual([
      true
    ]);
  });

  it('passes a difference of exactly the tolerance below 1', () => {
    const comparison = compareDocuments({ a: 0 }, { a: TOLERANCE });

    expect(comparison.differences.map(({ beyondTolerance }) => beyondTolerance)).toStrictEqual([
      false
    ]);
  });

  it('agrees on 0 and -0 and counts them apart', () => {
    expect(compareDocuments({ a: 0 }, { a: -0 })).toStrictEqual({
      numbers: 1,
      differences: [],
      signedZeros: 1
    });
  });

  it('reads a large whole number and its exponent form as the same float', () => {
    const ts = parseJson('{"a":1588767481951509500}') ?? null;
    const rust = parseJson('{"a":1.5887674819515095e18}') ?? null;

    expect(compareDocuments(ts, rust).differences).toStrictEqual([]);
  });

  it.each([
    [
      'a missing key',
      edited((document) => {
        const [row] = document.rows;
        if (row) {
          Reflect.deleteProperty(row, 'weightedRate');
        }
      }),
      { path: '$.rows[0].weightedRate', reason: 'missing in Rust', ts: null, rust: undefined }
    ],
    [
      'an extra key',
      { ...DOCUMENT, extra: 1 },
      { path: '$.extra', reason: 'missing in TS', ts: undefined, rust: 1 }
    ],
    [
      'a reordered key',
      {
        effectiveRate: DOCUMENT.effectiveRate,
        today: DOCUMENT.today,
        rows: DOCUMENT.rows,
        included: true
      },
      {
        path: '$',
        reason: 'key order',
        ts: ['today', 'effectiveRate', 'rows', 'included'],
        rust: ['effectiveRate', 'today', 'rows', 'included']
      }
    ],
    [
      'a different array length',
      edited((document) => {
        document.rows.pop();
      }),
      { path: '$.rows', reason: 'array length 2 against 1', ts: 2, rust: 1 }
    ],
    [
      'a string that differs',
      { ...DOCUMENT, today: '2026-01-02' },
      { path: '$.today', reason: 'different string', ts: '2026-01-01', rust: '2026-01-02' }
    ],
    [
      'null against a number',
      edited((document) => {
        const [row] = document.rows;
        if (row) {
          Object.assign(row, { weightedRate: 0 });
        }
      }),
      { path: '$.rows[0].weightedRate', reason: 'null against number', ts: null, rust: 0 }
    ],
    [
      'a boolean that differs',
      { ...DOCUMENT, included: false },
      { path: '$.included', reason: 'different boolean', ts: true, rust: false }
    ]
  ])('fails %s at its path', (_, rust, structure) => {
    expect(compareDocuments(DOCUMENT, rust).structure).toStrictEqual(structure);
  });
});

describe('compareErrors', () => {
  it('agrees on the same code and ids', () => {
    const error = { code: 'negative_amount', accountId: 'a1', ruleId: 'r1' };

    expect(compareErrors(error, { ...error })).toStrictEqual([]);
  });

  it('fails a different code', () => {
    expect(
      compareErrors({ code: 'invalid_date' }, { code: 'invalid_field' }, ['TS', 'Rust'])
    ).toStrictEqual(['code: TS invalid_date, Rust invalid_field']);
  });

  it('fails a different or missing id for other codes', () => {
    expect(
      compareErrors(
        { code: 'negative_amount', accountId: 'a1', ruleId: 'r1' },
        { code: 'negative_amount', accountId: 'a2' }
      )
    ).toStrictEqual(['accountId: TS a1, Rust a2', 'ruleId: TS r1, Rust undefined']);
  });

  it('compares invalid_field by its code alone', () => {
    expect(
      compareErrors(
        { code: 'invalid_field', accountId: 'a1', ruleId: 'r1' },
        { code: 'invalid_field' }
      )
    ).toStrictEqual([]);
  });

  it('compares a not_finite id only when both report one', () => {
    expect(
      compareErrors({ code: 'not_finite', accountId: 'a1' }, { code: 'not_finite' })
    ).toStrictEqual([]);
    expect(
      compareErrors(
        { code: 'not_finite', accountId: 'a1' },
        { code: 'not_finite', accountId: 'a2' }
      )
    ).toStrictEqual(['accountId: TS a1, Rust a2']);
  });
});

describe('errorReportOf', () => {
  it('reads an error document', () => {
    expect(errorReportOf({ error: { code: 'duplicate_id', accountId: 'a1' } })).toStrictEqual({
      code: 'duplicate_id',
      accountId: 'a1',
      ruleId: undefined
    });
  });

  it.each([
    ['a projection', { today: '2026-01-01' }],
    ['an extra member', { error: { code: 'duplicate_id' }, extra: 1 }],
    ['an unknown error key', { error: { code: 'duplicate_id', path: 'accounts' } }],
    ['a code that is not a string', { error: { code: 2 } }]
  ])('rejects %s', (_, document) => {
    expect(errorReportOf(document)).toBeUndefined();
  });
});

describe('expectedErrorOf', () => {
  it('reads the code and ids a failing case predicts', () => {
    expect(
      expectedErrorOf(['error:negative_amount', 'error_account:a1', 'error_rule:r1', 'invalid'])
    ).toStrictEqual({ code: 'negative_amount', accountId: 'a1', ruleId: 'r1' });
  });

  it('predicts nothing for a valid case', () => {
    expect(expectedErrorOf(['stale', 'zero_variance'])).toBeUndefined();
  });
});
