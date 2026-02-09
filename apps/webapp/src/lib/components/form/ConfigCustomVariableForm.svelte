<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import * as Form from '$lib/components/ui/form';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import { Input } from '$lib/components/ui/input';
  import * as Button from '$lib/components/ui/button';
  import * as Toggle from '$lib/components/ui/toggle';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import ConfigNumericField from './ConfigNumericField.svelte';

  type Mode = 'create' | 'edit';
  type CustomVariable = RetirementConfigFormValues['customVariables'][number];

  let {
    form,
    onCommit,
    mode = 'create',
    variable,
    onSaveVariable,
    onDeleteVariable,
    onCancel
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    onCommit?: () => void;
    mode?: Mode;
    variable?: CustomVariable;
    onSaveVariable?: (variable: CustomVariable) => void;
    onDeleteVariable?: () => void;
    onCancel?: () => void;
  } = $props();

  const formData = form.form;
  const draftName = fieldProxy(form, 'customVariableDraft.name');
  const draftType = fieldProxy(form, 'customVariableDraft.type');
  const draftFrequency = fieldProxy(form, 'customVariableDraft.frequency');
  const draftPlacement = fieldProxy(form, 'customVariableDraft.placement');
  const draftGrowthEnabled = fieldProxy(form, 'customVariableDraft.growthEnabled');
  const draftGrowthType = fieldProxy(form, 'customVariableDraft.growthType');
  const draftGrowthCadence = fieldProxy(form, 'customVariableDraft.growthCadence');

  let editName = $state('');
  let editType = $state<CustomVariable['type']>('flat');
  let editAmount = $state(0);
  let editFrequency = $state<CustomVariable['frequency']>('monthly');
  let editPlacement = $state<CustomVariable['placement']>('end');
  let editYearStart = $state(0);
  let editYearEnd = $state(1);
  let editGrowthEnabled = $state(false);
  let editGrowthType = $state<CustomVariable['growthType']>('percent');
  let editGrowthAmount = $state(0);
  let editGrowthCadence = $state<CustomVariable['growthCadence']>('annual');
  let loadedEditVariableId = $state<string | null>(null);

  let submitError = $state<string | null>(null);

  $effect(() => {
    if (mode !== 'edit' || !variable) {
      loadedEditVariableId = null;
      return;
    }
    if (loadedEditVariableId === variable.id) return;

    editName = variable.name;
    editType = variable.type;
    editAmount = variable.amount;
    editFrequency = variable.frequency;
    editPlacement = variable.placement;
    editYearStart = variable.yearStart;
    editYearEnd = variable.yearEnd;
    editGrowthEnabled = variable.growthEnabled;
    editGrowthType = variable.growthType;
    editGrowthAmount = variable.growthAmount;
    editGrowthCadence = variable.growthCadence;
    loadedEditVariableId = variable.id;
    submitError = null;
  });

  function toCustomId(name: string) {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const token = Math.random().toString(36).slice(2, 8);
    return `custom-${slug || 'variable'}-${token}`;
  }

  function validateValues(
    name: string,
    amount: number,
    yearStart: number,
    yearEnd: number,
    growthEnabled: boolean,
    growthAmount: number,
  ) {
    if (!name.trim()) return 'Variable name is required.';
    if (!Number.isFinite(amount) || amount < 0) return 'Amount must be 0 or greater.';
    if (!Number.isFinite(yearStart) || !Number.isFinite(yearEnd) || yearEnd < yearStart) {
      return 'Year range is invalid.';
    }
    if (growthEnabled && (!Number.isFinite(growthAmount) || growthAmount < 0)) {
      return 'Growth amount must be 0 or greater.';
    }
    return null;
  }

  function addCustomVariable() {
    const trimmedName = ($draftName ?? '').trim();
    const parsedAmount = $formData.customVariableDraft.amount;
    const contributionType = $draftType;
    const frequency = $draftFrequency;
    const placement = $draftPlacement;
    const yearStart = $formData.customVariableDraft.yearStart;
    const yearEnd = $formData.customVariableDraft.yearEnd;
    const growthEnabled = $draftGrowthEnabled;
    const growthType = $draftGrowthType;
    const growthAmount = $formData.customVariableDraft.growthAmount;
    const growthCadence = $draftGrowthCadence;

    const validationError = validateValues(
      trimmedName,
      parsedAmount,
      yearStart,
      yearEnd,
      growthEnabled,
      growthAmount,
    );
    if (validationError) {
      submitError = validationError;
      return;
    }

    const next = $formData.customVariables.slice();
    next.push({
      id: toCustomId(trimmedName),
      name: trimmedName,
      type: contributionType,
      amount: parsedAmount,
      frequency,
      placement,
      yearStart: Math.max(0, Math.trunc(yearStart)),
      yearEnd: Math.max(Math.trunc(yearStart), Math.trunc(yearEnd)),
      growthEnabled,
      growthType,
      growthAmount: Math.max(0, growthAmount),
      growthCadence
    });
    $formData.customVariables = next;

    $draftName = '';
    $formData.customVariableDraft.amount = 0;
    $draftType = 'flat';
    $draftFrequency = 'monthly';
    $draftPlacement = 'end';
    $formData.customVariableDraft.yearStart = 0;
    $formData.customVariableDraft.yearEnd = $formData.yearsToRetirement;
    $draftGrowthEnabled = false;
    $draftGrowthType = 'percent';
    $formData.customVariableDraft.growthAmount = 0;
    $draftGrowthCadence = 'annual';
    submitError = null;
    onCommit?.();
  }

  function saveCustomVariable() {
    if (!variable) return;

    const validationError = validateValues(
      editName,
      editAmount,
      editYearStart,
      editYearEnd,
      editGrowthEnabled,
      editGrowthAmount,
    );
    if (validationError) {
      submitError = validationError;
      return;
    }

    onSaveVariable?.({
      id: variable.id,
      name: editName.trim(),
      type: editType,
      amount: editAmount,
      frequency: editFrequency,
      placement: editPlacement,
      yearStart: Math.max(0, Math.trunc(editYearStart)),
      yearEnd: Math.max(Math.trunc(editYearStart), Math.trunc(editYearEnd)),
      growthEnabled: editGrowthEnabled,
      growthType: editGrowthType,
      growthAmount: Math.max(0, editGrowthAmount),
      growthCadence: editGrowthCadence
    });
    submitError = null;
  }
