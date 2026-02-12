<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { ParsedCustomVariableTiming } from '$lib/forms/frequency-nlp';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import { TIMING_PARSE_ERROR_MESSAGE } from '$lib/forms/frequency-nlp';
  import * as Button from '$lib/components/ui/button';
  import * as Accordion from '$lib/components/ui/accordion';
  import CustomVariableCoreFields from './CustomVariableCoreFields.svelte';
  import CustomVariableTimingFields from './CustomVariableTimingFields.svelte';
  import CustomVariableGrowthFields from './CustomVariableGrowthFields.svelte';
  import { parseCustomVariableTiming } from './custom-variable-editor-model';
  import {
    buildCreatedCustomVariable,
    buildSavedCustomVariable
  } from './custom-variable-editor-actions';
  import {
    formatCustomVariableDate,
    toCalendarBounds,
    toDraftResetState,
    toCustomVariableDraftState,
    toParsedCalendarDate
  } from './custom-variable-editor-state';
  import {
    createTimingParseController,
    type TimingTarget
  } from './custom-variable-timing-controller';

  type Mode = 'create' | 'edit';
  type DraftPath = 'customVariableDraft' | 'customVariableEditDraft';
  type CustomVariable = RetirementConfigFormValues['customVariables'][number];
  type SharedProps = {
    form: SuperForm<RetirementConfigFormValues>;
    onCommit?: () => void;
  };
  type CreateEditorProps = SharedProps & {
    mode?: 'create';
  };
  type EditEditorProps = SharedProps & {
    mode: 'edit';
    variable: CustomVariable;
    onSaveVariable: (variable: CustomVariable) => void;
    onDeleteVariable: () => void;
    onCancel: () => void;
  };
  type ConfigCustomVariableFormProps = CreateEditorProps | EditEditorProps;

  let props: ConfigCustomVariableFormProps = $props();
  const form = props.form;
  const onCommit = props.onCommit;
  const mode: Mode = props.mode ?? 'create';

  const formData = form.form;
  const draftFrequency = fieldProxy(form, 'customVariableDraft.frequency');
  const draftPlacement = fieldProxy(form, 'customVariableDraft.placement');
  const draftTimingInputMode = fieldProxy(form, 'customVariableDraft.timingInputMode');
  const draftTimingNaturalText = fieldProxy(form, 'customVariableDraft.timingNaturalText');
  const draftType = fieldProxy(form, 'customVariableDraft.type');

  const editDraftFrequency = fieldProxy(form, 'customVariableEditDraft.frequency');
  const editDraftPlacement = fieldProxy(form, 'customVariableEditDraft.placement');
  const editDraftTimingInputMode = fieldProxy(form, 'customVariableEditDraft.timingInputMode');
  const editDraftTimingNaturalText = fieldProxy(form, 'customVariableEditDraft.timingNaturalText');
  const editDraftType = fieldProxy(form, 'customVariableEditDraft.type');

  const now = new Date();
  const currentYear = now.getFullYear();

  let loadedEditVariableId = $state<string | null>(null);
  let submitError = $state<string | null>(null);
  let draftTimingInfo = $state<string | null>(null);
  let editTimingInfo = $state<string | null>(null);
  const TIMING_PARSE_DEBOUNCE_MS = 400;

  function getEditProps() {
    return mode === 'edit' ? (props as EditEditorProps) : null;
  }

  $effect(() => {
    const editProps = getEditProps();
    if (!editProps) {
      loadedEditVariableId = null;
      return;
    }
    const variable = editProps.variable;
    if (loadedEditVariableId === variable.id) return;
    $formData.customVariableEditDraft = toCustomVariableDraftState(variable);
    loadedEditVariableId = variable.id;
    editTimingInfo = null;
    submitError = null;
  });

  $effect(() => {
    if ($draftTimingInputMode !== 'hybrid') {
      $draftTimingInputMode = 'hybrid';
    }
    if ($editDraftTimingInputMode !== 'hybrid') {
      $editDraftTimingInputMode = 'hybrid';
    }
  });

  const parsedDraftCalendarDate = $derived.by(() => {
    return toParsedCalendarDate(
      $formData.customVariableDraft.timingYear,
      $formData.customVariableDraft.timingMonth,
      $formData.customVariableDraft.timingDay
    );
  });

  const parsedEditCalendarDate = $derived.by(() => {
    return toParsedCalendarDate(
      $formData.customVariableEditDraft.timingYear,
      $formData.customVariableEditDraft.timingMonth,
      $formData.customVariableEditDraft.timingDay
    );
  });

  const draftSelectedCalendarDate = $derived.by(() => {
    if ($draftFrequency !== 'oneTime') return undefined;
    return parsedDraftCalendarDate;
  });

  const editSelectedCalendarDate = $derived.by(() => {
    if ($editDraftFrequency !== 'oneTime') return undefined;
    return parsedEditCalendarDate;
  });

  const draftCalendarMinDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: $formData.customVariableDraft.yearStart,
      yearEndRaw: $formData.customVariableDraft.yearEnd,
      isOneTime: $draftFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear
    }).minDate;
  });

  const draftCalendarMaxDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: $formData.customVariableDraft.yearStart,
      yearEndRaw: $formData.customVariableDraft.yearEnd,
      isOneTime: $draftFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear
    }).maxDate;
  });

  const editCalendarMinDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: $formData.customVariableEditDraft.yearStart,
      yearEndRaw: $formData.customVariableEditDraft.yearEnd,
      isOneTime: $editDraftFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear
    }).minDate;
  });

  const editCalendarMaxDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: $formData.customVariableEditDraft.yearStart,
      yearEndRaw: $formData.customVariableEditDraft.yearEnd,
      isOneTime: $editDraftFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear
    }).maxDate;
  });

  function parseTimingText(input: string) {
    return parseCustomVariableTiming(input, {
      referenceDate: now,
      projectionStartYear: currentYear,
      horizonYears: $formData.yearsToRetirement
    });
  }

  function applyParsedTiming(target: TimingTarget, parsed: ParsedCustomVariableTiming) {
    if (target === 'draft') {
      $draftFrequency = parsed.frequency;
      $formData.customVariableDraft.timingDay = parsed.day;
      $formData.customVariableDraft.timingMonth = parsed.month;
      $formData.customVariableDraft.timingYear = parsed.year;
      $formData.customVariableDraft.yearStart = parsed.yearStart;
      $formData.customVariableDraft.yearEnd = parsed.yearEnd;
      draftTimingInfo = parsed.summary;
      return;
    }

    $editDraftFrequency = parsed.frequency;
    $formData.customVariableEditDraft.timingDay = parsed.day;
    $formData.customVariableEditDraft.timingMonth = parsed.month;
    $formData.customVariableEditDraft.timingYear = parsed.year;
    $formData.customVariableEditDraft.yearStart = parsed.yearStart;
    $formData.customVariableEditDraft.yearEnd = parsed.yearEnd;
    editTimingInfo = parsed.summary;
  }

  const timingParseController = createTimingParseController({
    debounceMs: TIMING_PARSE_DEBOUNCE_MS,
    parse: parseTimingText,
    onParsed: applyParsedTiming,
    onParseError: (target) => {
      if (target === 'draft') {
        draftTimingInfo = TIMING_PARSE_ERROR_MESSAGE;
      } else {
        editTimingInfo = TIMING_PARSE_ERROR_MESSAGE;
      }
    },
    onInfoClear: (target) => {
      if (target === 'draft') {
        draftTimingInfo = null;
      } else {
        editTimingInfo = null;
      }
    }
  });

  function scheduleTimingParse(target: TimingTarget, text: string) {
    timingParseController.schedule(target, text);
  }

  function flushTimingParse(target: TimingTarget, text: string) {
    timingParseController.flush(target, text);
  }

  $effect(() => {
    return () => timingParseController.cleanup();
  });

  function addCustomVariable() {
    const result = buildCreatedCustomVariable({
      name: $formData.customVariableDraft.name,
      type: $draftType,
      amount: $formData.customVariableDraft.amount,
      placement: $draftPlacement,
      timingNaturalText: $draftTimingNaturalText,
      timing: {
        frequency: $draftFrequency,
        day: $formData.customVariableDraft.timingDay,
        month: $formData.customVariableDraft.timingMonth,
        year: $formData.customVariableDraft.timingYear,
        yearStart: $formData.customVariableDraft.yearStart,
        yearEnd: $formData.customVariableDraft.yearEnd
      },
      growth: {
        enabled: $formData.customVariableDraft.growthAmount > 0,
        type: $formData.customVariableDraft.growthType,
        amount: $formData.customVariableDraft.growthAmount,
        cadence: $formData.customVariableDraft.growthCadence
      },
      currentYear,
      horizonYears: $formData.yearsToRetirement,
      referenceDate: now
    });
    if (result.error || !result.variable) {
      submitError = result.error;
      return;
    }

    $formData.customVariables = [...$formData.customVariables, result.variable];
    const draftReset = toDraftResetState(currentYear, $formData.yearsToRetirement);
    $formData.customVariableDraft = draftReset;
    submitError = null;
    draftTimingInfo = null;
    onCommit?.();
  }

  function saveCustomVariable() {
    const editProps = getEditProps();
    if (!editProps) return;

    const result = buildSavedCustomVariable({
      id: editProps.variable.id,
      name: $formData.customVariableEditDraft.name,
      type: $editDraftType,
      amount: $formData.customVariableEditDraft.amount,
      placement: $editDraftPlacement,
      timingNaturalText: $editDraftTimingNaturalText,
      timing: {
        frequency: $editDraftFrequency,
        day: $formData.customVariableEditDraft.timingDay,
        month: $formData.customVariableEditDraft.timingMonth,
        year: $formData.customVariableEditDraft.timingYear,
        yearStart: $formData.customVariableEditDraft.yearStart,
        yearEnd: $formData.customVariableEditDraft.yearEnd
      },
      growth: {
        enabled: $formData.customVariableEditDraft.growthAmount > 0,
        type: $formData.customVariableEditDraft.growthType,
        amount: $formData.customVariableEditDraft.growthAmount,
        cadence: $formData.customVariableEditDraft.growthCadence
      },
      currentYear,
      horizonYears: $formData.yearsToRetirement,
      referenceDate: now
    });
    if (result.error || !result.variable) {
      submitError = result.error;
      return;
    }

    editProps.onSaveVariable(result.variable);
    submitError = null;
  }

  function deleteCustomVariable() {
    const editProps = getEditProps();
    if (!editProps) return;
    editProps.onDeleteVariable();
  }

  function cancelEditCustomVariable() {
    const editProps = getEditProps();
    if (!editProps) return;
    editProps.onCancel();
  }
