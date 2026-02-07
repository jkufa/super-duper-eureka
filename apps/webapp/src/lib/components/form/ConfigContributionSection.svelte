<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  let { form }: { form: SuperForm<RetirementConfigFormValues> } = $props();
  const formData = form.form;
</script>

<section class="space-y-4 border-t pt-4">
  <div class="space-y-1">
    <h2 class="text-sm font-medium">Contributions</h2>
  </div>

  <Form.Field {form} name="monthlyContribution">
    {#snippet children({ constraints })}
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Monthly Contribution</Form.Label>
          <div class="relative">
            <span class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
              $
            </span>
            <Input
              {...props}
              {...constraints}
              bind:value={$formData.monthlyContribution}
              class="pl-7"
              type="number"
              min="0"
              step="100"
            />
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    {/snippet}
  </Form.Field>
</section>
