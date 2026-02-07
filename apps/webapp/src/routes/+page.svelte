<script lang="ts">
  import { Debugger } from '$lib/components/debug';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<h1>Better Retirement Calculator</h1>
<Debugger
  eventDetails={data.debug.eventDetails}
  configuration={data.debug.configuration}
  steps={data.debug.steps}
/>
