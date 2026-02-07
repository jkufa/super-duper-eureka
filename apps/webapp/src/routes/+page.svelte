<script lang="ts">
  import { Debugger } from '$lib/components/debug';
  import { calculateProjectionWithSteps } from '@retirement/calculator';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const run = $derived(
    calculateProjectionWithSteps(data.config, data.config.interest.annualRate, {
      includeContributionDetails: true
    })
  );
</script>

<h1>Better Retirement Calculator</h1>
<Debugger
  config={{ ...data.config, mockSeed: data.mock?.seed ?? undefined }}
  {run}
  requestId={data.requestId}
  logContext={data.logContext}
/>
