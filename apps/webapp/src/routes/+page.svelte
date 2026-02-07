<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Debugger } from '$lib/components/debug';
  import { ProjectionChart, ProjectionTable } from '$lib/components/projection';
  import RootForm from '$lib/components/RootForm.svelte';
  import Nav from '$lib/components/Nav.svelte';
  import { retirementConfigFormSchema } from '$lib/forms/retirement-config-form';
  import { calculateProjectionWithSteps } from '@retirement/calculator';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { superForm } from 'sveltekit-superforms/client';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const configForm = superForm(data.configForm, {
    validators: zod4Client(retirementConfigFormSchema)
  });

  const run = $derived(
    calculateProjectionWithSteps(data.config, data.config.interest.annualRate, {
      includeContributionDetails: true
    })
  );

  const projectionStartYear = $derived.by(() => {
    if (!data.config.startDate) return new Date().getFullYear();
    const parsed = new Date(data.config.startDate);
    return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getUTCFullYear();
  });
</script>

<Nav />
<main class="m-4 mx-auto grid max-w-7xl grid-cols-(--grid-cols-main) gap-8">
  <div class="space-y-16">
    <Card.Root>
      <Card.Content class="p-6">
        <ProjectionChart {run} startYear={projectionStartYear} />
      </Card.Content>
    </Card.Root>

    <div class="px-2">
      <ProjectionTable {run} />
    </div>
  </div>
  <aside class="w-full max-w-88">
    <RootForm form={configForm} />
  </aside>
</main>

<Debugger
  config={{ ...data.config, mockSeed: data.mock?.seed ?? undefined }}
  {run}
  requestId={data.requestId}
  logContext={data.logContext}
/>
