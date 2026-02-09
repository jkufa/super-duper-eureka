<script lang="ts">
  import type { RetirementConfig } from '@retirement/calculator/types';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import * as Button from '$lib/components/ui/button';
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
    if (field.source === 'custom') {
      const variable = $formData.customVariables[field.index];
      return {
        ...variable,
        growthEnabled: variable.growthEnabled ?? false,
        growthType: variable.growthType ?? 'percent',
        growthAmount: variable.growthAmount ?? 0,
        growthCadence: variable.growthCadence ?? 'annual'
      };
    }

    const baseAmount = $formData.contributionVariables[field.index]?.amount ?? field.contribution.amount ?? 0;
    const timing = field.contribution.timing;
    const frequency: 'annual' | 'monthly' = timing.frequency === 'annual' ? 'annual' : 'monthly';
    const placement = timing.frequency === 'oneTime' ? 'start' : (timing.placement ?? 'start');
    return {
      id: field.id,
      name: field.contribution.name ?? field.contribution.id,
      type: field.contribution.type,
      amount: baseAmount,
      frequency,
      placement,
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
        <div class="group relative space-y-2">
          <ConfigNumericField
            {form}
            name={field.name}
            label={field.label}
            prefix={field.prefix}
            suffix={field.suffix}
            kind="number"
            inputmode="decimal"
            emptyFallback={field.emptyFallback}
            {onCommit}
          />

          <div
            class="mt-1 flex justify-end gap-2 opacity-100 transition-opacity md:absolute md:top-7 md:left-full md:mt-0 md:ml-2 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          >
            <Button.Root
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              onclick={() => {
                editingFieldKey = field.key;
              }}
            >
              Edit
            </Button.Root>
            <Button.Root
              type="button"
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs text-destructive"
              onclick={() => {
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
                if (editingFieldKey === field.key) {
                  editingFieldKey = null;
                }
                onCommit?.();
              }}
            >
              Delete
            </Button.Root>
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</section>
