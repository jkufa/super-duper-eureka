import type { Json } from '../../src/lib/corpus/json';

/** Keys the Rust output types hold as integers, which serde_json prints without a fraction. */
const INTEGER_KEYS = new Set(['year', 'month', 'days', 'daysInMonth', 'daysInYear', 'bucket']);
const INDENT = '  ';
const SHORTEST_FIXED_DIGITS = 16;
const SMALLEST_FIXED_EXPONENT = -5;

/**
 * A float as serde_json prints it: the shortest digits that read back as the same float, in fixed
 * notation from 1e-5 up to 1e16, and otherwise with an exponent that carries its sign.
 */
export function rustFloat(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`JSON has no number ${String(value)}.`);
  }
  if (value === 0) {
    return Object.is(value, -0) ? '-0.0' : '0.0';
  }
  const sign = value < 0 ? '-' : '';
  const [mantissa = '', exponentText = '0'] = Math.abs(value).toExponential().split('e');
  const digits = mantissa.replace('.', '');
  const point = Number(exponentText) + 1;
  const length = digits.length;
  if (point >= length && point <= SHORTEST_FIXED_DIGITS) {
    return `${sign}${digits}${'0'.repeat(point - length)}.0`;
  }
  if (point > 0 && point <= SHORTEST_FIXED_DIGITS) {
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  if (point > SMALLEST_FIXED_EXPONENT && point <= 0) {
    return `${sign}0.${'0'.repeat(-point)}${digits}`;
  }
  const fraction = length === 1 ? '' : `.${digits.slice(1)}`;
  const exponent = point - 1;
  return `${sign}${digits.slice(0, 1)}${fraction}e${exponent < 0 ? '' : '+'}${String(exponent)}`;
}

function rustNumber(value: number, key: string | undefined): string {
  if (key !== undefined && INTEGER_KEYS.has(key)) {
    if (!Number.isInteger(value)) {
      throw new RangeError(`${key} is ${String(value)}, not a whole number.`);
    }
    return String(value);
  }
  return rustFloat(value);
}

function print(value: Json, key: string | undefined, depth: number): string {
  if (typeof value === 'number') {
    return rustNumber(value, key);
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  const inner = INDENT.repeat(depth + 1);
  const outer = INDENT.repeat(depth);
  if (Array.isArray(value)) {
    return value.length === 0
      ? '[]'
      : `[\n${value.map((item) => `${inner}${print(item, key, depth + 1)}`).join(',\n')}\n${outer}]`;
  }
  const entries = Object.entries(value);
  return entries.length === 0
    ? '{}'
    : `{\n${entries
        .map(([name, item]) => `${inner}${JSON.stringify(name)}: ${print(item, name, depth + 1)}`)
        .join(',\n')}\n${outer}}`;
}

/** A CLI document printed as the Rust CLI prints it: `serde_json::to_writer_pretty` and a newline. */
export function rustJson(value: Json): string {
  return `${print(value, undefined, 0)}\n`;
}
