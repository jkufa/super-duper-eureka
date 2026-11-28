import type { Json } from '../../src/lib/corpus/json';

/** Two numbers agree when `|a - b| <= TOLERANCE * max(1, |a|, |b|)`. Spec 4 part F. */
export const TOLERANCE = 1e-9;

type JsonObject = { [key: string]: Json };

/** Two numbers that are not the same float. */
export interface NumberDifference {
  path: string;
  ts: number;
  rust: number;
  /** `|ts - rust| / max(1, |ts|, |rust|)`. */
  relative: number;
  beyondTolerance: boolean;
}

/** The first place the two documents differ in anything but a number's value. */
export interface StructureMismatch {
  path: string;
  reason: string;
  ts: Json | undefined;
  rust: Json | undefined;
}

export interface DocumentComparison {
  structure?: StructureMismatch;
  /** Numbers compared before the walk ended. */
  numbers: number;
  /** In document order. */
  differences: Array<NumberDifference>;
  /** Pairs that are `0` on one side and `-0` on the other. */
  signedZeros: number;
}

/** Parses JSON text as `JSON.parse` does, or undefined when it is not JSON. */
export function parseJson(text: string): Json | undefined {
  try {
    return toJson(JSON.parse(text));
  } catch {
    return undefined;
  }
}

function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => toJson(item));
  }
  if (typeof value !== 'object') {
    throw new TypeError(`JSON has no ${typeof value} value.`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)]));
}

/** The value at `keys` inside `document`, or undefined when a key is missing. */
export function memberAt(
  document: Json | undefined,
  keys: ReadonlyArray<string>
): Json | undefined {
  let value = document;
  for (const key of keys) {
    value = isObject(value) && Object.hasOwn(value, key) ? value[key] : undefined;
  }
  return value;
}

