<script lang="ts">
  import NumberFlow, { NumberFlowGroup } from '@number-flow/svelte';
  import type { ProjectionRun } from '@retirement/calculator';
  import { Area, AreaChart, ChartClipPath } from 'layerchart';
  import { curveNatural } from 'd3-shape';
  import { onMount } from 'svelte';
  import { cubicInOut } from 'svelte/easing';

  import { formatCompactNumber, formatCurrency } from '$lib/formatters';
  import * as Chart from '$lib/components/ui/chart';

  const chartConfig = {
    balance: {
      label: 'Portfolio Value',
      color: 'var(--color-chart-1)'
    }
  } satisfies Chart.ChartConfig;

  let { run, startYear }: { run: ProjectionRun; startYear: number } = $props();

  const summary = $derived(run.projection);
  let isHydrated = $state(false);
  let finalBalanceValue = $state(0);
  let totalContributionsValue = $state(0);
  let totalGrowthValue = $state(0);

  onMount(() => {
    requestAnimationFrame(() => {
      isHydrated = true;
    });
  });

  $effect(() => {
    if (!isHydrated) return;
    finalBalanceValue = summary.finalBalance;
    totalContributionsValue = summary.totalContributions;
    totalGrowthValue = summary.totalGrowth;
  });

  const chartData = $derived.by(() => {
    return run.projection.yearlyProjections.map((point, index) => ({
      label: `${startYear + index}`,
      balance: point.balance
    }));
  });
</script>

<div class="space-y-4">
  <div>
    <h2 class="text-xl font-semibold tracking-tight">Projection Summary</h2>
  </div>

  <NumberFlowGroup>
    <dl class="flex flex-wrap justify-between gap-4">
      <div class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground">Final Portfolio Value</dt>
        <dd>
          <NumberFlow
            willChange
            value={finalBalanceValue}
            animated={isHydrated}
            respectMotionPreference={false}
            locales="en-US"
            format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
            class="text-2xl font-semibold tabular-nums"
          />
        </dd>
      </div>

      <div class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground">Total Contributed</dt>
        <dd>
          <NumberFlow
            willChange
            value={totalContributionsValue}
            animated={isHydrated}
            locales="en-US"
            format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
            class="text-2xl font-semibold tabular-nums"
          />
        </dd>
      </div>

      <div class="space-y-1 pt-4">
        <dt class="text-xs font-medium text-muted-foreground">Total Growth</dt>
        <dd>
          <NumberFlow
            willChange
            value={totalGrowthValue}
            animated={isHydrated}
            locales="en-US"
            format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
            class="text-2xl font-semibold text-growth tabular-nums"
          />
        </dd>
      </div>
    </dl>
  </NumberFlowGroup>

  <div class="translate-x-2">
    <Chart.Container config={chartConfig}>
      <AreaChart
        data={chartData}
        x="label"
        series={[
          {
            key: 'balance',
            label: 'Portfolio Value',
            color: chartConfig.balance.color
          }
        ]}
        props={{
          area: {
            curve: curveNatural,
            line: {
              class: 'stroke-(--color-balance) [stroke-width:2.5]'
            },
            'fill-opacity': 0.35,
            motion: 'tween'
          },
          xAxis: {
            ticks: 5
          },
          yAxis: {
            format: (value: number) => formatCompactNumber(value)
          }
        }}
      >
        {#snippet marks({ series, getAreaProps })}
          <defs>
            <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stop-color="var(--color-balance)" stop-opacity={0.8} />
              <stop offset="95%" stop-color="var(--color-balance)" stop-opacity={0.08} />
            </linearGradient>
          </defs>
          <ChartClipPath
            initialWidth={0}
            motion={{
              width: { type: 'tween', duration: 900, easing: cubicInOut }
            }}
          >
            {#each series as s, i (s.key)}
              <Area {...getAreaProps(s, i)} fill="url(#fillBalance)" />
            {/each}
          </ChartClipPath>
        {/snippet}

        {#snippet tooltip()}
          <Chart.Tooltip
            indicator="line"
            valueFormatter={(value: number) => formatCurrency(value)}
          />
        {/snippet}
      </AreaChart>
    </Chart.Container>
  </div>
</div>
