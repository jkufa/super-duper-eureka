<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import * as Form from '$lib/components/ui/form';
  import * as Toggle from '$lib/components/ui/toggle';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { Input } from '$lib/components/ui/input';
  import ConfigNumericField from './ConfigNumericField.svelte';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type Mode = 'create' | 'edit';
  type CustomVariable = RetirementConfigFormValues['customVariables'][number];

  let {
    form,
    mode = 'create',
    editGrowthEnabled = $bindable(false),
    editGrowthType = $bindable<CustomVariable['growthType']>('percent'),
    editGrowthAmount = $bindable(0),
    editGrowthCadence = $bindable<CustomVariable['growthCadence']>('annual'),
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    mode?: Mode;
    editGrowthEnabled?: boolean;
    editGrowthType?: CustomVariable['growthType'];
    editGrowthAmount?: number;
    editGrowthCadence?: CustomVariable['growthCadence'];
  } = $props();

  const draftGrowthEnabled = fieldProxy(form, 'customVariableDraft.growthEnabled');
  const draftGrowthType = fieldProxy(form, 'customVariableDraft.growthType');
  const draftGrowthCadence = fieldProxy(form, 'customVariableDraft.growthCadence');

  function parseNonNegativeInputValue(raw: string) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function numericInputPaddingClass(prefix?: string, suffix?: string) {
    return prefix ? 'pl-7' : suffix ? 'pr-7' : '';
  }
</script>

{#if mode === 'create'}
  <div class="space-y-2 rounded-md border border-border/70 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="leading-7">Growth (optional)</p>
      <Toggle.Root bind:pressed={$draftGrowthEnabled} variant="outline" size="sm">
        {$draftGrowthEnabled ? 'Enabled' : 'Disabled'}
      </Toggle.Root>
    </div>
    {#if $draftGrowthEnabled}
      <Form.Field {form} name="customVariableDraft.growthType">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label class="leading-7">Increment type</Form.Label>
            <ToggleGroup.Root {...props} type="single" bind:value={$draftGrowthType} variant="outline" class="w-full">
              <ToggleGroup.Item value="percent" class="flex-grow-2">Percent %</ToggleGroup.Item>
              <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
            </ToggleGroup.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>

      <ConfigNumericField
        {form}
        name="customVariableDraft.growthAmount"
        label="Raise by"
        prefix={$draftGrowthType === 'flat' ? '$' : undefined}
        suffix={$draftGrowthType === 'percent' ? '%' : undefined}
        kind="number"
        inputmode="decimal"
        emptyFallback="0"
      />

      <Form.Field {form} name="customVariableDraft.growthCadence">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label class="leading-7">Cadence</Form.Label>
            <ToggleGroup.Root
              {...props}
              type="single"
              bind:value={$draftGrowthCadence}
              variant="outline"
              class="w-full"
            >
              <ToggleGroup.Item value="monthly" class="flex-grow-2">Monthly</ToggleGroup.Item>
              <ToggleGroup.Item value="annual" class="flex-grow-2">Annually</ToggleGroup.Item>
            </ToggleGroup.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    {/if}
  </div>
{:else}
  <div class="space-y-2 rounded-md border border-border/70 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="leading-7">Growth (optional)</p>
      <Toggle.Root bind:pressed={editGrowthEnabled} variant="outline" size="sm">
        {editGrowthEnabled ? 'Enabled' : 'Disabled'}
      </Toggle.Root>
    </div>
    {#if editGrowthEnabled}
      <div class="space-y-1.5">
        <span class="leading-7">Increment type</span>
        <ToggleGroup.Root type="single" bind:value={editGrowthType} variant="outline" class="w-full">
          <ToggleGroup.Item value="percent" class="flex-grow-2">Percent %</ToggleGroup.Item>
          <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      <div class="space-y-1.5">
        <label class="leading-7" for="edit-custom-variable-growth-amount">Raise by</label>
        <div class="relative">
          {#if editGrowthType === 'flat'}
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
          {/if}
          <Input
            id="edit-custom-variable-growth-amount"
            type="number"
            min="0"
            step="any"
            inputmode="decimal"
            class={numericInputPaddingClass(editGrowthType === 'flat' ? '$' : undefined, editGrowthType === 'percent' ? '%' : undefined)}
            value={editGrowthAmount}
            oninput={(event) => {
              editGrowthAmount = parseNonNegativeInputValue((event.currentTarget as HTMLInputElement).value);
            }}
          />
          {#if editGrowthType === 'percent'}
            <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          {/if}
        </div>
      </div>

      <div class="space-y-1.5">
        <span class="leading-7">Cadence</span>
        <ToggleGroup.Root type="single" bind:value={editGrowthCadence} variant="outline" class="w-full">
          <ToggleGroup.Item value="monthly" class="flex-grow-2">Monthly</ToggleGroup.Item>
          <ToggleGroup.Item value="annual" class="flex-grow-2">Annually</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
    {/if}
  </div>
{/if}
