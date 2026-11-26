/** Spike Q3: the parsing behind the shared numeric field. No Svelte, no renderer. */

/** How a committed number reads in the field. Rounds away float noise from stepping. */
export function formatNumber(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

/**
 * The number a draft commits to. An empty draft commits `fallback`. A draft that is not a number
 * keeps `previous`, the value committed before. Grouping commas, `$`, `%` and spaces are ignored.
 */
export function parseNumber(draft: string, fallback: number, previous: number): number {
  const cleaned = draft.replaceAll(/[\s$,%]/g, '');
  if (cleaned === '') {
    return fallback;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : previous;
}
