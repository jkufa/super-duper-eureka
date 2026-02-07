<script lang="ts">
  import * as Form from '$lib/components/ui/form';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  let { form }: { form: SuperForm<RetirementConfigFormValues> } = $props();
  const formData = form.form;
</script>

<section class="space-y-4 border-t pt-4">
  <div class="space-y-1">
    <h2 class="text-sm font-medium">Growth</h2>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <Form.Field {form} name="annualReturnPct">
      {#snippet children({ constraints })}
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Est. Annual Return</Form.Label>
            <div class="relative">
              <Input
                {...props}
                {...constraints}
                bind:value={$formData.annualReturnPct}
                class="pr-7"
                type="number"
                min="0"
                max="50"
                step="0.1"
              />
              <span
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
              >
                %
              </span>
            </div>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      {/snippet}
    </Form.Field>

    <Form.Field {form} name="variancePct">
      {#snippet children({ constraints })}
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Variance</Form.Label>
            <div class="relative">
              <Input
                {...props}
                {...constraints}
                bind:value={$formData.variancePct}
                class="pr-7"
                type="number"
                min="0"
                max="50"
                step="0.1"
              />
              <span
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
              >
                %
              </span>
            </div>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      {/snippet}
    </Form.Field>
  </div>

  <Form.Field {form} name="compounding">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Compound Frequency</Form.Label>
        <Select.Root
          type="single"
          name={props.name}
          value={$formData.compounding}
          onValueChange={(value) => {
            if (value === 'monthly' || value === 'daily') {
              $formData.compounding = value;
            }
          }}
        >
          <Select.Trigger class="w-full">
            {$formData.compounding === 'daily' ? 'Daily' : 'Monthly'}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="monthly" label="Monthly" />
            <Select.Item value="daily" label="Daily" />
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</section>
