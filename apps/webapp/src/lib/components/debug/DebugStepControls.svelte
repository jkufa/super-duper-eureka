<script lang="ts">
  import * as Button from '$lib/components/ui/button';
  import * as Input from '$lib/components/ui/input';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Kbd from '$lib/components/ui/kbd';
  import { ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from '@lucide/svelte';

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

  let stepInput = $state('1');

  const hasSteps = $derived(stepCount > 0);
  const canStepBack = $derived(hasSteps && stepIndex > 0);
  const canStepForward = $derived(hasSteps && stepIndex < stepCount - 1);

  $effect(() => {
    stepInput = String(stepIndex + 1);
  });

  function goTo(nextIndex: number) {
    if (!hasSteps) return;

    const clamped = Math.min(Math.max(0, nextIndex), stepCount - 1);
    if (clamped === stepIndex) return;
    onStepChange?.(clamped);
  }

  function commitStepInput() {
    if (!hasSteps) {
      stepInput = '1';
      return;
    }

    const parsed = Number.parseInt(stepInput, 10);
    if (!Number.isFinite(parsed)) {
      stepInput = String(stepIndex + 1);
      return;
    }

    const clampedOneBased = Math.min(Math.max(1, parsed), stepCount);
    stepInput = String(clampedOneBased);
    goTo(clampedOneBased - 1);
  }

  function handleStepInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitStepInput();
      return;
    }

    if (event.key === 'Escape') {
      stepInput = String(stepIndex + 1);
      (event.currentTarget as HTMLInputElement | null)?.blur();
    }
  }
</script>

<Tooltip.Provider>
  <div class="flex w-full items-center gap-2">
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button.Root
            {...props}
            variant="secondary"
            class="h-9 flex-1"
            disabled={!canStepBack}
            onclick={() => goTo(0)}
            aria-label="Jump to first step"
          >
            <ChevronsLeft class="size-4" />
          </Button.Root>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={8}>
        <div class="flex items-center gap-2">
          Jump to first step
          <Kbd.Group>
            <Kbd.Root>⌘</Kbd.Root>
            +
            <Kbd.Root>&larr;</Kbd.Root>
          </Kbd.Group>
        </div>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button.Root
            {...props}
            variant="secondary"
            class="h-9 flex-1"
            disabled={!canStepBack}
            onclick={() => goTo(stepIndex - 1)}
            aria-label="Step backward"
          >
            <ChevronLeft class="size-4" />
          </Button.Root>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={8}>
        <div class="flex items-center gap-2">
          Step backward
          <Kbd.Root>&larr;</Kbd.Root>
        </div>
      </Tooltip.Content>
    </Tooltip.Root>

    <label class="sr-only" for="debug-step-input">Jump to step</label>
    <Input.Root
      id="debug-step-input"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      class="h-9 flex-6 px-2 text-center"
      bind:value={stepInput}
      onkeydown={handleStepInputKeydown}
      onblur={commitStepInput}
      aria-label="Enter step number"
    />

    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button.Root
            {...props}
            class="h-9 flex-1"
            variant="secondary"
            disabled={!canStepForward}
            onclick={() => goTo(stepIndex + 1)}
            aria-label="Step forward"
          >
            <ChevronRight class="size-4" />
          </Button.Root>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={8}>
        <div class="flex items-center gap-2">
          Step forward
          <Kbd.Root>&rarr;</Kbd.Root>
        </div>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button.Root
            {...props}
            class="h-9 flex-1"
            variant="secondary"
            disabled={!canStepForward}
            onclick={() => goTo(stepCount - 1)}
            aria-label="Jump to last step"
          >
            <ChevronsRight class="size-4" />
          </Button.Root>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={8}>
        <div class="flex items-center gap-2">
          Jump to last step
          <Kbd.Group>
            <Kbd.Root>⌘</Kbd.Root>
            +
            <Kbd.Root>&rarr;</Kbd.Root>
          </Kbd.Group>
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  </div>
</Tooltip.Provider>
