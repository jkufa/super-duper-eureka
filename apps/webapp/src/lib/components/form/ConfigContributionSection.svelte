<script lang="ts">
  import type { RetirementConfig } from '@retirement/calculator/types';
  import { Input } from '$lib/components/ui/input';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

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

  const fields = $derived(
    contributions.map((contribution, index) => ({
      index,
      label: contribution.name ?? contribution.id,
      emptyFallback: '0',
      prefix: contribution.type === 'flat' ? '$' : undefined,
      suffix: contribution.type === 'salaryPercent' ? '%' : undefined
    }))
  );

  function normalizeEmptyValue(index: number, emptyFallback: string) {
    const current = $formData.contributionVariables[index]?.amount;
    const nextValue = Number.isFinite(current) ? current : Number.parseFloat(emptyFallback);
    if (!Number.isFinite(nextValue)) return;

    const next = $formData.contributionVariables.slice();
    next[index] = {
      ...next[index],
      amount: nextValue
    };
    $formData.contributionVariables = next;
    onCommit?.();
  }
</script>

<section class="space-y-4">
  {#if fields.length === 0}
    <p class="text-sm text-muted-foreground">No contribution rules configured.</p>
  {:else}
    {#each fields as field (field.index)}
      <div class="space-y-2">
        <label class="text-sm leading-none font-medium" for={`contribution-${field.index}`}
          >{field.label}</label
        >
        <div class="relative">
          {#if field.prefix}
            <span
              class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            >
              {field.prefix}
            </span>
          {/if}
          <Input
            id={`contribution-${field.index}`}
            type="number"
            min="0"
            step="any"
            inputmode="decimal"
            value={$formData.contributionVariables[field.index]?.amount ?? 0}
            class={field.prefix ? 'pl-7' : field.suffix ? 'pr-7' : ''}
            oninput={(event) => {
              const target = event.currentTarget as HTMLInputElement;
              const parsed = Number.parseFloat(target.value);
              const next = $formData.contributionVariables.slice();
              next[field.index] = {
                ...next[field.index],
                amount: Number.isFinite(parsed) ? parsed : 0
              };
              $formData.contributionVariables = next;
            }}
            onblur={() => normalizeEmptyValue(field.index, field.emptyFallback)}
          />
          {#if field.suffix}
            <span
              class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
            >
              {field.suffix}
            </span>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</section>
