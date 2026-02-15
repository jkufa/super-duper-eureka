<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import ConfigNumericField from './ConfigNumericField.svelte';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type DraftPath = 'customVariableDraft' | 'customVariableEditDraft';
  type NameFieldPath = 'customVariableDraft.name' | 'customVariableEditDraft.name';
  type TypeFieldPath = 'customVariableDraft.type' | 'customVariableEditDraft.type';
  type AmountFieldPath = 'customVariableDraft.amount' | 'customVariableEditDraft.amount';

  let {
    form,
    draftPath = 'customVariableDraft',
    inputIdPrefix = 'custom-variable',
    labelTooltip
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    draftPath?: DraftPath;
    inputIdPrefix?: string;
    labelTooltip?: string;
  } = $props();

  const draftName = fieldProxy(form, `${draftPath}.name` as NameFieldPath);
  const draftType = fieldProxy(form, `${draftPath}.type` as TypeFieldPath);
  const amountFieldName = `${draftPath}.amount` as AmountFieldPath;
</script>

<Form.Field {form} name={`${draftPath}.name` as NameFieldPath}>
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label class="leading-7">Variable name</Form.Label>
      <Input
        {...props}
        id={`${inputIdPrefix}-name`}
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

<Form.Field {form} name={`${draftPath}.type` as TypeFieldPath}>
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
  name={amountFieldName}
  id={`${inputIdPrefix}-amount`}
  label={$draftType === 'salaryPercent' ? 'Amount %' : 'Amount $'}
  {labelTooltip}
  prefix={$draftType === 'flat' ? '$' : undefined}
  suffix={$draftType === 'salaryPercent' ? '%' : undefined}
  kind="number"
  inputmode="decimal"
  emptyFallback="0"
/>
