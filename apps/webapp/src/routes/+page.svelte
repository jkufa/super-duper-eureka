<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Drawer from '$lib/components/ui/drawer';
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
  import { cn } from '$lib/utils';

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

  const TABLE_FIT_BREAKPOINT = 79 * 16;
  let innerWidth = $state(0);
  const FORM_SNAPS = {
    BOTTOM: 0.28,
    TOP: 1
  } as const;
  const formDrawerSnapPoints = [FORM_SNAPS.BOTTOM, FORM_SNAPS.TOP];
  let activeFormDrawerSnapPoint = $state<number>(FORM_SNAPS.BOTTOM);
</script>

<svelte:window bind:innerWidth />

<div class="flex flex-col table-fit:h-dvh">
  <Nav />

  <main class="mx-4 mb-4 grid min-h-0 flex-1 table-fit:mx-0 table-fit:grid-cols-(--grid-cols-main)">
    <section
      class="min-h-0 space-y-16 overflow-y-auto pt-32 pb-10 table-fit:ps-8 table-fit:pe-(--main-cols-inner-padding)"
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

    <aside
      class="hidden min-h-0 overflow-y-auto pt-32 pb-10 table-fit:block table-fit:ps-(--main-cols-inner-padding) table-fit:pe-8"
    >
      <header class="mb-4 space-y-1">
        <h2 class="text-2xl font-semibold">Retirement Configuration</h2>
        <p class="text-sm text-muted-foreground">
          Adjust parameters for your retirement calculation
        </p>
      </header>
      <RootForm
        form={configForm}
        enhance={configForm.enhance}
        contributions={data.config.contributions}
        onCommit={commitFormValues}
      />
    </aside>
  </main>

  {#if innerWidth < TABLE_FIT_BREAKPOINT}
    <Drawer.Root
      direction="bottom"
      open={true}
      snapPoints={formDrawerSnapPoints}
      bind:activeSnapPoint={activeFormDrawerSnapPoint}
      modal={false}
      dismissible={false}
      shouldScaleBackground
    >
      <Drawer.Content class="min-h-[90dvh]">
        <Drawer.Header class="select-none">
          <Drawer.Title>Retirement configuration</Drawer.Title>
          <Drawer.Description
            >Swipe up to adjust parameters for your retirement calculation</Drawer.Description
          >
        </Drawer.Header>

        <div
          class={cn(
            'h-full px-5 pt-4 pb-(--safe-bottom-pad-lg)',
            activeFormDrawerSnapPoint === 1 ? 'overflow-y-auto' : 'overflow-hidden'
          )}
        >
          <RootForm
            form={configForm}
            enhance={configForm.enhance}
            contributions={data.config.contributions}
            onCommit={commitFormValues}
          />
        </div>

        <Drawer.Footer class="border-t p-4 pb-(--safe-bottom-pad-sm)" />
      </Drawer.Content>
    </Drawer.Root>
  {/if}
  <!-- <div class="dynamic-viewport-fix fixed bottom-0 h-8 w-full bg-background"></div> -->
</div>

<Debugger
  config={{ ...liveConfig, mockSeed: data.mock?.seed ?? undefined }}
  {run}
  requestId={data.requestId}
  logContext={data.logContext}
/>
