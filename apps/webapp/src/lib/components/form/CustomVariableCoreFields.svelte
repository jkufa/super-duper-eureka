<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import ConfigNumericField from './ConfigNumericField.svelte';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type Mode = 'create' | 'edit';

  let {
    form,
    mode = 'create',
    editName = $bindable(''),
    editType = $bindable<RetirementConfigFormValues['customVariables'][number]['type']>('flat'),
    editAmount = $bindable(0),
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    mode?: Mode;
    editName?: string;
    editType?: RetirementConfigFormValues['customVariables'][number]['type'];
    editAmount?: number;
  } = $props();

  const draftName = fieldProxy(form, 'customVariableDraft.name');
  const draftType = fieldProxy(form, 'customVariableDraft.type');

  function parseNonNegativeInputValue(raw: string) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function numericInputPaddingClass(prefix?: string, suffix?: string) {
    return prefix ? 'pl-7' : suffix ? 'pr-7' : '';
  }
</script>

{#if mode === 'create'}
  <Form.Field {form} name="customVariableDraft.name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="leading-7">Variable name</Form.Label>
        <Input
          {...props}
          id="custom-variable-name"
          type="text"
          placeholder="Annual Bonus"
          value={$draftName}
          oninput={(event) => {
            $draftName = (event.currentTarget as HTMLInputElement).value;
          }}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <Form.Field {form} name="customVariableDraft.type">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="leading-7">Type</Form.Label>
        <ToggleGroup.Root
          {...props}
          type="single"
          bind:value={$draftType}
          variant="outline"
          class="w-full"
        >
          <ToggleGroup.Item value="salaryPercent" class="flex-grow-2">Percent %</ToggleGroup.Item>
          <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
        </ToggleGroup.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>

  <ConfigNumericField
    {form}
    name="customVariableDraft.amount"
    id="custom-variable-amount"
    label={$draftType === 'salaryPercent' ? 'Amount %' : 'Amount $'}
    prefix={$draftType === 'flat' ? '$' : undefined}
    suffix={$draftType === 'salaryPercent' ? '%' : undefined}
    kind="number"
    inputmode="decimal"
    emptyFallback="0"
  />
{:else}
  <div class="space-y-1.5">
    <label class="leading-7" for="edit-custom-variable-name">Variable name</label>
    <Input
      id="edit-custom-variable-name"
      type="text"
      value={editName}
      oninput={(event) => {
        editName = (event.currentTarget as HTMLInputElement).value;
      }}
    />
  </div>

  <div class="space-y-1.5">
    <span class="leading-7">Type</span>
    <ToggleGroup.Root type="single" bind:value={editType} variant="outline" class="w-full">
      <ToggleGroup.Item value="salaryPercent" class="flex-grow-2">Percent %</ToggleGroup.Item>
      <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>

  <div class="space-y-1.5">
    <label class="leading-7" for="edit-custom-variable-amount">{editType === 'salaryPercent' ? 'Amount %' : 'Amount $'}</label>
    <div class="relative">
      {#if editType === 'flat'}
        <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          $
        </span>
      {/if}
      <Input
        id="edit-custom-variable-amount"
        type="number"
        min="0"
        step="any"
        inputmode="decimal"
        class={numericInputPaddingClass(editType === 'flat' ? '$' : undefined, editType === 'salaryPercent' ? '%' : undefined)}
        value={editAmount}
        oninput={(event) => {
          editAmount = parseNonNegativeInputValue((event.currentTarget as HTMLInputElement).value);
        }}
      />
      {#if editType === 'salaryPercent'}
        <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          %
        </span>
      {/if}
    </div>
  </div>
{/if}
