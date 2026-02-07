<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import * as Select from '$lib/components/ui/select';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigNumericField from './ConfigNumericField.svelte';

  type CompoundingFrequency = RetirementConfigFormValues['compounding'];

  let {
    form,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    onCommit?: () => void;
  } = $props();

  const formData = form.form;

  function isCompoundingFrequency(value: string): value is CompoundingFrequency {
    return value === 'monthly' || value === 'daily';
  }

  function handleCompoundingChange(value: string) {
    if (!isCompoundingFrequency(value)) return;
    $formData.compounding = value;
    onCommit?.();
  }
</script>

<section class="space-y-4 border-t pt-4">
  <div class="space-y-1">
    <h2 class="text-sm font-medium">Growth</h2>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <ConfigNumericField
      {form}
      name="annualReturnPct"
      label="Est. Annual Return"
      suffix="%"
      kind="number"
      inputmode="decimal"
      emptyFallback="0"
      {onCommit}
    />

    <ConfigNumericField
      {form}
      name="variancePct"
      label="Variance"
      suffix="%"
      kind="number"
      inputmode="decimal"
      emptyFallback="0"
      {onCommit}
    />
  </div>

  <Form.Field {form} name="compounding">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Compound Frequency</Form.Label>
        <Select.Root
          type="single"
          name={props.name}
          value={$formData.compounding}
          onValueChange={handleCompoundingChange}
        >
          <Select.Trigger class="w-full">
            {$formData.compounding === 'daily' ? 'Daily' : 'Monthly'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="monthly" label="Monthly" />
            <Select.Item value="daily" label="Daily" />
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</section>
