<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Drawer from '$lib/components/ui/drawer';
  import { Debugger } from '$lib/components/debug';
  import { ProjectionChart, ProjectionTable } from '$lib/components/projection';
  import RootForm from '$lib/components/RootForm.svelte';
  import Nav from '$lib/components/Nav.svelte';
  import { initRetirementConfigContext } from '$lib/client/config/config-context.svelte';
  import { createRetirementConfigStore } from '$lib/client/config/config-store.svelte';
  import {
    toRetirementConfigFormDefaults,
    retirementConfigFormSchema,
    type RetirementConfigFormValues
  } from '$lib/forms/retirement-config-form';
  import { calculateProjectionWithSteps, calculateRetirement } from '@retirement/calculator';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { superForm } from 'sveltekit-superforms/client';
  import type { PageData } from './$types';
  import { cn } from '$lib/utils';

  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally
  const configForm = superForm(data.configForm, {
    validators: zod4Client(retirementConfigFormSchema),
    dataType: 'json'
  });
  const formData = configForm.form;
  let committedValues = $state<RetirementConfigFormValues>(structuredClone($formData));
  // svelte-ignore state_referenced_locally
  let activeBaseConfig = $state(data.config);
  let hasStorageHydrationCompleted = $state(false);

  function commitFormValues() {
    committedValues = structuredClone($formData);
  }

  const configContext = initRetirementConfigContext();

  $effect(() => {
    if (hasStorageHydrationCompleted) return;

    const storedConfig = configContext.getStoredConfig();
    if (!storedConfig) {
      hasStorageHydrationCompleted = true;
      return;
    }

    activeBaseConfig = storedConfig;
    const storedValues = toRetirementConfigFormDefaults(storedConfig);
    $formData = structuredClone(storedValues);
    committedValues = structuredClone(storedValues);
    hasStorageHydrationCompleted = true;
  });

  const liveConfig = $derived(
    createRetirementConfigStore({
      baseConfig: activeBaseConfig,
      committedValues,
      context: configContext,
      persist: hasStorageHydrationCompleted
    })
  );

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
    if (!liveConfig.startDate) return new Date().getFullYear();
    const parsed = new Date(liveConfig.startDate);
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
      class="min-h-0 space-y-16 overflow-y-auto pt-24 pb-10 table-fit:ps-8 table-fit:pe-(--main-cols-inner-padding)"
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
        <ProjectionTable {run} startYear={projectionStartYear} />
      </div>
    </section>

    <aside
      class="hidden min-h-0 overflow-y-auto pt-24 pb-10 table-fit:block table-fit:ps-(--main-cols-inner-padding) table-fit:pe-8"
    >
      <header class="mb-4 space-y-1">
        <h2 class="text-2xl font-semibold">Retirement Configuration</h2>
        <p class="text-sm text-muted-foreground">
          Adjust parameters for your retirement calculation
        </p>
      </header>
      <RootForm form={configForm} enhance={configForm.enhance} onCommit={commitFormValues} />
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

        <div class={cn('h-full overflow-y-auto px-5 pt-4 pb-(--safe-bottom-pad-lg)')}>
          <RootForm form={configForm} enhance={configForm.enhance} onCommit={commitFormValues} />
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