</script>

<section class="w-full space-y-3 rounded-xl border border-dashed border-border px-4 py-4">
  <h3 class="text-sm font-semibold">{mode === 'edit' ? 'Edit custom variable' : 'Add custom variable'}</h3>

  {#snippet draftGrowthSection()}
    <div class="space-y-2 rounded-md border border-border/70 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-medium text-muted-foreground">Growth (optional)</p>
        <Toggle.Root bind:pressed={$draftGrowthEnabled} variant="outline" size="sm">
          {$draftGrowthEnabled ? 'Enabled' : 'Disabled'}
        </Toggle.Root>
      </div>
      {#if $draftGrowthEnabled}
        <Form.Field {form} name="customVariableDraft.growthType">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label class="text-xs text-muted-foreground">Increment type</Form.Label>
              <ToggleGroup.Root {...props} type="single" bind:value={$draftGrowthType} variant="outline" class="w-full">
                <ToggleGroup.Item value="percent" class="flex-grow-2">Percent %</ToggleGroup.Item>
                <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
              </ToggleGroup.Root>
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>

        <ConfigNumericField
          {form}
          name="customVariableDraft.growthAmount"
          label="Raise by"
          prefix={$draftGrowthType === 'flat' ? '$' : undefined}
          suffix={$draftGrowthType === 'percent' ? '%' : undefined}
          kind="number"
          inputmode="decimal"
          emptyFallback="0"
        />

        <Form.Field {form} name="customVariableDraft.growthCadence">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label class="text-xs text-muted-foreground">Cadence</Form.Label>
              <ToggleGroup.Root
                {...props}
                type="single"
                bind:value={$draftGrowthCadence}
                variant="outline"
                class="w-full"
              >
                <ToggleGroup.Item value="monthly" class="flex-grow-2">Monthly</ToggleGroup.Item>
                <ToggleGroup.Item value="annual" class="flex-grow-2">Annually</ToggleGroup.Item>
              </ToggleGroup.Root>
            {/snippet}
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
      {/if}
    </div>
  {/snippet}

  {#snippet editGrowthSection()}
    <div class="space-y-2 rounded-md border border-border/70 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-medium text-muted-foreground">Growth (optional)</p>
        <Toggle.Root bind:pressed={editGrowthEnabled} variant="outline" size="sm">
          {editGrowthEnabled ? 'Enabled' : 'Disabled'}
        </Toggle.Root>
      </div>
      {#if editGrowthEnabled}
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">Increment type</span>
          <ToggleGroup.Root type="single" bind:value={editGrowthType} variant="outline" class="w-full">
            <ToggleGroup.Item value="percent" class="flex-grow-2">Percent %</ToggleGroup.Item>
            <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground" for="edit-custom-variable-growth-amount">
            Raise by
          </label>
          <div class="relative">
            {#if editGrowthType === 'flat'}
              <span
                class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                >$</span
              >
            {/if}
            <Input
              id="edit-custom-variable-growth-amount"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              class={editGrowthType === 'flat' ? 'pl-7' : editGrowthType === 'percent' ? 'pr-7' : ''}
              value={editGrowthAmount}
              oninput={(event) => {
                const parsed = Number.parseFloat((event.currentTarget as HTMLInputElement).value);
                editGrowthAmount = Number.isFinite(parsed) ? parsed : 0;
              }}
            />
            {#if editGrowthType === 'percent'}
              <span
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                >%</span
              >
            {/if}
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">Cadence</span>
          <ToggleGroup.Root type="single" bind:value={editGrowthCadence} variant="outline" class="w-full">
            <ToggleGroup.Item value="monthly" class="flex-grow-2">Monthly</ToggleGroup.Item>
            <ToggleGroup.Item value="annual" class="flex-grow-2">Annually</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      {/if}
    </div>
  {/snippet}

  {#if mode === 'create'}
    <Form.Field {form} name="customVariableDraft.name">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-xs text-muted-foreground">Variable name</Form.Label>
          <Input
            {...props}
            id="custom-variable-name"
            type="text"
            placeholder="Annual Bonus"
            value={$draftName}
            oninput={(event) => {
              $draftName = (event.currentTarget as HTMLInputElement).value;
            }}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="customVariableDraft.type">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-xs text-muted-foreground">Type</Form.Label>
          <ToggleGroup.Root
            {...props}
            type="single"
            bind:value={$draftType}
            variant="outline"
            class="w-full"
          >
            <ToggleGroup.Item value="salaryPercent" class="flex-grow-2">Percent %</ToggleGroup.Item>
            <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
          </ToggleGroup.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <ConfigNumericField
      {form}
      name="customVariableDraft.amount"
      id="custom-variable-amount"
      label={$draftType === 'salaryPercent' ? 'Amount %' : 'Amount $'}
      prefix={$draftType === 'flat' ? '$' : undefined}
      suffix={$draftType === 'salaryPercent' ? '%' : undefined}
      kind="number"
      inputmode="decimal"
      emptyFallback="0"
    />

    <Form.Field {form} name="customVariableDraft.frequency">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-xs text-muted-foreground">Contribution frequency</Form.Label>
          <ToggleGroup.Root
            {...props}
            type="single"
            bind:value={$draftFrequency}
            variant="outline"
            class="w-full"
          >
            <ToggleGroup.Item value="monthly" class="flex-grow-2">Monthly</ToggleGroup.Item>
            <ToggleGroup.Item value="annual" class="flex-grow-2">Annual</ToggleGroup.Item>
          </ToggleGroup.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <Form.Field {form} name="customVariableDraft.placement">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-xs text-muted-foreground">When to apply contribution</Form.Label>
          <ToggleGroup.Root
            {...props}
            type="single"
            bind:value={$draftPlacement}
            variant="outline"
            class="w-full"
          >
            <ToggleGroup.Item value="start" class="flex-grow-2">At start</ToggleGroup.Item>
            <ToggleGroup.Item value="end" class="flex-grow-2">At end</ToggleGroup.Item>
          </ToggleGroup.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>

    <div class="grid grid-cols-2 gap-3">
      <ConfigNumericField
        {form}
        name="customVariableDraft.yearStart"
        label="Start year"
        kind="int"
        inputmode="numeric"
        emptyFallback="0"
      />
      <ConfigNumericField
        {form}
        name="customVariableDraft.yearEnd"
        label="End year"
        kind="int"
        inputmode="numeric"
        emptyFallback={$formData.yearsToRetirement.toString()}
      />
    </div>

    {@render draftGrowthSection()}
  {:else}
    <div class="space-y-1.5">
      <label class="text-xs font-medium text-muted-foreground" for="edit-custom-variable-name"
        >Variable name</label
      >
      <Input
        id="edit-custom-variable-name"
        type="text"
        value={editName}
        oninput={(event) => {
          editName = (event.currentTarget as HTMLInputElement).value;
        }}
      />
    </div>

    <div class="space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">Type</span>
      <ToggleGroup.Root type="single" bind:value={editType} variant="outline" class="w-full">
        <ToggleGroup.Item value="salaryPercent" class="flex-grow-2">Percent %</ToggleGroup.Item>
        <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>

    <div class="space-y-1.5">
      <label class="text-xs font-medium text-muted-foreground" for="edit-custom-variable-amount">
        {editType === 'salaryPercent' ? 'Amount %' : 'Amount $'}
      </label>
      <div class="relative">
        {#if editType === 'flat'}
          <span
            class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            >$</span
          >
        {/if}
        <Input
          id="edit-custom-variable-amount"
          type="number"
          min="0"
          step="any"
          inputmode="decimal"
          class={editType === 'flat' ? 'pl-7' : editType === 'salaryPercent' ? 'pr-7' : ''}
          value={editAmount}
          oninput={(event) => {
            const parsed = Number.parseFloat((event.currentTarget as HTMLInputElement).value);
            editAmount = Number.isFinite(parsed) ? parsed : 0;
          }}
        />
        {#if editType === 'salaryPercent'}
          <span
            class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
            >%</span
          >
        {/if}
      </div>
    </div>

    <div class="space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">Contribution frequency</span>
      <ToggleGroup.Root type="single" bind:value={editFrequency} variant="outline" class="w-full">
        <ToggleGroup.Item value="monthly" class="flex-grow-2">Monthly</ToggleGroup.Item>
        <ToggleGroup.Item value="annual" class="flex-grow-2">Annual</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>

    <div class="space-y-1.5">
      <span class="text-xs font-medium text-muted-foreground">When to apply contribution</span>
      <ToggleGroup.Root type="single" bind:value={editPlacement} variant="outline" class="w-full">
        <ToggleGroup.Item value="start" class="flex-grow-2">At start</ToggleGroup.Item>
        <ToggleGroup.Item value="end" class="flex-grow-2">At end</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground" for="edit-custom-variable-year-start"
          >Start year</label
        >
        <Input
          id="edit-custom-variable-year-start"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          value={editYearStart}
          oninput={(event) => {
            const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
            editYearStart = Number.isFinite(parsed) ? parsed : 0;
          }}
        />
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-muted-foreground" for="edit-custom-variable-year-end"
          >End year</label
        >
        <Input
          id="edit-custom-variable-year-end"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          value={editYearEnd}
          oninput={(event) => {
            const parsed = Number.parseInt((event.currentTarget as HTMLInputElement).value, 10);
            editYearEnd = Number.isFinite(parsed) ? parsed : 0;
          }}
        />
      </div>
    </div>

    {@render editGrowthSection()}
  {/if}

  {#if submitError}
    <p class="text-xs text-destructive">{submitError}</p>
  {/if}

  {#if mode === 'create'}
    <Button.Root type="button" class="mt-2 w-full" onclick={addCustomVariable}>
      <Plus class="size-4" />
      Add new variable
    </Button.Root>
  {:else}
    <div class="mt-2 flex flex-wrap gap-2">
      <Button.Root type="button" variant="outline" class="flex-1" onclick={onDeleteVariable}>Delete</Button.Root>
      <Button.Root type="button" variant="outline" class="flex-1" onclick={onCancel}>Cancel</Button.Root>
      <Button.Root type="button" class="flex-1" onclick={saveCustomVariable}>Save changes</Button.Root>
    </div>
  {/if}
</section>
