<script lang="ts">
  import { MoveLeft, MoveRight } from '@lucide/svelte';
  import * as Button from '$lib/components/ui/button';
  import * as Kbd from '$lib/components/ui/kbd';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    stepIndex,
    stepCount,
    onStepChange
  }: {
    stepIndex: number;
    stepCount: number;
    // eslint-disable-next-line no-unused-vars
    onStepChange?: (nextIndex: number) => void;
  } = $props();

  const canStepBack = $derived(stepIndex > 0);
  const canStepForward = $derived(stepIndex < stepCount - 1);

  function step(delta: number) {
    const nextIndex = Math.min(Math.max(0, stepIndex + delta), stepCount - 1);
    if (nextIndex === stepIndex) return;
    onStepChange?.(nextIndex);
  }
</script>

<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button.Root
          {...props}
          variant="secondary"
          class="min-h-10 flex-1"
          disabled={!canStepBack}
          onclick={() => step(-1)}
        >
          <MoveLeft class="size-4" />
          Step backward
        </Button.Root>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content sideOffset={8}>
      <span class="inline-flex items-center gap-2">
        <Kbd.Root>&larr;</Kbd.Root>
        Step backward
      </span>
    </Tooltip.Content>
  </Tooltip.Root>

  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button.Root
          {...props}
          class="min-h-10 flex-1"
          disabled={!canStepForward}
          onclick={() => step(1)}
        >
          Step forward
          <MoveRight class="size-4" />
        </Button.Root>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content sideOffset={8}>
      <span class="inline-flex items-center gap-2">
        Step forward
        <Kbd.Root>&rarr;</Kbd.Root>
      </span>
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
