<script lang="ts">
  import { provideClientLoggingContext } from '$lib/client/logging';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { ModeWatcher } from 'mode-watcher';

  let { children, data } = $props();
  const clientLogging = provideClientLoggingContext();

  $effect(() => {
    if (!data?.requestId) return;
    clientLogging.mergeSharedContext({ request_id: data.requestId });
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />
{@render children()}
