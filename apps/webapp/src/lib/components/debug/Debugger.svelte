<script lang="ts">
  import { Bug } from '@lucide/svelte';
  import * as Button from '$lib/components/ui/button';

  import DebuggerPanel from './DebuggerPanel.svelte';

  let {
    eventDetails,
    configuration,
    steps
  }: {
    eventDetails: unknown;
    configuration: unknown;
    steps: unknown[];
  } = $props();

  let open = $state(true);
  let stepIndex = $state(0);

  const stepCount = $derived(steps.length);
  const activeStep = $derived(steps[stepIndex] ?? null);

  function setStep(nextIndex: number) {
    const max = Math.max(0, steps.length - 1);
    stepIndex = Math.min(Math.max(0, nextIndex), max);
  }
</script>

<div class="fixed start-4 bottom-4 z-40">
  {#if !open}
    <Button.Root onclick={() => (open = true)}>
      <Bug class="size-4" />
      Open debugger
    </Button.Root>
  {/if}
</div>

{#if open}
  <DebuggerPanel
    {stepIndex}
    {stepCount}
    {eventDetails}
    {configuration}
    stepPayload={activeStep}
    onClose={() => (open = false)}
    onStepChange={setStep}
  />
{/if}
