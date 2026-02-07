<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigBasicsSection from '$lib/components/form/ConfigBasicsSection.svelte';
  import ConfigGrowthSection from '$lib/components/form/ConfigGrowthSection.svelte';
  import ConfigSalarySection from '$lib/components/form/ConfigSalarySection.svelte';
  import ConfigContributionSection from '$lib/components/form/ConfigContributionSection.svelte';

  let {
    form,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    onCommit?: () => void;
  } = $props();
</script>

<section class="w-full max-w-88 space-y-5">
  <header class="space-y-1">
    <h2 class="text-2xl font-semibold">Retirement Configuration</h2>
    <p class="text-sm text-muted-foreground">Adjust parameters for your retirement calculation</p>
  </header>

  <form class="space-y-4" method="POST" onsubmit={(event) => event.preventDefault()}>
    <ConfigBasicsSection {form} {onCommit} />
    <ConfigGrowthSection {form} {onCommit} />
    <ConfigSalarySection {form} {onCommit} />
    <ConfigContributionSection {form} {onCommit} />
  </form>
</section>