export function relativeDifference(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Walks two parsed JSON documents in step. Keys, their order, array lengths, strings, booleans
 * and nulls must be identical, and the walk stops at the first that is not. Numbers are compared
 * as floats, so `0` and `-0` agree, and every number that differs is listed.
 */
export function compareDocuments(
  ts: Json,
  rust: Json,
  tolerance: number = TOLERANCE
): DocumentComparison {
  const comparison: DocumentComparison = { numbers: 0, differences: [], signedZeros: 0 };
  const structure = walk(ts, rust, '$', tolerance, comparison);
  return structure ? { ...comparison, structure } : comparison;
}

function kindOf(value: Json): string {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'array' : typeof value;
}

function isObject(value: Json | undefined): value is JsonObject {
  return value !== undefined && kindOf(value) === 'object';
}

function walk(
  ts: Json,
  rust: Json,
  path: string,
  tolerance: number,
  comparison: DocumentComparison
): StructureMismatch | undefined {
  const kind = kindOf(ts);
  if (kind !== kindOf(rust)) {
    return { path, reason: `${kind} against ${kindOf(rust)}`, ts, rust };
  }
  if (typeof ts === 'number' && typeof rust === 'number') {
    compareNumbers(ts, rust, path, tolerance, comparison);
    return undefined;
  }
  if (Array.isArray(ts) && Array.isArray(rust)) {
    return walkArrays(ts, rust, path, tolerance, comparison);
  }
  if (isObject(ts) && isObject(rust)) {
    return walkObjects(ts, rust, path, tolerance, comparison);
  }
  return ts === rust ? undefined : { path, reason: `different ${kind}`, ts, rust };
}

function compareNumbers(
  ts: number,
  rust: number,
  path: string,
  tolerance: number,
  comparison: DocumentComparison
) {
  comparison.numbers += 1;
  if (ts === rust) {
    if (!Object.is(ts, rust)) {
      comparison.signedZeros += 1;
    }
    return;
  }
  comparison.differences.push({
    path,
    ts,
    rust,
    relative: relativeDifference(ts, rust),
    beyondTolerance: Math.abs(ts - rust) > tolerance * Math.max(1, Math.abs(ts), Math.abs(rust))
  });
}

function walkArrays(
  ts: Array<Json>,
  rust: Array<Json>,
  path: string,
  tolerance: number,
  comparison: DocumentComparison
): StructureMismatch | undefined {
  if (ts.length !== rust.length) {
    return {
      path,
      reason: `array length ${String(ts.length)} against ${String(rust.length)}`,
      ts: ts.length,
      rust: rust.length
    };
  }
  for (const [index, item] of ts.entries()) {
    const other = rust[index];
    const mismatch =
      other === undefined
        ? undefined
        : walk(item, other, `${path}[${String(index)}]`, tolerance, comparison);
    if (mismatch) {
      return mismatch;
    }
  }
  return undefined;
}

function walkObjects(
  ts: JsonObject,
  rust: JsonObject,
  path: string,
  tolerance: number,
  comparison: DocumentComparison
): StructureMismatch | undefined {
  const tsKeys = Object.keys(ts);
  const rustKeys = Object.keys(rust);
  const missing = tsKeys.find((key) => !Object.hasOwn(rust, key));
  if (missing !== undefined) {
    return {
      path: `${path}.${missing}`,
      reason: 'missing in Rust',
      ts: ts[missing],
      rust: undefined
    };
  }
  const extra = rustKeys.find((key) => !Object.hasOwn(ts, key));
  if (extra !== undefined) {
    return { path: `${path}.${extra}`, reason: 'missing in TS', ts: undefined, rust: rust[extra] };
  }
  if (tsKeys.some((key, index) => rustKeys[index] !== key)) {
    return { path, reason: 'key order', ts: tsKeys, rust: rustKeys };
  }
  for (const key of tsKeys) {
    const [tsValue, rustValue] = [ts[key], rust[key]];
    const mismatch =
      tsValue === undefined || rustValue === undefined
        ? undefined
        : walk(tsValue, rustValue, `${path}.${key}`, tolerance, comparison);
    if (mismatch) {
      return mismatch;
    }
  }
  return undefined;
}

/** The `error` member a CLI prints with exit status 2, or what a case's traits predict. */
export interface ErrorReport {
  code: string;
  accountId?: string;
  ruleId?: string;
}

function idsToCompare(code: string, a: string | undefined, b: string | undefined): boolean {
  if (code === 'invalid_field') {
    return false;
  }
  if (code === 'not_finite') {
    return a !== undefined && b !== undefined;
  }
  return true;
}

/**
 * How two error reports disagree, empty when they agree. The code must match. Ids are compared
 * except for `invalid_field`, and for `not_finite` only when both sides carry one. Spec 4 part F.
 */
export function compareErrors(
  a: ErrorReport,
  b: ErrorReport,
  labels: readonly [string, string] = ['TS', 'Rust']
): Array<string> {
  const [aLabel, bLabel] = labels;
  if (a.code !== b.code) {
    return [`code: ${aLabel} ${a.code}, ${bLabel} ${b.code}`];
  }
  const problems: Array<string> = [];
  for (const field of ['accountId', 'ruleId'] as const) {
    const aId = a[field];
    const bId = b[field];
    if (idsToCompare(a.code, aId, bId) && aId !== bId) {
      problems.push(`${field}: ${aLabel} ${String(aId)}, ${bLabel} ${String(bId)}`);
    }
  }
  return problems;
}

/** Reads the error report from a printed `{ "error": { ... } }` document, or undefined. */
export function errorReportOf(document: Json | undefined): ErrorReport | undefined {
  if (!isObject(document) || Object.keys(document).length !== 1 || !isObject(document.error)) {
    return undefined;
  }
  const { code, accountId, ruleId, ...rest } = document.error;
  if (
    typeof code !== 'string' ||
    Object.keys(rest).length > 0 ||
    !(accountId === undefined || typeof accountId === 'string') ||
    !(ruleId === undefined || typeof ruleId === 'string')
  ) {
    return undefined;
  }
  return { code, accountId, ruleId };
}

/** The error a failing case's traits predict, or undefined for a case expected to succeed. */
export function expectedErrorOf(traits: ReadonlyArray<string>): ErrorReport | undefined {
  const value = (prefix: string) =>
    traits.find((trait) => trait.startsWith(prefix))?.slice(prefix.length);
  const code = value('error:');
  return code === undefined
    ? undefined
    : { code, accountId: value('error_account:'), ruleId: value('error_rule:') };
}
