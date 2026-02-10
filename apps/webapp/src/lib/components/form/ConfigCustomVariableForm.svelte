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
  import {
    parseCustomVariableTiming,
    resolveParsedTimingOrStructured,
    toCustomVariableId,
    validateAndNormalizeCustomVariableInput,
  } from './custom-variable-editor-model';
  import {
    formatCustomVariableDate,
    toCalendarBounds,
    toDraftResetState,
    toEditCustomVariableState,
    toParsedCalendarDate,
  } from './custom-variable-editor-state';
  import { createTimingParseController, type TimingTarget } from './custom-variable-timing-controller';

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
  const draftTimingInputMode = fieldProxy(form, 'customVariableDraft.timingInputMode');
  const draftTimingNaturalText = fieldProxy(form, 'customVariableDraft.timingNaturalText');
  const draftGrowthEnabled = fieldProxy(form, 'customVariableDraft.growthEnabled');
  const draftGrowthType = fieldProxy(form, 'customVariableDraft.growthType');
  const draftGrowthCadence = fieldProxy(form, 'customVariableDraft.growthCadence');

  const now = new Date();
  const currentYear = now.getFullYear();

  let editName = $state('');
  let editType = $state<CustomVariable['type']>('flat');
  let editAmount = $state(0);
  let editFrequency = $state<CustomVariable['frequency']>('monthly');
  let editPlacement = $state<CustomVariable['placement']>('end');
  let editTimingNaturalText = $state('');
  let editTimingDay = $state(1);
  let editTimingMonth = $state(1);
  let editTimingYear = $state(currentYear);
  let editYearStart = $state(0);
  let editYearEnd = $state(1);
  let editGrowthEnabled = $state(false);
  let editGrowthType = $state<CustomVariable['growthType']>('percent');
  let editGrowthAmount = $state(0);
  let editGrowthCadence = $state<CustomVariable['growthCadence']>('annual');
  let loadedEditVariableId = $state<string | null>(null);

  let submitError = $state<string | null>(null);
  let draftTimingInfo = $state<string | null>(null);
  let editTimingInfo = $state<string | null>(null);
  const TIMING_PARSE_DEBOUNCE_MS = 400;

  $effect(() => {
    if (mode !== 'edit' || !variable) {
      loadedEditVariableId = null;
      return;
    }
    if (loadedEditVariableId === variable.id) return;

    const nextEditState = toEditCustomVariableState(variable);
    editName = nextEditState.name;
    editType = nextEditState.type;
    editAmount = nextEditState.amount;
    editFrequency = nextEditState.frequency;
    editPlacement = nextEditState.placement;
    editTimingNaturalText = nextEditState.timingNaturalText;
    editTimingDay = nextEditState.timingDay;
    editTimingMonth = nextEditState.timingMonth;
    editTimingYear = nextEditState.timingYear;
    editYearStart = nextEditState.yearStart;
    editYearEnd = nextEditState.yearEnd;
    editGrowthEnabled = nextEditState.growthEnabled;
    editGrowthType = nextEditState.growthType;
    editGrowthAmount = nextEditState.growthAmount;
    editGrowthCadence = nextEditState.growthCadence;
    loadedEditVariableId = variable.id;
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
      $formData.customVariableDraft.timingDay,
    );
  });

  const parsedEditCalendarDate = $derived.by(() => {
    return toParsedCalendarDate(editTimingYear, editTimingMonth, editTimingDay);
  });

  const draftSelectedCalendarDate = $derived.by(() => {
    if ($draftFrequency !== 'oneTime') return undefined;
    return parsedDraftCalendarDate;
  });

  const editSelectedCalendarDate = $derived.by(() => {
    if (editFrequency !== 'oneTime') return undefined;
    return parsedEditCalendarDate;
  });

  const draftCalendarMinDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: $formData.customVariableDraft.yearStart,
      yearEndRaw: $formData.customVariableDraft.yearEnd,
      isOneTime: $draftFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear,
    }).minDate;
  });

  const draftCalendarMaxDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: $formData.customVariableDraft.yearStart,
      yearEndRaw: $formData.customVariableDraft.yearEnd,
      isOneTime: $draftFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear,
    }).maxDate;
  });

  const editCalendarMinDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: editYearStart,
      yearEndRaw: editYearEnd,
      isOneTime: editFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear,
    }).minDate;
  });

  const editCalendarMaxDate = $derived.by(() => {
    return toCalendarBounds({
      yearStart: editYearStart,
      yearEndRaw: editYearEnd,
      isOneTime: editFrequency === 'oneTime',
      horizonYears: $formData.yearsToRetirement,
      now,
      currentYear,
    }).maxDate;
  });

  function parseTimingText(input: string) {
    return parseCustomVariableTiming(input, {
      referenceDate: now,
      projectionStartYear: currentYear,
      horizonYears: $formData.yearsToRetirement,
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
      editFrequency = parsed.frequency;
      editTimingDay = parsed.day;
      editTimingMonth = parsed.month;
      editTimingYear = parsed.year;
      editYearStart = parsed.yearStart;
      editYearEnd = parsed.yearEnd;
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
    },
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
    const trimmedName = ($draftName ?? '').trim();
    const parsedAmount = $formData.customVariableDraft.amount;
    const contributionType = $draftType;
    const placement = $draftPlacement;
    const timingNaturalText = $draftTimingNaturalText;
    const yearStart = $formData.customVariableDraft.yearStart;
    const yearEnd = $formData.customVariableDraft.yearEnd;
    const growthEnabled = $draftGrowthEnabled;
    const growthType = $draftGrowthType;
    const growthAmount = $formData.customVariableDraft.growthAmount;
    const growthCadence = $draftGrowthCadence;

    if (!trimmedName) {
      submitError = 'Variable name is required.';
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      submitError = 'Amount must be 0 or greater.';
      return;
    }

    const parsedTiming = resolveParsedTimingOrStructured(
      timingNaturalText,
      {
        frequency: $draftFrequency,
        day: $formData.customVariableDraft.timingDay,
        month: $formData.customVariableDraft.timingMonth,
        year: $formData.customVariableDraft.timingYear,
        yearStart: $formData.customVariableDraft.yearStart,
        yearEnd: $formData.customVariableDraft.yearEnd,
      },
      {
        referenceDate: now,
        projectionStartYear: currentYear,
        horizonYears: $formData.yearsToRetirement,
      },
    );

    if (!parsedTiming) {
      submitError = TIMING_PARSE_ERROR_MESSAGE;
      return;
    }

    const { error, normalized } = validateAndNormalizeCustomVariableInput(
      {
        name: trimmedName,
        type: contributionType,
        amount: parsedAmount,
        placement,
        timingNaturalText,
        yearStart,
        yearEnd,
        growthEnabled,
        growthType,
        growthAmount,
        growthCadence,
        parsedTiming,
      },
    );
    if (error || !normalized) {
      submitError = error;
      return;
    }

    const next = $formData.customVariables.slice();
    next.push({
      id: toCustomVariableId(trimmedName),
      ...normalized,
      timingInputMode: 'hybrid',
    });
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
    if (!variable) return;
    if (!editName.trim()) {
      submitError = 'Variable name is required.';
      return;
    }
    if (!Number.isFinite(editAmount) || editAmount < 0) {
      submitError = 'Amount must be 0 or greater.';
      return;
    }

    const parsedTiming = resolveParsedTimingOrStructured(
      editTimingNaturalText,
      {
        frequency: editFrequency,
        day: editTimingDay,
        month: editTimingMonth,
        year: editTimingYear,
        yearStart: editYearStart,
        yearEnd: editYearEnd,
      },
      {
        referenceDate: now,
        projectionStartYear: currentYear,
        horizonYears: $formData.yearsToRetirement,
      },
    );

    if (!parsedTiming) {
      submitError = TIMING_PARSE_ERROR_MESSAGE;
      return;
    }

    const { error, normalized } = validateAndNormalizeCustomVariableInput(
      {
        name: editName,
        type: editType,
        amount: editAmount,
        placement: editPlacement,
        timingNaturalText: editTimingNaturalText,
        yearStart: editYearStart,
        yearEnd: editYearEnd,
        growthEnabled: editGrowthEnabled,
        growthType: editGrowthType,
        growthAmount: editGrowthAmount,
        growthCadence: editGrowthCadence,
        parsedTiming,
      },
    );
    if (error || !normalized) {
      submitError = error;
      return;
    }

    onSaveVariable?.({
      id: variable.id,
      ...normalized,
      timingInputMode: 'hybrid',
    });
    submitError = null;
  }
</script>

<section class="w-full space-y-3 rounded-xl border border-dashed border-border px-4 py-4">
  <h3 class="text-sm font-semibold">{mode === 'edit' ? 'Edit custom variable' : 'Add custom variable'}</h3>

  <CustomVariableCoreFields
    {form}
    {mode}
    bind:editName
    bind:editType
    bind:editAmount
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
    bind:editTimingNaturalText
    bind:editFrequency
    bind:editTimingDay
    bind:editTimingMonth
    bind:editTimingYear
    bind:editYearStart
    bind:editYearEnd
    {scheduleTimingParse}
    {flushTimingParse}
    formatDate={formatCustomVariableDate}
  />

  <CustomVariableGrowthFields
    {form}
    {mode}
    bind:editGrowthEnabled
    bind:editGrowthType
    bind:editGrowthAmount
    bind:editGrowthCadence
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
      <Button.Root type="button" variant="outline" class="flex-1" onclick={onDeleteVariable}>Delete</Button.Root>
      <Button.Root type="button" variant="outline" class="flex-1" onclick={onCancel}>Cancel</Button.Root>
      <Button.Root type="button" class="flex-1" onclick={saveCustomVariable}>Save changes</Button.Root>
    </div>
  {/if}
</section>
