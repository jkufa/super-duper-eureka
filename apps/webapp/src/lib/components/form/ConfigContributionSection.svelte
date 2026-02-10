<script lang="ts">
  import type { RetirementConfig } from '@retirement/calculator/types';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigNumericField from './ConfigNumericField.svelte';
  import ConfigCustomVariableForm from './ConfigCustomVariableForm.svelte';

  let {
    form,
    contributions,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    contributions: RetirementConfig['contributions'];
    onCommit?: () => void;
  } = $props();

  const formData = form.form;
  let editingFieldKey = $state<string | null>(null);

  const fields = $derived(
    [
      ...contributions.map((contribution, index) => ({
        key: `base-${index}`,
        source: 'base' as const,
        index,
        id: contribution.id,
        contribution,
        name: `contributionVariables[${index}].amount` as const,
        label: contribution.name ?? contribution.id,
        emptyFallback: '0',
        prefix: contribution.type === 'flat' ? '$' : undefined,
        suffix: contribution.type === 'salaryPercent' ? '%' : undefined
      })),
      ...$formData.customVariables.map((contribution, index) => ({
        key: `custom-${index}`,
        source: 'custom' as const,
        index,
        id: contribution.id,
        contribution,
        name: `customVariables[${index}].amount` as const,
        label: contribution.name,
        emptyFallback: '0',
        prefix: contribution.type === 'flat' ? '$' : undefined,
        suffix: contribution.type === 'salaryPercent' ? '%' : undefined
      }))
    ]
  );

  function toEditableVariable(field: (typeof fields)[number]) {
    const now = new Date();
    const currentYear = now.getFullYear();
    if (field.source === 'custom') {
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

    const baseAmount = $formData.contributionVariables[field.index]?.amount ?? field.contribution.amount ?? 0;
    const timing = field.contribution.timing;
    const frequency: 'annual' | 'monthly' | 'oneTime' = timing.frequency;
    const placement = timing.frequency === 'oneTime' ? 'start' : (timing.placement ?? 'start');
    const timingDay = timing.frequency === 'oneTime' ? (timing.on.day ?? 1) : (timing.day ?? 1);
    const timingMonth
      = timing.frequency === 'annual'
        ? timing.month + 1
        : timing.frequency === 'oneTime'
          ? timing.on.month + 1
          : 1;
    const timingYear = timing.frequency === 'oneTime' ? currentYear + timing.on.year : currentYear;
    return {
      id: field.id,
      name: field.contribution.name ?? field.contribution.id,
      type: field.contribution.type,
      amount: baseAmount,
      frequency,
      placement,
      timingInputMode: 'hybrid' as const,
      timingNaturalText: '',
      timingDay,
      timingMonth,
      timingYear,
      yearStart: field.contribution.yearRange?.start ?? 0,
      yearEnd: field.contribution.yearRange?.end ?? $formData.yearsToRetirement,
      growthEnabled: Boolean(field.contribution.growth),
      growthType: field.contribution.growth?.type ?? 'percent',
      growthAmount: field.contribution.growth?.amount ?? 0,
      growthCadence: field.contribution.growth?.cadence ?? 'annual'
    };
  }
</script>

<section class="space-y-4">
  <p class="text-xs text-muted-foreground">
    Built-in variables in this section are currently testing fixtures.
  </p>
  {#if fields.length === 0}
    <p class="text-sm text-muted-foreground">No contribution rules configured.</p>
  {:else}
    {#each fields as field (field.key)}
      {#if editingFieldKey === field.key}
        <ConfigCustomVariableForm
          {form}
          mode="edit"
          variable={toEditableVariable(field)}
          onSaveVariable={(nextVariable) => {
            if (field.source === 'custom') {
              const next = $formData.customVariables.slice();
              next[field.index] = nextVariable;
              $formData.customVariables = next;
            } else {
              const nextBase = $formData.contributionVariables.slice();
              nextBase[field.index] = {
                ...nextBase[field.index],
                amount: 0
              };
              $formData.contributionVariables = nextBase;

              const nextCustom = $formData.customVariables.slice();
              const existingIndex = nextCustom.findIndex((item) => item.id === nextVariable.id);
              if (existingIndex === -1) {
                nextCustom.push(nextVariable);
              } else {
                nextCustom[existingIndex] = nextVariable;
              }
              $formData.customVariables = nextCustom;
            }
            editingFieldKey = null;
            onCommit?.();
          }}
          onDeleteVariable={() => {
            if (field.source === 'custom') {
              const next = $formData.customVariables.slice();
              next.splice(field.index, 1);
              $formData.customVariables = next;
            } else {
              const nextBase = $formData.contributionVariables.slice();
              nextBase[field.index] = {
                ...nextBase[field.index],
                amount: 0
              };
              $formData.contributionVariables = nextBase;
            }
            editingFieldKey = null;
            onCommit?.();
          }}
          onCancel={() => {
            editingFieldKey = null;
          }}
        />
      {:else}
        <div class="group space-y-2">
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
