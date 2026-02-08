<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Debugger } from '$lib/components/debug';
  import { ProjectionChart, ProjectionTable } from '$lib/components/projection';
  import RootForm from '$lib/components/RootForm.svelte';
  import Nav from '$lib/components/Nav.svelte';
  import {
    applyRetirementConfigFormValues,
    retirementConfigFormSchema,
    type RetirementConfigFormValues
  } from '$lib/forms/retirement-config-form';
  import { calculateProjectionWithSteps, calculateRetirement } from '@retirement/calculator';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { superForm } from 'sveltekit-superforms/client';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const configForm = superForm(data.configForm, {
    validators: zod4Client(retirementConfigFormSchema),
    dataType: 'json'
  });
  const formData = configForm.form;
  let committedValues = $state<RetirementConfigFormValues>(structuredClone($formData));

  function commitFormValues() {
    committedValues = structuredClone($formData);
  }

  const liveConfig = $derived(applyRetirementConfigFormValues(data.config, committedValues));

  const run = $derived(
    calculateProjectionWithSteps(liveConfig, liveConfig.interest.annualRate, {
      includeContributionDetails: true
    })
  );
  const projectionByVariance = $derived(calculateRetirement(liveConfig));
  const showVariance = $derived(
    typeof liveConfig.interest.variance === 'number' && liveConfig.interest.variance !== 0
  );

  const projectionStartYear = $derived.by(() => {
    if (!data.config.startDate) return new Date().getFullYear();
    const parsed = new Date(data.config.startDate);
    return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getUTCFullYear();
  });
</script>

<div class="flex flex-col table-fit:h-dvh">
  <Nav />

  <main class="mb-4 grid min-h-0 flex-1 table-fit:grid-cols-(--grid-cols-main)">
    <section
      class="min-h-0 space-y-16 overflow-y-auto ps-8 pe-(--main-cols-inner-padding) pt-6 pb-10"
    >
      <Card.Root class="ms-auto max-w-5xl">
        <Card.Content class="p-6">
          <ProjectionChart
            {run}
            startYear={projectionStartYear}
            {projectionByVariance}
            {showVariance}
          />
        </Card.Content>
      </Card.Root>

      <div class="ms-auto max-w-5xl px-2">
        <ProjectionTable {run} />
      </div>
    </section>

    <aside class="min-h-0 overflow-y-auto ps-(--main-cols-inner-padding) pe-8 pt-6 pb-10">
      <RootForm
        form={configForm}
        enhance={configForm.enhance}
        contributions={data.config.contributions}
        onCommit={commitFormValues}
      />
    </aside>
  </main>
</div>

<Debugger
  config={{ ...liveConfig, mockSeed: data.mock?.seed ?? undefined }}
  {run}
  requestId={data.requestId}
  logContext={data.logContext}
/>
