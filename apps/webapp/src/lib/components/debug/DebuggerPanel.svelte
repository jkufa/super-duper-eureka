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
  import {
    clampPanelPosition,
    nextDragPosition,
    parseStoredPosition,
    type DragStart
  } from './panel-position';
  import type { DebugSectionId, PanelPosition } from './types';

  const PANEL_GUTTER = 8;

  let {
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
  let panelWidth = $state(0);
  let panelHeight = $state(0);

  let position = $state<PanelPosition>({ x: 16, y: 80 });
  let isDragging = $state(false);
  let dragStart = $state<DragStart | null>(null);
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

    const width = panelWidth || panelEl.offsetWidth;
    const height = panelHeight || panelEl.offsetHeight;
    return clampPanelPosition(
      next,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
      PANEL_GUTTER
    );
  }

  function persistPosition(next: PanelPosition) {
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function reconcilePosition(persist = false) {
    const next = clampPosition(position);
    if (next.x === position.x && next.y === position.y) return;

    position = next;
    if (persist) persistPosition(next);
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

    position = clampPosition(nextDragPosition(dragStart, { x: event.clientX, y: event.clientY }));
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
    if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowLeft' && stepCount > 0) {
      event.preventDefault();
      onStepChange?.(0);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowRight' && stepCount > 0) {
      event.preventDefault();
      onStepChange?.(stepCount - 1);
      return;
    }

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
    position = parseStoredPosition(localStorage.getItem(storageKey), initialPosition);

    requestAnimationFrame(() => {
      reconcilePosition();
    });
  });

  $effect(() => {
    panelWidth;
    panelHeight;
    if (!panelEl || isDragging) return;

    requestAnimationFrame(() => {
      if (!isDragging) reconcilePosition();
    });
  });
</script>

<svelte:window
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onresize={handleResize}
/>

<div
  bind:this={panelEl}
  bind:clientWidth={panelWidth}
  bind:clientHeight={panelHeight}
  role="dialog"
  aria-label="Debugger"
  class="fixed top-0 left-0 z-50 focus-visible:outline-none"
  style={`transform: translate3d(${position.x}px, ${position.y}px, 0); transition: ${isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'};`}
  tabindex={-1}
  onkeydown={handlePanelKeydown}
  in:fly={{ y: 14, duration: 180, opacity: 0.25 }}
  out:fade={{ duration: 120 }}
>
  <Card.Root class="max-h-(--debugger-panel-max-height) w-(--debugger-panel-width) shadow-lg">
    <Card.Header
      class="flex flex-row items-center justify-between gap-2 border-b border-border p-2 select-none"
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

    <Card.Content class="min-h-0 flex-1 overflow-auto px-4 py-0">
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
