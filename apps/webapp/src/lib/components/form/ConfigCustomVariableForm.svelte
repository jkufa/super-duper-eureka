<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { ParsedCustomVariableTiming } from '$lib/forms/frequency-nlp';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import { TIMING_PARSE_ERROR_MESSAGE } from '$lib/forms/frequency-nlp';
  import * as Button from '$lib/components/ui/button';
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
    toEditCustomVariableState,
    toParsedCalendarDate
  } from './custom-variable-editor-state';
  import {
    createTimingParseController,
    type TimingTarget
  } from './custom-variable-timing-controller';

  type Mode = 'create' | 'edit';
  type CustomVariable = RetirementConfigFormValues['customVariables'][number];
  type EditCustomVariableFormState = {
    name: string;
    type: CustomVariable['type'];
    amount: number;
    frequency: CustomVariable['frequency'];
    placement: CustomVariable['placement'];
    timingNaturalText: string;
    timingDay: number;
    timingMonth: number;
    timingYear: number;
    yearStart: number;
    yearEnd: number;
    growthEnabled: boolean;
    growthType: CustomVariable['growthType'];
    growthAmount: number;
    growthCadence: CustomVariable['growthCadence'];
    loadedVariableId: string | null;
  };
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
  const draftName = fieldProxy(form, 'customVariableDraft.name');
  const draftType = fieldProxy(form, 'customVariableDraft.type');
  const draftFrequency = fieldProxy(form, 'customVariableDraft.frequency');
  const draftPlacement = fieldProxy(form, 'customVariableDraft.placement');
  const draftTimingInputMode = fieldProxy(form, 'customVariableDraft.timingInputMode');
  const draftTimingNaturalText = fieldProxy(form, 'customVariableDraft.timingNaturalText');
  const draftGrowthEnabled = fieldProxy(form, 'customVariableDraft.growthEnabled');
  const draftGrowthType = fieldProxy(form, 'customVariableDraft.growthType');
  const draftGrowthCadence = fieldProxy(form, 'customVariableDraft.growthCadence');

  const now = new Date();
  const currentYear = now.getFullYear();

  let edit = $state<EditCustomVariableFormState>({
    name: '',
    type: 'flat',
    amount: 0,
    frequency: 'monthly',
    placement: 'end',
    timingNaturalText: '',
    timingDay: 1,
    timingMonth: 1,
    timingYear: currentYear,
    yearStart: 0,
    yearEnd: 1,
    growthEnabled: false,
    growthType: 'percent',
    growthAmount: 0,
    growthCadence: 'annual',
    loadedVariableId: null
  });

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
      edit.loadedVariableId = null;
      return;
    }
    const variable = editProps.variable;
    if (edit.loadedVariableId === variable.id) return;

    const nextEditState = toEditCustomVariableState(variable);
    edit = {
      ...edit,
      ...nextEditState,
      loadedVariableId: variable.id
    };
    editTimingInfo = null;
    submitError = null;
  });

  $effect(() => {
    if ($draftTimingInputMode !== 'hybrid') {
      $draftTimingInputMode = 'hybrid';
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
    return toParsedCalendarDate(edit.timingYear, edit.timingMonth, edit.timingDay);
  });

  const draftSelectedCalendarDate = $derived.by(() => {
    if ($draftFrequency !== 'oneTime') return undefined;
    return parsedDraftCalendarDate;
  });

  const editSelectedCalendarDate = $derived.by(() => {
    if (edit.frequency !== 'oneTime') return undefined;
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
      yearStart: edit.yearStart,
      yearEndRaw: edit.yearEnd,
      isOneTime: edit.frequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear
    }).minDate;
  });

  const editCalendarMaxDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: edit.yearStart,
      yearEndRaw: edit.yearEnd,
      isOneTime: edit.frequency === 'oneTime',
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
    } else {
      edit.frequency = parsed.frequency;
      edit.timingDay = parsed.day;
      edit.timingMonth = parsed.month;
      edit.timingYear = parsed.year;
      edit.yearStart = parsed.yearStart;
      edit.yearEnd = parsed.yearEnd;
      editTimingInfo = parsed.summary;
    }
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
      name: $draftName ?? '',
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
        enabled: $draftGrowthEnabled,
        type: $draftGrowthType,
        amount: $formData.customVariableDraft.growthAmount,
        cadence: $draftGrowthCadence
      },
      currentYear,
      horizonYears: $formData.yearsToRetirement,
      referenceDate: now
    });
    if (result.error || !result.variable) {
      submitError = result.error;
      return;
    }

    const next = $formData.customVariables.slice();
    next.push(result.variable);
    $formData.customVariables = next;

    $draftName = '';
    const draftReset = toDraftResetState(currentYear, $formData.yearsToRetirement);
    $formData.customVariableDraft.amount = draftReset.amount;
    $draftType = draftReset.type;
    $draftFrequency = draftReset.frequency;
    $draftPlacement = draftReset.placement;
    $draftTimingInputMode = draftReset.timingInputMode;
    $draftTimingNaturalText = draftReset.timingNaturalText;
    $formData.customVariableDraft.timingDay = draftReset.timingDay;
    $formData.customVariableDraft.timingMonth = draftReset.timingMonth;
    $formData.customVariableDraft.timingYear = draftReset.timingYear;
    $formData.customVariableDraft.yearStart = draftReset.yearStart;
    $formData.customVariableDraft.yearEnd = draftReset.yearEnd;
    $draftGrowthEnabled = draftReset.growthEnabled;
    $draftGrowthType = draftReset.growthType;
    $formData.customVariableDraft.growthAmount = draftReset.growthAmount;
    $draftGrowthCadence = draftReset.growthCadence;
    submitError = null;
    draftTimingInfo = null;
    onCommit?.();
  }

  function saveCustomVariable() {
    const editProps = getEditProps();
    if (!editProps) return;

    const result = buildSavedCustomVariable({
      id: editProps.variable.id,
      name: edit.name,
      type: edit.type,
      amount: edit.amount,
      placement: edit.placement,
      timingNaturalText: edit.timingNaturalText,
      timing: {
        frequency: edit.frequency,
        day: edit.timingDay,
        month: edit.timingMonth,
        year: edit.timingYear,
        yearStart: edit.yearStart,
        yearEnd: edit.yearEnd
      },
      growth: {
        enabled: edit.growthEnabled,
        type: edit.growthType,
        amount: edit.growthAmount,
        cadence: edit.growthCadence
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
    {mode}
    bind:editName={edit.name}
    bind:editType={edit.type}
    bind:editAmount={edit.amount}
  />

  <CustomVariableTimingFields
    {form}
    {mode}
    {currentYear}
    {draftSelectedCalendarDate}
    {draftCalendarMinDate}
    {draftCalendarMaxDate}
    {editSelectedCalendarDate}
    {editCalendarMinDate}
    {editCalendarMaxDate}
    bind:draftTimingInfo
    bind:editTimingInfo
    bind:editTimingNaturalText={edit.timingNaturalText}
    bind:editFrequency={edit.frequency}
    bind:editTimingDay={edit.timingDay}
    bind:editTimingMonth={edit.timingMonth}
    bind:editTimingYear={edit.timingYear}
    bind:editYearStart={edit.yearStart}
    bind:editYearEnd={edit.yearEnd}
    {scheduleTimingParse}
    {flushTimingParse}
    formatDate={formatCustomVariableDate}
  />

  <CustomVariableGrowthFields
    {form}
    {mode}
    bind:editGrowthEnabled={edit.growthEnabled}
    bind:editGrowthType={edit.growthType}
    bind:editGrowthAmount={edit.growthAmount}
    bind:editGrowthCadence={edit.growthCadence}
  />

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
      <Button.Root type="button" variant="outline" class="flex-1" onclick={deleteCustomVariable}
        >Delete</Button.Root
      >
      <Button.Root type="button" variant="outline" class="flex-1" onclick={cancelEditCustomVariable}
        >Cancel</Button.Root
      >
      <Button.Root type="button" class="flex-1" onclick={saveCustomVariable}
        >Save changes</Button.Root
      >
    </div>
  {/if}
</section>
