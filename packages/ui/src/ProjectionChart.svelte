<script lang="ts">
  import { IS_GPUIX } from 'gpuix-svelte';
  import { key_of } from 'gpuix-svelte-ui/keys';
  import { aria_value, bounds_of, focus_node, pointer_x, test_id } from 'gpuix-svelte-ui/shared';
  import type { Component } from 'svelte';
  import { buildProjectionGeometry, columnIndexAtX, stepColumnIndex } from './chart-geometry';
  import type { ProjectionPoint } from './chart-geometry';
  import type { ChartPaintProps } from './chart-paint';

  // Spike Q4: the shared chart. Geometry comes from framework-free TS, each app paints it, and this
  // component owns the size, the selected year, pointer and keyboard input, the marker and the
  // tooltip. The box sizes itself from its parent; the plot size comes from `onlayout` on GPUI and
  // a ResizeObserver in the DOM.
  let {
    points,
    Paint,
    trace
  }: {
    points: Array<ProjectionPoint>;
    Paint: Component<ChartPaintProps>;
    trace?: (event: string, detail?: unknown) => void;
  } = $props();

  let width = $state(0);
  let height = $state(0);
  // The box's left edge in window coordinates: GPUI's `onlayout` reports it, and the pointer's
  // window x minus this is the x in the box, which the geometry maps to a year.
  let left = $state(0);
  // svelte-ignore state_referenced_locally
  let selected = $state(points.length - 1);
  // What `{@attach}` hands over: an HTMLElement in the DOM, a ShadowNode on GPUI. Neither type
  // exists under the other renderer's type check, so the kit's helpers take it opaque.
  let box: unknown;

  const geometry = $derived(
    width > 0 && height > 0 ? buildProjectionGeometry({ points, width, height }) : null
  );
  const column = $derived(geometry?.columns[Math.min(selected, geometry.columns.length - 1)]);

  const TOOLTIP_WIDTH = 150;
  const tooltip = $derived.by(() => {
    if (!geometry || !column) {
      return null;
    }
    const top = Math.min(...column.marks.map((mark) => mark.y));
    // Right of the marker, or left of it near the right edge.
    const x =
      column.x + 12 + TOOLTIP_WIDTH > geometry.width
        ? column.x - 12 - TOOLTIP_WIDTH
        : column.x + 12;
    // Rows of 16px with 2px gaps, plus 12px of padding and 2px of border, as the styles below set.
    const rows = column.marks.length + 1;
    const tooltipHeight = rows * 16 + (rows - 1) * 2 + 14;
    // Keep the whole box inside the chart, which clips its overflow.
    const y = Math.min(top - 20, geometry.height - tooltipHeight);
    return { left: Math.max(0, x), top: Math.max(0, y) };
  });

  type Layout = { x?: number; y?: number; width?: number; height?: number };
  type Pointer = { x?: number; clientX?: number };
  type Key = { key?: string | null; preventDefault(): void };

  function onlayout(e: Layout) {
    width = e.width ?? 0;
    height = e.height ?? 0;
    left = e.x ?? 0;
    trace?.('chart:layout', { x: e.x, y: e.y, width: e.width, height: e.height });
  }

  function select(index: number, source: string) {
    if (index !== selected) {
      selected = index;
      trace?.('chart:select', { source, index, label: points[index]?.label });
    }
  }

  function indexAt(e: Pointer): number | null {
    if (!geometry) {
      return null;
    }
    // In the DOM the box can move with the page's scroll, so its edge is read at the event.
    const edge = IS_GPUIX ? left : (bounds_of(box)?.x ?? 0);
    return columnIndexAtX(geometry, pointer_x(e) - edge);
  }

  function onmousemove(e: Pointer) {
    const index = indexAt(e);
    if (index !== null) {
      select(index, `mousemove x=${pointer_x(e)}`);
    }
  }

  function onclick(e: Pointer) {
    focus_node(box);
    const index = indexAt(e);
    if (index !== null) {
      select(index, `click x=${pointer_x(e)}`);
    }
  }

  function onkeydown(e: Key) {
    const key = key_of(e);
    if (geometry && (key === 'left' || key === 'right')) {
      e.preventDefault();
      select(stepColumnIndex(geometry, selected, key === 'left' ? -1 : 1), `key ${key}`);
    }
  }

  // The DOM has no `onlayout`: measure with a ResizeObserver instead.
  function measure(node: unknown) {
    box = node;
    if (IS_GPUIX) {
      return;
    }
    const element = node as HTMLElement;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        trace?.('chart:resize', { width, height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }

  const handlers = $derived(
    IS_GPUIX ? { onlayout, onmousemove, onclick, onkeydown } : { onmousemove, onclick, onkeydown }
  );

  const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;
  const NAMES = { positive: '+1%', balance: 'Balance', negative: '-1%' } as const;
</script>

<div class="chart">
  <div class="readout" {...test_id('chart-readout')}>
    {#if column}
      {column.label}: {money(column.marks.find((mark) => mark.key === 'balance')?.value ?? 0)}
    {:else}
      Measuring…
    {/if}
  </div>
  <div
    class="box"
    role="slider"
    tabindex="0"
    aria-label="Projection year"
    aria-valuetext={column?.label ?? ''}
    {@attach measure}
    {...aria_value(selected, 0, points.length - 1)}
    {...handlers}
    {...test_id('chart-box')}
  >
    {#if geometry}
      <Paint {geometry} />
      {#if column}
        <div
          class="marker"
          style:left="{column.x}px"
          style:top="{geometry.plot.top}px"
          style:height="{geometry.plot.height}px"
        ></div>
      {/if}
      {#each geometry.xTicks as tick (tick.label)}
        <div class="tick" style:left="{tick.x - 20}px" style:top="{geometry.plot.bottom + 4}px">
          {tick.label}
        </div>
      {/each}
      {#if tooltip && column}
        <div
          class="tooltip"
          style:left="{tooltip.left}px"
          style:top="{tooltip.top}px"
          {...test_id('chart-tooltip')}
        >
          <div class="tooltip-year">{column.label}</div>
          {#each column.marks as mark (mark.key)}
            <div class="tooltip-row">{NAMES[mark.key]}: {money(mark.value)}</div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .chart {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    height: 100%;
  }
  .readout {
    font-size: 14px;
    color: var(--ui-ink);
  }
  .box {
    position: relative;
    flex-grow: 1;
    flex-basis: 0;
    min-height: 200px;
    width: 100%;
    overflow: hidden;
  }
  .marker {
    position: absolute;
    width: 1px;
    background-color: var(--ui-muted);
    pointer-events: none;
  }
  .tick {
    position: absolute;
    width: 40px;
    font-size: 11px;
    line-height: 14px;
    text-align: center;
    color: var(--ui-muted);
    pointer-events: none;
  }
  .tooltip {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 150px;
    padding: 6px 8px;
    border-radius: 6px;
    border-width: 1px;
    border-style: solid;
    border-color: var(--ui-border-strong);
    background-color: var(--ui-panel);
    color: var(--ui-ink);
    font-size: 12px;
    line-height: 16px;
    pointer-events: none;
    box-sizing: border-box;
  }
  .tooltip-year {
    font-weight: 600;
  }
</style>
