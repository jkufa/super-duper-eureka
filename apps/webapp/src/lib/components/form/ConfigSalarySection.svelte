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
    <h2 class="text-sm font-medium">Salary</h2>
  </div>

  <Form.Field {form} name="baseSalary">
    {#snippet children({ constraints })}
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Base Salary</Form.Label>
          <div class="relative">
            <span class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
              $
            </span>
            <Input
              {...props}
              {...constraints}
              bind:value={$formData.baseSalary}
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

  <Form.Field {form} name="annualRaisePct">
    {#snippet children({ constraints })}
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>Raise by</Form.Label>
          <div class="relative">
            <Input
              {...props}
              {...constraints}
              bind:value={$formData.annualRaisePct}
              class="pr-7"
              type="number"
              min="0"
              max="50"
              step="0.1"
            />
            <span class="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
              %
            </span>
          </div>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    {/snippet}
  </Form.Field>
</section>
