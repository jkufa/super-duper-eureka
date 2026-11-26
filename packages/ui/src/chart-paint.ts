import type { ChartGeometry } from './chart-geometry';

/**
 * What the shared chart hands each app's paint layer (spike Q4). The paint layer draws the grid,
 * the balance area and the three lines and nothing else: it takes no pointer input, and the
 * shared chart draws the marker, the labels and the tooltip on top.
 */
export interface ChartPaintProps {
  geometry: ChartGeometry;
}

/**
 * One colour per layer, as theme tokens. GPUI tints each SVG mask with one colour, so each entry
 * here is one layer there. `area` is the accent at 16% alpha (`--ui-accent-wash` is `#ff3e0029`).
 */
export const CHART_COLORS = {
  grid: 'var(--ui-border)',
  area: 'var(--ui-accent-wash)',
  balance: 'var(--ui-accent)',
  positive: 'var(--ui-success)',
  negative: 'var(--ui-danger)'
} as const;

/** Dash pattern of the variance lines, in px: dash, gap. */
export const VARIANCE_DASH = '6 4';