</script>

<section class="w-full space-y-3 rounded-xl border border-dashed border-border px-4 py-4">
  <h3 class="text-sm font-semibold">
    {mode === 'edit' ? 'Edit custom variable' : 'Add custom variable'}
  </h3>

  <CustomVariableCoreFields
    {form}
    draftPath={mode === 'edit' ? 'customVariableEditDraft' : 'customVariableDraft'}
    inputIdPrefix={mode === 'edit' ? 'edit-custom-variable' : 'custom-variable'}
  />

  {#if mode === 'create'}
    <CustomVariableTimingFields
      {form}
      draftPath="customVariableDraft"
      inputIdPrefix="custom-variable"
      parseTarget="draft"
      {currentYear}
      selectedCalendarDate={draftSelectedCalendarDate}
      calendarMinDate={draftCalendarMinDate}
      calendarMaxDate={draftCalendarMaxDate}
      bind:timingInfo={draftTimingInfo}
      {scheduleTimingParse}
      {flushTimingParse}
      formatDate={formatCustomVariableDate}
    />
  {:else}
    <CustomVariableTimingFields
      {form}
      draftPath="customVariableEditDraft"
      inputIdPrefix="edit-custom-variable"
      parseTarget="edit"
      {currentYear}
      selectedCalendarDate={editSelectedCalendarDate}
      calendarMinDate={editCalendarMinDate}
      calendarMaxDate={editCalendarMaxDate}
      bind:timingInfo={editTimingInfo}
      {scheduleTimingParse}
      {flushTimingParse}
      formatDate={formatCustomVariableDate}
    />
  {/if}

  <Accordion.Root type="single">
    <Accordion.Item value="growth">
      <Accordion.Trigger class="py-3 text-sm font-medium">Growth (optional)</Accordion.Trigger>
      <Accordion.Content class="py-4">
        <CustomVariableGrowthFields
          {form}
          draftPath={mode === 'edit' ? 'customVariableEditDraft' : 'customVariableDraft'}
          inputIdPrefix={mode === 'edit' ? 'edit-custom-variable' : 'custom-variable'}
        />
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>

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
      <Button.Root type="button" variant="outline" class="flex-1" onclick={cancelEditCustomVariable}
        >Cancel</Button.Root
      >
      <Button.Root type="button" class="flex-1" onclick={saveCustomVariable}
        >Save changes</Button.Root
      >
    </div>
    <div class="mt-4 border-t border-border pt-4">
      <Button.Root type="button" variant="destructive" class="w-full" onclick={deleteCustomVariable}
        >Delete</Button.Root
      >
    </div>
  {/if}
</section>
