<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import ConfigBasicsSection from '$lib/components/form/ConfigBasicsSection.svelte';
  import ConfigGrowthSection from '$lib/components/form/ConfigGrowthSection.svelte';
  import ConfigSalarySection from '$lib/components/form/ConfigSalarySection.svelte';
  import ConfigContributionSection from '$lib/components/form/ConfigContributionSection.svelte';
  import ConfigCustomVariableForm from '$lib/components/form/ConfigCustomVariableForm.svelte';
  import * as Accordion from '$lib/components/ui/accordion';

  let {
    form,
    enhance,
    onCommit
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    enhance: SuperForm<RetirementConfigFormValues>['enhance'];
    onCommit?: () => void;
  } = $props();

  let openGroups = $state(['basics', 'growth', 'salary', 'custom-variables']);
</script>

<section class="w-full max-w-88 space-y-5">
  <form class="space-y-4" method="POST" use:enhance onsubmit={(event) => event.preventDefault()}>
    <Accordion.Root type="multiple" bind:value={openGroups}>
      <Accordion.Item value="basics">
        <Accordion.Trigger class="py-3 text-sm font-medium">Current Investments</Accordion.Trigger>
        <Accordion.Content class="py-4">
          <ConfigBasicsSection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="growth">
        <Accordion.Trigger class="py-3 text-sm font-medium">Growth</Accordion.Trigger>
        <Accordion.Content class="py-4">
          <ConfigGrowthSection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="salary">
        <Accordion.Trigger class="py-3 text-sm font-medium">Salary</Accordion.Trigger>
        <Accordion.Content class="py-4">
          <ConfigSalarySection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="custom-variables">
        <Accordion.Trigger class="py-3 text-sm font-medium">Custom Variables</Accordion.Trigger>
        <Accordion.Content class="py-4">
          <ConfigContributionSection {form} {onCommit} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>

    <div class="-mx-4 mt-8 flex justify-center">
      <ConfigCustomVariableForm {form} {onCommit} />
    </div>
  </form>
</section>
