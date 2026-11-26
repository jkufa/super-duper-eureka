<script lang="ts">
  import App from '@retirement/ui/App.svelte';
  import { platform } from './platform.ts';

  // The web gets its scenario from a server load; the window builds its own.
  const scenario = {
    name: 'Desktop scenario',
    startingBalance: 250_000,
    source: 'the desktop boot'
  };
</script>

<App {platform} {scenario} />
