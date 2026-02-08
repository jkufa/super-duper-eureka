<script lang="ts">
  import type { RetirementConfig } from '@retirement/calculator/types';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigBasicsSection from '$lib/components/form/ConfigBasicsSection.svelte';
  import ConfigGrowthSection from '$lib/components/form/ConfigGrowthSection.svelte';
  import ConfigSalarySection from '$lib/components/form/ConfigSalarySection.svelte';
  import ConfigContributionSection from '$lib/components/form/ConfigContributionSection.svelte';
  import * as Accordion from '$lib/components/ui/accordion';

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

  let openGroups = $state(['basics', 'growth', 'salary', 'contributions']);
</script>

<section class="w-full max-w-88 space-y-5">
  <form class="space-y-4" method="POST" use:enhance onsubmit={(event) => event.preventDefault()}>
    <Accordion.Root type="multiple" bind:value={openGroups}>
      <Accordion.Item value="basics">
        <Accordion.Trigger class="py-3 text-sm font-medium">Current Investments</Accordion.Trigger>
        <Accordion.Content class="pt-0 pb-4">
          <ConfigBasicsSection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="growth">
        <Accordion.Trigger class="py-3 text-sm font-medium">Growth</Accordion.Trigger>
        <Accordion.Content class="pt-0 pb-4">
          <ConfigGrowthSection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="salary">
        <Accordion.Trigger class="py-3 text-sm font-medium">Salary</Accordion.Trigger>
        <Accordion.Content class="pt-0 pb-4">
          <ConfigSalarySection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="contributions">
        <Accordion.Trigger class="py-3 text-sm font-medium">Contributions</Accordion.Trigger>
        <Accordion.Content class="pt-0 pb-4">
          <ConfigContributionSection {form} {onCommit} {contributions} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  </form>
</section>
