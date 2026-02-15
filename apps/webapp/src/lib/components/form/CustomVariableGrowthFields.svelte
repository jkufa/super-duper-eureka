<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import * as Form from '$lib/components/ui/form';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import ConfigNumericField from './ConfigNumericField.svelte';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type DraftPath = 'customVariableDraft' | 'customVariableEditDraft';
  type GrowthEnabledFieldPath =
    | 'customVariableDraft.growthEnabled'
    | 'customVariableEditDraft.growthEnabled';
  type GrowthTypeFieldPath =
    | 'customVariableDraft.growthType'
    | 'customVariableEditDraft.growthType';
  type GrowthCadenceFieldPath =
    | 'customVariableDraft.growthCadence'
    | 'customVariableEditDraft.growthCadence';
  type GrowthAmountFieldPath =
    | 'customVariableDraft.growthAmount'
    | 'customVariableEditDraft.growthAmount';

  let {
    form,
    draftPath = 'customVariableDraft',
    inputIdPrefix = 'custom-variable'
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    draftPath?: DraftPath;
    inputIdPrefix?: string;
  } = $props();

  const draftGrowthEnabled = fieldProxy(
    form,
    `${draftPath}.growthEnabled` as GrowthEnabledFieldPath
  );
  const draftGrowthType = fieldProxy(form, `${draftPath}.growthType` as GrowthTypeFieldPath);
  const draftGrowthAmount = fieldProxy(form, `${draftPath}.growthAmount` as GrowthAmountFieldPath);
  const draftGrowthCadence = fieldProxy(
    form,
    `${draftPath}.growthCadence` as GrowthCadenceFieldPath
  );
  const growthTypeFieldName = `${draftPath}.growthType` as GrowthTypeFieldPath;
  const growthCadenceFieldName = `${draftPath}.growthCadence` as GrowthCadenceFieldPath;
  const growthAmountFieldName = `${draftPath}.growthAmount` as GrowthAmountFieldPath;

  $effect(() => {
    $draftGrowthEnabled = $draftGrowthAmount > 0;
  });
</script>

<Form.Field {form} name={growthTypeFieldName}>
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label class="leading-7">Increment type</Form.Label>
      <ToggleGroup.Root
        {...props}
        type="single"
        bind:value={$draftGrowthType}
        variant="outline"
        class="w-full"
      >
        <ToggleGroup.Item value="percent" class="flex-grow-2">Percent %</ToggleGroup.Item>
        <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
      </ToggleGroup.Root>
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>

<ConfigNumericField
  {form}
  name={growthAmountFieldName}
  id={`${inputIdPrefix}-growth-amount`}
  label="Raise by"
  prefix={$draftGrowthType === 'flat' ? '$' : undefined}
  suffix={$draftGrowthType === 'percent' ? '%' : undefined}
  kind="number"
  inputmode="decimal"
  emptyFallback="0"
/>

<Form.Field {form} name={growthCadenceFieldName}>
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
