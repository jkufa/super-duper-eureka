/** A value JSON can hold. */
export type Json = null | boolean | number | string | Array<Json> | { [key: string]: Json };

/** JSON with keys sorted by code unit, a two-space indent and a trailing newline. */
export function stableJson(value: unknown): string {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function canonical(value: unknown): Json {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RangeError(`JSON has no number ${String(value)}.`);
    }
    return value;
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => canonical(item));
  }
  if (typeof value !== 'object') {
    throw new TypeError(`JSON has no ${typeof value} value.`);
  }
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, canonical(item)])
  );
}
