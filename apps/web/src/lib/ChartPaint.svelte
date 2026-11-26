<script lang="ts">
  import { CHART_COLORS, VARIANCE_DASH } from '@retirement/ui/chart-paint';
  import type { ChartPaintProps } from '@retirement/ui/chart-paint';

  // The web paint layer of the shared chart: one SVG, the same path data GPUI gets.
  let { geometry }: ChartPaintProps = $props();
</script>

<svg
  class="paint"
  width={geometry.width}
  height={geometry.height}
  viewBox="0 0 {geometry.width} {geometry.height}"
>
  {#each geometry.gridY as y, index (index)}
    <line
      x1={geometry.plot.left}
      x2={geometry.plot.right}
      y1={y}
      y2={y}
      stroke={CHART_COLORS.grid}
      stroke-width="1"
    />
  {/each}
  <path d={geometry.paths.balanceArea} fill={CHART_COLORS.area} />
  {#if geometry.paths.positiveLine}
    <path
      d={geometry.paths.positiveLine}
      fill="none"
      stroke={CHART_COLORS.positive}
      stroke-width="1.5"
      stroke-dasharray={VARIANCE_DASH}
    />
  {/if}
  {#if geometry.paths.negativeLine}
    <path
      d={geometry.paths.negativeLine}
      fill="none"
      stroke={CHART_COLORS.negative}
      stroke-width="1.5"
      stroke-dasharray={VARIANCE_DASH}
    />
  {/if}
  <path d={geometry.paths.balanceLine} fill="none" stroke={CHART_COLORS.balance} stroke-width="2" />
</svg>

<style>
  .paint {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
  }
</style>
