<script lang="ts">
  import Scroller from 'gpuix-svelte/components/Scroller.svelte';
  import { apply_theme } from 'gpuix-svelte-ui/theme';
  import { test_id } from 'gpuix-svelte-ui/shared';
  import type { Platform, Scenario } from './platform';
  import BalanceSummary from './BalanceSummary.svelte';
  import NumberField from './NumberField.svelte';
  import PlumbingCard from './PlumbingCard.svelte';
  import ProjectionChart from './ProjectionChart.svelte';
  import ScenarioCard from './ScenarioCard.svelte';
  import { projectionPoints } from './projection-points';

  // The shared root: apps/web's page and apps/desktop's window both render this.
  let { platform, scenario }: { platform: Platform; scenario: Scenario } = $props();

  // The kit's stock palette as `--ui-*` tokens, on both renderers. The web page also carries them
  // in its server HTML, through `theme_rule` in the layout's <svelte:head>.
  $effect(() => apply_theme());

  // Spike Q3: the committed return, which only the numeric field's commits change.
  let rate = $state(5);
  let commits = $state(0);
  const points = $derived(projectionPoints(scenario.startingBalance, rate));

  const trace = (event: string, detail?: unknown) => platform.trace?.(event, detail);
</script>

<div class="app">
  <div class="side">
    <Scroller pad="24px" gap={16}>
      <BalanceSummary />
      <div>Running on {platform.name}</div>
      <ScenarioCard {scenario} />
      <NumberField
        label="Annual return (%)"
        testid="rate"
        value={rate}
        fallback={5}
        step={0.5}
        oncommit={(value) => {
          rate = value;
          commits += 1;
        }}
        {trace}
      />
      <div {...test_id('rate-committed')}>Committed: {rate}% ({commits} commits)</div>
      {#if platform.clipboard && platform.store}
        <PlumbingCard
          clipboard={platform.clipboard}
          store={platform.store}
          copyText="Projected at {rate}%: {points.at(-1)?.balance.toFixed(0)}"
        />
      {/if}
    </Scroller>
  </div>
  <div class="main">
    <ProjectionChart {points} Paint={platform.ChartPaint} {trace} />
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    background-color: var(--ui-bg);
    color: var(--ui-ink);
  }
  .side {
    display: flex;
    width: 380px;
    height: 100%;
    flex-shrink: 0;
  }
  .main {
    display: flex;
    flex-grow: 1;
    flex-basis: 0;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
  }
</style>
