/**
 * Projection chart geometry: yearly series in, pixel geometry out.
 *
 * Pure. No DOM, no canvas, no measuring text, no renderer types. The same
 * function can feed an SVG on the web and single-colour mask layers on GPUI.
 * The numbers reproduce what LayerChart's AreaChart does in apps/webapp today:
 *   - x: band scale, points at band centres, a label every 5th year
 *   - y: linear from 0, niced; one axis tick per ~50px, 4-step grid
 *   - padding: left 20, top 4, right 4, bottom 20
 *   - curve: d3 curveNatural
 */
import { scaleBand, scaleLinear } from 'd3-scale';
import { area, curveNatural, line } from 'd3-shape';

export type SeriesKey = 'positive' | 'balance' | 'negative';

export interface ProjectionPoint {
  /** x label, e.g. "2038" */
  label: string;
  balance: number;
  /** variance band; omit both to draw the balance series alone */
  positive?: number;
  negative?: number;
}

export interface GeometryInput {
  points: Array<ProjectionPoint>;
  /** outer size of the chart box in px */
  width: number;
  height: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  /** label every nth point on the x axis */
  xTickEvery?: number;
}

export interface SeriesMark {
  key: SeriesKey;
  /** y in px, outer-box coordinates */
  y: number;
  value: number;
}

export interface Column {
  index: number;
  label: string;
  /** x in px, outer-box coordinates */
  x: number;
  /** top to bottom in paint order: positive, balance, negative */
  marks: Array<SeriesMark>;
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  /** SVG path data, outer-box coordinates */
  paths: {
    balanceArea: string;
    balanceLine: string;
    positiveLine: string | null;
    negativeLine: string | null;
  };
  /** y of each horizontal grid line */
  gridY: Array<number>;
  yTicks: Array<{ y: number; value: number }>;
  xTicks: Array<{ x: number; label: string }>;
  /** one entry per year: where the marker, dots and readout values come from */
  columns: Array<Column>;
  /** distance between neighbouring years in px */
  step: number;
}

const DEFAULT_PADDING = { top: 4, right: 4, bottom: 20, left: 20 };

export function buildProjectionGeometry(input: GeometryInput): ChartGeometry {
  const { points, width, height } = input;
  const padding = input.padding ?? DEFAULT_PADDING;
  const xTickEvery = input.xTickEvery ?? 5;

  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = Math.max(0, height - padding.top - padding.bottom);
  const plot = {
    left: padding.left,
    top: padding.top,
    right: padding.left + plotWidth,
    bottom: padding.top + plotHeight,
    width: plotWidth,
    height: plotHeight
  };

  const labels = points.map((point) => point.label);
  const band = scaleBand<string>().domain(labels).range([plot.left, plot.right]);
  const half = band.bandwidth() / 2;
  const xOf = (point: ProjectionPoint) => (band(point.label) ?? plot.left) + half;

  const hasVariance = points.some(
    (point) => typeof point.positive === 'number' || typeof point.negative === 'number'
  );
  const maxValue = points.reduce(
    (max, point) => Math.max(max, point.balance, point.positive ?? 0, point.negative ?? 0),
    0
  );
  const y = scaleLinear()
    .domain([0, maxValue || 1])
    .nice()
    .range([plot.bottom, plot.top]);

  const lineOf = (pick: (point: ProjectionPoint) => number) =>
    line<ProjectionPoint>()
      .x(xOf)
      .y((point) => y(pick(point)))
      .curve(curveNatural)(points) ?? '';

  const balanceArea =
    area<ProjectionPoint>()
      .x(xOf)
      .y0(y(0))
      .y1((point) => y(point.balance))
      .curve(curveNatural)(points) ?? '';

  const yTickCount = Math.max(1, Math.round(plotHeight / 50));

  const columns: Array<Column> = points.map((point, index) => {
    const marks: Array<SeriesMark> = [];
    if (typeof point.positive === 'number') {
      marks.push({ key: 'positive', y: y(point.positive), value: point.positive });
    }
    marks.push({ key: 'balance', y: y(point.balance), value: point.balance });
    if (typeof point.negative === 'number') {
      marks.push({ key: 'negative', y: y(point.negative), value: point.negative });
    }
    return { index, label: point.label, x: xOf(point), marks };
  });

  return {
    width,
    height,
    plot,
    paths: {
      balanceArea,
      balanceLine: lineOf((point) => point.balance),
      positiveLine: hasVariance ? lineOf((point) => point.positive ?? point.balance) : null,
      negativeLine: hasVariance ? lineOf((point) => point.negative ?? point.balance) : null
    },
    gridY: y.ticks(4).map((value) => y(value)),
    yTicks: y.ticks(yTickCount).map((value) => ({ y: y(value), value })),
    xTicks: columns
      .filter((column) => column.index % xTickEvery === 0)
      .map((column) => ({ x: column.x, label: column.label })),
    columns,
    step: band.step()
  };
}

/** Nearest year for an x in outer-box px. Used by click, drag and nothing else. */
export function columnIndexAtX(geometry: ChartGeometry, x: number): number {
  const count = geometry.columns.length;
  if (count === 0 || geometry.step === 0) {
    return 0;
  }
  const raw = Math.floor((x - geometry.plot.left) / geometry.step);
  return Math.min(count - 1, Math.max(0, raw));
}

/** Arrow-key stepping, clamped to the series. */
export function stepColumnIndex(geometry: ChartGeometry, index: number, delta: number): number {
  return Math.min(geometry.columns.length - 1, Math.max(0, index + delta));
}
