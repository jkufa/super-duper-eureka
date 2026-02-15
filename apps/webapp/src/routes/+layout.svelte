<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { ModeWatcher } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { setDebuggerEnabledInStorage } from '$lib/client/debugger-flag';
  import type { LayoutProps } from './$types';

  let { children, data }: LayoutProps = $props();

  onMount(() => {
    if (!data.debugEnabled) return;
    setDebuggerEnabledInStorage(localStorage, true);
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />
{@render children()}
