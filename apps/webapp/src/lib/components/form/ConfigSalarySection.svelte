<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigNumericField from './ConfigNumericField.svelte';

  let {
    form,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    onCommit?: () => void;
  } = $props();
</script>

<section class="space-y-4 border-t pt-4">
  <div class="space-y-1">
    <h2 class="text-sm font-medium">Salary</h2>
  </div>

  <ConfigNumericField
    {form}
    name="baseSalary"
    label="Base Salary"
    prefix="$"
    kind="number"
    inputmode="decimal"
    emptyFallback="0"
    {onCommit}
  />

  <ConfigNumericField
    {form}
    name="annualRaisePct"
    label="Raise by"
    suffix="%"
    kind="number"
    inputmode="decimal"
    emptyFallback="0"
    {onCommit}
  />
</section>
