<script lang="ts">
  import Scroller from 'gpuix-svelte/components/Scroller.svelte';
  import { apply_theme } from 'gpuix-svelte-ui/theme';
  import type { Platform } from './platform';
  import BalanceSummary from './BalanceSummary.svelte';

  // The shared root: apps/web's page and apps/desktop's window both render this.
  let { platform }: { platform: Platform } = $props();

  // The kit's stock palette as `--ui-*` tokens, on both renderers.
  $effect(() => apply_theme());
</script>

<div class="app">
  <Scroller pad="24px">
    <BalanceSummary />
    <div>Running on {platform.name}</div>
  </Scroller>
</div>

<style>
  .app {
    display: flex;
    width: 100%;
    height: 100%;
    background-color: var(--ui-bg);
    color: var(--ui-ink);
  }
</style>
