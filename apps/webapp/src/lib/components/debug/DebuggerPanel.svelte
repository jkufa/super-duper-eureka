<script lang="ts">
  import { GripVertical, X } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  import * as Accordion from '$lib/components/ui/accordion';
  import * as Button from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { cn } from '$lib/utils';

  import DebugCopyButton from './DebugCopyButton.svelte';
  import DebugJsonBlock from './DebugJsonBlock.svelte';
  import DebugStepControls from './DebugStepControls.svelte';
  import type { DebugSectionId, PanelPosition } from './types';

  const PANEL_GUTTER = 8;

  let {
    open = true,
    stepIndex = 0,
    stepCount = 0,
    eventDetails,
    configuration,
    stepPayload,
    initialPosition = { x: 16, y: 80 },
    storageKey = 'debugger-panel:position',
    onClose,
    onStepChange
  }: {
    open?: boolean;
    stepIndex?: number;
    stepCount?: number;
    eventDetails: unknown;
    configuration: unknown;
    stepPayload: unknown;
    initialPosition?: PanelPosition;
    storageKey?: string;
    onClose?: () => void;
    // eslint-disable-next-line no-unused-vars
    onStepChange?: (nextIndex: number) => void;
  } = $props();

  let panelEl = $state<HTMLDivElement | null>(null);
  let dragHandleEl = $state<HTMLElement | null>(null);

  let position = $state<PanelPosition>({ x: 16, y: 80 });
  let isDragging = $state(false);
  let dragStart = $state<{ pointer: PanelPosition; position: PanelPosition } | null>(null);
  let openItems = $state<DebugSectionId[]>(['step']);

  const stepLabel = $derived(`Step: ${stepIndex + 1}/${stepCount}`);
  const fullPayload = $derived({
    event_details: eventDetails,
    configuration,
    step: {
      index: stepIndex,
      total: stepCount,
      payload: stepPayload
    }
  });

  function clampPosition(next: PanelPosition): PanelPosition {
    if (!panelEl) return next;

    const width = panelEl.offsetWidth;
    const height = panelEl.offsetHeight;
    const minX = PANEL_GUTTER;
    const minY = PANEL_GUTTER;
    const maxX = Math.max(minX, window.innerWidth - width - PANEL_GUTTER);
    const maxY = Math.max(minY, window.innerHeight - height - PANEL_GUTTER);

    return {
      x: Math.min(Math.max(minX, next.x), maxX),
      y: Math.min(Math.max(minY, next.y), maxY)
    };
  }

  function persistPosition(next: PanelPosition) {
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function reconcilePosition(persist = false) {
    const next = clampPosition(position);
    if (next.x === position.x && next.y === position.y) return;

    position = next;
    if (persist) {
      persistPosition(next);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (!panelEl || event.button !== 0) return;

    dragHandleEl?.setPointerCapture(event.pointerId);
    dragStart = {
      pointer: { x: event.clientX, y: event.clientY },
      position: { ...position }
    };
    isDragging = true;
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging || !dragStart) return;

    const next = clampPosition({
      x: dragStart.position.x + (event.clientX - dragStart.pointer.x),
      y: dragStart.position.y + (event.clientY - dragStart.pointer.y)
    });

    position = next;
  }

  function handlePointerUp(event: PointerEvent) {
    if (!isDragging) return;

    dragHandleEl?.releasePointerCapture(event.pointerId);
    dragStart = null;
    isDragging = false;
    reconcilePosition(true);
  }

  function handleResize() {
    reconcilePosition();
  }

  function handlePanelKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft' && stepIndex > 0) {
      event.preventDefault();
      onStepChange?.(stepIndex - 1);
      return;
    }

    if (event.key === 'ArrowRight' && stepIndex < stepCount - 1) {
      event.preventDefault();
      onStepChange?.(stepIndex + 1);
    }
  }

  onMount(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PanelPosition;
        position = parsed;
      } catch {
        position = initialPosition;
      }
    } else {
      position = initialPosition;
    }

    requestAnimationFrame(() => {
      reconcilePosition();
    });
  });

  $effect(() => {
    if (!panelEl) return;

    requestAnimationFrame(() => {
      if (!isDragging) {
        reconcilePosition();
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (isDragging) return;
      reconcilePosition();
    });
    resizeObserver.observe(panelEl);

    return () => {
      resizeObserver.disconnect();
    };
  });
</script>

<svelte:window
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onresize={handleResize}
/>

{#if open}
  <div
    bind:this={panelEl}
    role="dialog"
    aria-label="Debugger"
    class="fixed top-0 left-0 z-50"
    style={`transform: translate3d(${position.x}px, ${position.y}px, 0); transition: ${isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'};`}
    tabindex={-1}
    onkeydown={handlePanelKeydown}
    in:fly={{ y: 14, duration: 180, opacity: 0.25 }}
    out:fade={{ duration: 120 }}
  >
    <Card.Root class="max-h-(--debugger-panel-max-height) w-(--debugger-panel-width) shadow-lg ">
      <Card.Header
        class="flex flex-row items-center justify-between gap-2 border-b border-border py-2"
      >
        <button
          bind:this={dragHandleEl}
          type="button"
          class={cn(
            'flex flex-1 items-center gap-2 text-start transition-all hover:cursor-grab focus-visible:ring-2 focus-visible:ring-ring',
            isDragging && 'cursor-grabbing'
          )}
          aria-label="Drag debugger panel"
          title="Drag to move"
          onpointerdown={handlePointerDown}
        >
          <GripVertical class="size-4 text-muted-foreground" />
          <Card.Title class="text-base">Debugger</Card.Title>
        </button>

        <div class="flex items-center gap-1">
          <DebugCopyButton
            value={fullPayload}
            label="Copy all"
            copiedLabel="Copied"
            variant="ghost"
            size="sm"
            class="h-8 px-2 text-xs text-muted-foreground"
          />
          <Button.Root
            variant="ghost"
            size="icon"
            class="size-9 text-muted-foreground"
            onclick={onClose}
            aria-label="Close debugger"
          >
            <X class="size-4" />
          </Button.Root>
        </div>
      </Card.Header>

      <Card.Content class="min-h-0 flex-1 overflow-auto px-4 pt-0">
        <Accordion.Root type="multiple" bind:value={openItems}>
          <Accordion.Item value="event-details">
            <Accordion.Trigger class="py-3 text-sm font-medium">Event details</Accordion.Trigger>
            <Accordion.Content class="pt-0 pb-4">
              <DebugJsonBlock label="Event details" data={eventDetails} />
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="configuration">
            <Accordion.Trigger class="py-3 text-sm font-medium">Configuration</Accordion.Trigger>
            <Accordion.Content class="pt-0 pb-4">
              <DebugJsonBlock label="Configuration" data={configuration} />
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="step">
            <Accordion.Trigger class="py-3 text-sm font-medium">{stepLabel}</Accordion.Trigger>
            <Accordion.Content class="pt-0 pb-2">
              <DebugJsonBlock label={stepLabel} data={stepPayload} />
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </Card.Content>
      <Card.Footer class="flex justify-end gap-4 border-t border-border py-4">
        <DebugStepControls {stepIndex} {stepCount} {onStepChange} />
      </Card.Footer>
    </Card.Root>
  </div>
{/if}
