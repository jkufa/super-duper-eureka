<script lang="ts">
  import App from '@retirement/ui/App.svelte';
  import { platform } from '#lib/platform.ts';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<App {platform} scenario={data.scenario} />

<!-- Spike Q2: the streamed promise, web only. -->
<div class="streamed" data-testid="streamed">
  {#await data.streamed}
    Streaming…
  {:then value}
    {value.label} {value.when.toISOString()}
  {/await}
</div>

<style>
  .streamed {
    position: fixed;
    right: 12px;
    bottom: 8px;
    font-size: 12px;
    color: var(--ui-muted);
  }
</style>
