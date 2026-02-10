<script lang="ts">
  import Pencil from '@lucide/svelte/icons/pencil';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Button from '$lib/components/ui/button';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type NumericFieldKind = 'number' | 'int';
  type NumericFieldName =
    | 'currentBalance'
    | 'yearsToRetirement'
    | 'annualReturnPct'
    | 'variancePct'
    | 'baseSalary'
    | 'annualRaisePct'
    | `contributionVariables[${number}].amount`
    | `customVariables[${number}].amount`
    | `customVariables[${number}].growthAmount`
    | 'customVariableDraft.amount'
    | 'customVariableDraft.timingDay'
    | 'customVariableDraft.timingMonth'
    | 'customVariableDraft.timingYear'
    | 'customVariableDraft.yearStart'
    | 'customVariableDraft.yearEnd'
    | 'customVariableDraft.growthAmount';

  let {
    form,
    name,
    label,
    kind = 'number',
    prefix,
    suffix,
    id,
    inputmode = 'decimal',
    emptyFallback = '0',
    onCommit,
    labelActionText,
    onLabelAction
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    name: NumericFieldName;
    label: string;
    kind?: NumericFieldKind;
    prefix?: string;
    suffix?: string;
    id?: string;
    inputmode?: 'decimal' | 'numeric';
    emptyFallback?: string;
    onCommit?: () => void;
    labelActionText?: string;
    onLabelAction?: () => void;
  } = $props();

  const valueStore = fieldProxy(form, name);
  let displayValue = $state('');
  let isFocused = $state(false);
  let pendingStepSource = $state<'wheel' | 'keyboard' | 'spinner' | null>(null);

  const inputPaddingClass = $derived(prefix ? 'pl-7' : suffix ? 'pr-7' : '');

  $effect(() => {
    if (isFocused) return;

    if (Number.isFinite($valueStore)) {
      displayValue = `${$valueStore}`;
      return;
    }

    displayValue = '';
  });

  function parseDisplayValue(raw: string) {
    const parsed = kind === 'int' ? Number.parseInt(raw, 10) : Number.parseFloat(raw);

    if (!Number.isFinite(parsed)) {
      const fallback = Number.parseFloat(emptyFallback);
      return Number.isFinite(fallback) ? fallback : 0;
    }

    return kind === 'int' ? Math.trunc(parsed) : parsed;
  }

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    displayValue = target.value;

    if (pendingStepSource) {
      const nextValue = parseDisplayValue(target.value);
      const didChange = nextValue !== $valueStore;
      $valueStore = nextValue;
      displayValue = `${nextValue}`;
      if (didChange) {
        onCommit?.();
      }
    }

    pendingStepSource = null;
  }

  function handleKeyDown(event: KeyboardEvent) {
    pendingStepSource = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'keyboard' : null;
  }

  function handleWheel() {
    pendingStepSource = 'wheel';
  }

  function handlePointerDown() {
    // Native spinner clicks are not exposed as a dedicated event,
    // so we treat pointer interactions on number inputs as a potential step intent.
    pendingStepSource = 'spinner';
  }

  function handleMouseDown() {
    pendingStepSource = 'spinner';
  }

  function handleChange(event: Event) {
    if (!pendingStepSource) return;

    const target = event.currentTarget as HTMLInputElement;
    const nextValue = parseDisplayValue(target.value);
    const didChange = nextValue !== $valueStore;
    $valueStore = nextValue;
    displayValue = `${nextValue}`;
    pendingStepSource = null;

    if (didChange) {
      onCommit?.();
    }
  }

  function normalizeEmptyValue() {
    const normalized = displayValue.trim() === '' ? emptyFallback : displayValue;
    const nextValue = parseDisplayValue(normalized);

    const didChange = nextValue !== $valueStore;
    $valueStore = nextValue;
    displayValue = `${nextValue}`;
    isFocused = false;
    pendingStepSource = null;
    if (didChange) {
      onCommit?.();
    }
  }
</script>

<Form.Field {form} {name}>
  {#snippet children({ constraints })}
    <Form.Control>
      {#snippet children({ props })}
        <div class="flex items-center justify-between gap-2">
          <Form.Label class="leading-7">{label}</Form.Label>
          {#if labelActionText && onLabelAction}
            <Button.Root
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              onclick={onLabelAction}
            >
              <Pencil class="size-3.5" />
              {labelActionText}
            </Button.Root>
          {/if}
        </div>
        <div class="relative">
          {#if prefix}
            <span
              class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            >
              {prefix}
            </span>
          {/if}
          <Input
            {...props}
            {...constraints}
            id={id ?? props.id}
            value={displayValue}
            class={inputPaddingClass}
            type="number"
            step={kind === 'int' ? '1' : 'any'}
            {inputmode}
            onkeydown={handleKeyDown}
            onwheel={handleWheel}
            onpointerdown={handlePointerDown}
            onmousedown={handleMouseDown}
            oninput={handleInput}
            onchange={handleChange}
            onfocus={() => {
              isFocused = true;
              pendingStepSource = null;
            }}
            onblur={normalizeEmptyValue}
          />
          {#if suffix}
            <span
              class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
            >
              {suffix}
            </span>
          {/if}
        </div>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  {/snippet}
</Form.Field>
