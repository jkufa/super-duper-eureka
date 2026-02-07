<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  let { form }: { form: SuperForm<RetirementConfigFormValues> } = $props();
  const formData = form.form;
</script>

<section class="space-y-4">
  <div class="space-y-1">
    <h2 class="text-sm font-medium">Current Investments</h2>
  </div>

  <Form.Field {form} name="currentBalance">
    {#snippet children({ constraints })}
      <Form.Control>
        {#snippet children({ props })}
          <div class="relative">
            <span class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
              $
            </span>
            <Input
              {...props}
              {...constraints}
              bind:value={$formData.currentBalance}
              class="pl-7"
              type="number"
              min="0"
              step="1000"
            />
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    {/snippet}
  </Form.Field>

  <Form.Field {form} name="yearsToRetirement">
    {#snippet children({ constraints })}
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Years to Retirement</Form.Label>
          <Input
            {...props}
            {...constraints}
            bind:value={$formData.yearsToRetirement}
            type="number"
            min="1"
            max="80"
            step="1"
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    {/snippet}
  </Form.Field>
</section>
