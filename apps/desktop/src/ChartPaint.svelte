<script lang="ts">
  import type { ChartGeometry } from '@retirement/ui/chart-geometry';
  import { CHART_COLORS, VARIANCE_DASH } from '@retirement/ui/chart-paint';
  import type { ChartPaintProps } from '@retirement/ui/chart-paint';

  // The GPUI paint layer of the shared chart. GPUI draws an <svg> as a mask tinted with the
  // element's `color`, so every colour is its own layer: SVG markup generated at runtime from the
  // same path data the web draws, stacked in paint order.
  let { geometry }: ChartPaintProps = $props();

  function mask(g: ChartGeometry, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">${body}</svg>`;
  }

  const stroke = (d: string, width: number, dash?: string) =>
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

  const layers = $derived.by(() => {
    const g = geometry;
    const grid = g.gridY
      .map(
        (y) =>
          `<line x1="${g.plot.left}" x2="${g.plot.right}" y1="${y}" y2="${y}" stroke="#000" stroke-width="1"/>`
      )
      .join('');
    const list: Array<{ key: string; color: string; source: string }> = [
      { key: 'grid', color: CHART_COLORS.grid, source: mask(g, grid) },
      {
        key: 'area',
        color: CHART_COLORS.area,
        source: mask(g, `<path d="${g.paths.balanceArea}" fill="#000"/>`)
      }
    ];
    if (g.paths.positiveLine) {
      list.push({
        key: 'positive',
        color: CHART_COLORS.positive,
        source: mask(g, stroke(g.paths.positiveLine, 1.5, VARIANCE_DASH))
      });
    }
    if (g.paths.negativeLine) {
      list.push({
        key: 'negative',
        color: CHART_COLORS.negative,
        source: mask(g, stroke(g.paths.negativeLine, 1.5, VARIANCE_DASH))
      });
    }
    list.push({
      key: 'balance',
      color: CHART_COLORS.balance,
      source: mask(g, stroke(g.paths.balanceLine, 2))
    });
    return list;
  });
</script>

{#each layers as layer (layer.key)}
  <svg
    class="layer"
    source={layer.source}
    style:width="{geometry.width}px"
    style:height="{geometry.height}px"
    style:color={layer.color}
  ></svg>
{/each}

<style>
  .layer {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
  }
</style>
