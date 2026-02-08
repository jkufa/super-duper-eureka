<script lang="ts">
  import { NumberFlowGroup } from '@number-flow/svelte';
  import type { ProjectionByVariance, ProjectionRun } from '@retirement/calculator';
  import { Area, AreaChart, ChartClipPath } from 'layerchart';
  import { curveNatural } from 'd3-shape';
  import { onMount } from 'svelte';
  import { cubicInOut } from 'svelte/easing';

  import { formatCompactNumber, formatCurrency } from '$lib/formatters';
  import ProjectionKpiMetric from '$lib/components/projection/ProjectionKpiMetric.svelte';
  import * as Chart from '$lib/components/ui/chart';

  const chartConfig = {
    balance: {
      label: 'Portfolio Value',
      color: 'var(--color-chart-1)'
    },
    positive: {
      label: 'Variance Above',
      color: 'var(--color-chart-variance-above)'
    },
    negative: {
      label: 'Variance Below',
      color: 'var(--color-chart-variance-below)'
    }
  } satisfies Chart.ChartConfig;

  let {
    run,
    startYear,
    projectionByVariance,
    showVariance = false
  }: {
    run: ProjectionRun;
    startYear: number;
    projectionByVariance: ProjectionByVariance;
    showVariance?: boolean;
  } = $props();

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
    return run.projection.yearlyProjections.map((point, index) => {
      const positivePoint = projectionByVariance.positive.yearlyProjections[index];
      const negativePoint = projectionByVariance.negative.yearlyProjections[index];

      return {
        label: `${startYear + index}`,
        balance: point.balance,
        positive: showVariance ? positivePoint?.balance : undefined,
        negative: showVariance ? negativePoint?.balance : undefined
      };
    });
  });
  const chartSeries = $derived.by(() => {
    const baseSeries = [
      {
        key: 'balance',
        label: chartConfig.balance.label,
        color: chartConfig.balance.color
      }
    ];

    if (!showVariance) return baseSeries;

    return [
      {
        key: 'positive',
        label: chartConfig.positive.label,
        color: chartConfig.positive.color
      },
      ...baseSeries,
      {
        key: 'negative',
        label: chartConfig.negative.label,
        color: chartConfig.negative.color
      }
    ];
  });
  const areaChartProps = $derived.by(() => {
    return {
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
    } as const;
  });
  const metrics = $derived([
    { label: 'Final Portfolio Value', value: finalBalanceValue },
    { label: 'Total Contributed', value: totalContributionsValue },
    {
      label: 'Total Growth',
      value: totalGrowthValue,
      valueClass: "text-growth before:content-['+']"
    }
  ]);
</script>

<div class="space-y-4">
  <div>
    <h2 class="text-xl font-semibold tracking-tight">Projection Summary</h2>
  </div>

  <NumberFlowGroup>
    <dl class="flex flex-wrap gap-8">
      {#each metrics as metric (metric.label)}
        <ProjectionKpiMetric
          label={metric.label}
          value={metric.value}
          animated={isHydrated}
          valueClass={metric.valueClass ?? ''}
        />
      {/each}
    </dl>
  </NumberFlowGroup>

  <div class="translate-x-2">
    <Chart.Container config={chartConfig}>
      <AreaChart data={chartData} x="label" series={chartSeries} props={areaChartProps}>
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
              <Area
                {...getAreaProps(s, i)}
                fill={s.key === 'balance' ? 'url(#fillBalance)' : 'transparent'}
                line={s.key === 'balance'
                  ? { class: 'stroke-(--color-balance) [stroke-width:2.5]' }
                  : s.key === 'positive'
                    ? {
                        class: 'stroke-(--color-positive) [stroke-width:1.5] [stroke-dasharray:6_4]'
                      }
                    : {
                        class: 'stroke-(--color-negative) [stroke-width:1.5] [stroke-dasharray:6_4]'
                      }}
              />
            {/each}
          </ChartClipPath>
        {/snippet}

        {#snippet tooltip()}
          <Chart.Tooltip
            indicator="line"
            valueFormatter={(value: unknown) =>
              formatCurrency(typeof value === 'number' ? value : Number(value ?? 0))}
          />
        {/snippet}
      </AreaChart>
    </Chart.Container>
  </div>
</div>
