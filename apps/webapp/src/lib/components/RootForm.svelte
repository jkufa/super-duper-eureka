<script lang="ts">
  import type { RetirementConfig } from '@retirement/calculator/types';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigBasicsSection from '$lib/components/form/ConfigBasicsSection.svelte';
  import ConfigGrowthSection from '$lib/components/form/ConfigGrowthSection.svelte';
  import ConfigSalarySection from '$lib/components/form/ConfigSalarySection.svelte';
  import ConfigContributionSection from '$lib/components/form/ConfigContributionSection.svelte';

  let {
    form,
    enhance,
    contributions,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    enhance: SuperForm<RetirementConfigFormValues>['enhance'];
    contributions: RetirementConfig['contributions'];
    onCommit?: () => void;
  } = $props();
</script>

<section class="w-full max-w-88 space-y-5">
  <form class="space-y-4" method="POST" use:enhance onsubmit={(event) => event.preventDefault()}>
    <ConfigBasicsSection {form} {onCommit} />
    <ConfigGrowthSection {form} {onCommit} />
    <ConfigSalarySection {form} {onCommit} />
    <ConfigContributionSection {form} {onCommit} {contributions} />
  </form>
</section>
