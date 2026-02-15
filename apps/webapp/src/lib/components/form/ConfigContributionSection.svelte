<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigNumericField from './ConfigNumericField.svelte';
  import ConfigCustomVariableForm from './ConfigCustomVariableForm.svelte';

  let {
    form,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    onCommit?: () => void;
  } = $props();

  const formData = form.form;
  let editingFieldKey = $state<string | null>(null);

  const fields = $derived(
    $formData.customVariables.map((contribution, index) => ({
      key: `custom-${index}`,
      index,
      contribution,
      name: `customVariables[${index}].amount` as const,
      label: contribution.name,
      emptyFallback: '0',
      prefix: contribution.type === 'flat' ? '$' : undefined,
      suffix: contribution.type === 'salaryPercent' ? '%' : undefined
    }))
  );

  function toEditableVariable(field: (typeof fields)[number]) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const variable = $formData.customVariables[field.index];
    return {
      ...variable,
      timingInputMode: variable.timingInputMode ?? 'hybrid',
      timingNaturalText: variable.timingNaturalText ?? '',
      timingDay: variable.timingDay ?? 1,
      timingMonth: variable.timingMonth ?? 1,
      timingYear: variable.timingYear ?? currentYear,
      growthEnabled: variable.growthEnabled ?? false,
      growthType: variable.growthType ?? 'percent',
      growthAmount: variable.growthAmount ?? 0,
      growthCadence: variable.growthCadence ?? 'annual'
    };
  }
</script>

<section class="-mx-4 space-y-4">
  {#if fields.length === 0}
    <p class="text-sm text-muted-foreground">No contribution rules configured.</p>
  {:else}
    {#each fields as field (field.key)}
      {#if editingFieldKey === field.key}
        <ConfigCustomVariableForm
          {form}
          displayName={field.contribution.name}
          mode="edit"
          variable={toEditableVariable(field)}
          onSaveVariable={(nextVariable) => {
            const next = $formData.customVariables.slice();
            next[field.index] = nextVariable;
            $formData.customVariables = next;
            editingFieldKey = null;
            onCommit?.();
          }}
          onDeleteVariable={() => {
            const next = $formData.customVariables.slice();
            next.splice(field.index, 1);
            $formData.customVariables = next;
            editingFieldKey = null;
            onCommit?.();
          }}
          onCancel={() => {
            editingFieldKey = null;
          }}
        />
      {:else}
        <div class="group space-y-2 px-4">
          <ConfigNumericField
            {form}
            name={field.name}
            label={field.label}
            prefix={field.prefix}
            suffix={field.suffix}
            kind="number"
            inputmode="decimal"
            emptyFallback={field.emptyFallback}
            labelActionText="Edit"
            onLabelAction={() => {
              editingFieldKey = field.key;
            }}
            {onCommit}
          />
        </div>
      {/if}
    {/each}
  {/if}
</section>
