<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import {
    parseCustomVariableTimingText,
    TIMING_PARSE_ERROR_MESSAGE,
  } from '$lib/forms/frequency-nlp';
  import { normalizeCustomVariableInput, validateCustomVariableInput } from '@retirement/calculator';
  import * as Button from '$lib/components/ui/button';
  import CustomVariableCoreFields from './CustomVariableCoreFields.svelte';
  import CustomVariableTimingFields from './CustomVariableTimingFields.svelte';
  import CustomVariableGrowthFields from './CustomVariableGrowthFields.svelte';

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
  let draftParseDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let editParseDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  const TIMING_PARSE_DEBOUNCE_MS = 400;

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
    editTimingNaturalText = variable.timingNaturalText;
    editTimingDay = variable.timingDay;
    editTimingMonth = variable.timingMonth;
    editTimingYear = variable.timingYear;
    editYearStart = variable.yearStart;
    editYearEnd = variable.yearEnd;
    editGrowthEnabled = variable.growthEnabled;
    editGrowthType = variable.growthType;
    editGrowthAmount = variable.growthAmount;
    editGrowthCadence = variable.growthCadence;
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
    const year = $formData.customVariableDraft.timingYear;
    const month = $formData.customVariableDraft.timingMonth;
    const day = $formData.customVariableDraft.timingDay;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
    return new CalendarDate(Math.trunc(year), Math.trunc(month), Math.trunc(day));
  });

  const parsedEditCalendarDate = $derived.by(() => {
    if (!Number.isFinite(editTimingYear) || !Number.isFinite(editTimingMonth) || !Number.isFinite(editTimingDay)) {
      return undefined;
    }
    return new CalendarDate(Math.trunc(editTimingYear), Math.trunc(editTimingMonth), Math.trunc(editTimingDay));
  });

  const draftSelectedCalendarDate = $derived.by(() => {
    if ($draftFrequency !== 'oneTime') return undefined;
    return parsedDraftCalendarDate;
  });

  const editSelectedCalendarDate = $derived.by(() => {
    if (editFrequency !== 'oneTime') return undefined;
    return parsedEditCalendarDate;
  });

  function toYearOffset(value: unknown, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Math.max(0, Math.trunc(fallback));
    return Math.max(0, Math.trunc(parsed));
  }

  function toStartBoundDate(yearOffset: unknown) {
    const startOffset = toYearOffset(yearOffset);
    if (startOffset === 0) {
      return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }
    return new CalendarDate(currentYear + startOffset, 1, 1);
  }

  function toEndBoundDate(yearOffset: unknown, fallback = 0) {
    const endOffset = toYearOffset(yearOffset, fallback);
    return new CalendarDate(currentYear + endOffset, 12, 31);
  }

  const draftCalendarMinDate = $derived.by(() => toStartBoundDate($formData.customVariableDraft.yearStart));

  const draftCalendarMaxDate = $derived.by(() => {
    const startOffset = toYearOffset($formData.customVariableDraft.yearStart);
    const endOffsetRaw = $draftFrequency === 'oneTime'
      ? $formData.yearsToRetirement
      : $formData.customVariableDraft.yearEnd;
    const endOffset = Math.max(startOffset, toYearOffset(endOffsetRaw, startOffset));
    return toEndBoundDate(endOffset, startOffset);
  });

  const editCalendarMinDate = $derived.by(() => toStartBoundDate(editYearStart));

  const editCalendarMaxDate = $derived.by(() => {
    const startOffset = toYearOffset(editYearStart);
    const endOffsetRaw = editFrequency === 'oneTime' ? $formData.yearsToRetirement : editYearEnd;
    const endOffset = Math.max(startOffset, toYearOffset(endOffsetRaw, startOffset));
    return toEndBoundDate(endOffset, startOffset);
  });

  function formatDate(date: DateValue | undefined) {
    if (!date) return '';
    return date.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function toCustomId(name: string) {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const token = Math.random().toString(36).slice(2, 8);
    return `custom-${slug || 'variable'}-${token}`;
  }

  function parseTimingText(input: string) {
    return parseCustomVariableTimingText(input, {
      referenceDate: now,
      projectionStartYear: currentYear,
      horizonYears: $formData.yearsToRetirement,
    });
  }

  function toFiniteNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseTimingTextOrUseStructured(
    input: string,
    fallback: {
      frequency: CustomVariable['frequency'];
      day: number;
      month: number;
      year: number;
      yearStart: number;
      yearEnd: number;
    },
  ) {
    const parsed = parseTimingText(input);
    if (parsed) return parsed;
    if (input.trim().length > 0) return null;

    return {
      ...fallback,
      day: toFiniteNumber(fallback.day, 1),
      month: toFiniteNumber(fallback.month, 1),
      year: toFiniteNumber(fallback.year, currentYear),
      yearStart: toFiniteNumber(fallback.yearStart, 0),
      yearEnd: toFiniteNumber(fallback.yearEnd, Math.max(0, $formData.yearsToRetirement)),
      summary: '',
    };
  }

  function applyParsedTiming(
    target: 'draft' | 'edit',
    text: string,
    options?: { silentOnFailure?: boolean },
  ) {
    const parsed = parseTimingText(text);
    if (!parsed) {
      if (options?.silentOnFailure) return;
      if (target === 'draft') {
        draftTimingInfo = TIMING_PARSE_ERROR_MESSAGE;
      } else {
        editTimingInfo = TIMING_PARSE_ERROR_MESSAGE;
      }
      return;
    }

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

  function scheduleTimingParse(target: 'draft' | 'edit', text: string) {
    const trimmed = text.trim();

    if (target === 'draft') {
      if (draftParseDebounceTimer) {
        clearTimeout(draftParseDebounceTimer);
        draftParseDebounceTimer = null;
      }
      if (trimmed.length < 4) {
        draftTimingInfo = null;
        return;
      }
      draftParseDebounceTimer = setTimeout(() => {
        applyParsedTiming('draft', text, { silentOnFailure: true });
        draftParseDebounceTimer = null;
      }, TIMING_PARSE_DEBOUNCE_MS);
      return;
    }

    if (editParseDebounceTimer) {
      clearTimeout(editParseDebounceTimer);
      editParseDebounceTimer = null;
    }
    if (trimmed.length < 4) {
      editTimingInfo = null;
      return;
    }
    editParseDebounceTimer = setTimeout(() => {
      applyParsedTiming('edit', text, { silentOnFailure: true });
      editParseDebounceTimer = null;
    }, TIMING_PARSE_DEBOUNCE_MS);
  }

  function flushTimingParse(target: 'draft' | 'edit', text: string) {
    if (target === 'draft') {
      if (draftParseDebounceTimer) {
        clearTimeout(draftParseDebounceTimer);
        draftParseDebounceTimer = null;
      }
      applyParsedTiming('draft', text);
      return;
    }

    if (editParseDebounceTimer) {
      clearTimeout(editParseDebounceTimer);
      editParseDebounceTimer = null;
    }
    applyParsedTiming('edit', text);
  }

  $effect(() => {
    return () => {
      if (draftParseDebounceTimer) clearTimeout(draftParseDebounceTimer);
      if (editParseDebounceTimer) clearTimeout(editParseDebounceTimer);
    };
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

    const parsedTiming = parseTimingTextOrUseStructured(timingNaturalText, {
      frequency: $draftFrequency,
      day: $formData.customVariableDraft.timingDay,
      month: $formData.customVariableDraft.timingMonth,
      year: $formData.customVariableDraft.timingYear,
      yearStart: $formData.customVariableDraft.yearStart,
      yearEnd: $formData.customVariableDraft.yearEnd,
    });

    if (!parsedTiming) {
      submitError = TIMING_PARSE_ERROR_MESSAGE;
      return;
    }

    const validationError = validateCustomVariableInput(
      {
        name: trimmedName,
        amount: parsedAmount,
        yearStart: parsedTiming.yearStart,
        yearEnd: parsedTiming.yearEnd,
        growthEnabled,
        growthAmount,
      },
      {
        frequency: parsedTiming.frequency,
        day: parsedTiming.day,
        month: parsedTiming.month,
        year: parsedTiming.year,
      },
    );
    if (validationError) {
      submitError = validationError;
      return;
    }

    const normalized = normalizeCustomVariableInput(
      {
        name: trimmedName,
        type: contributionType,
        amount: parsedAmount,
        placement,
        timingNaturalText,
        yearStart: parsedTiming.yearStart,
        yearEnd: parsedTiming.yearEnd,
        growthEnabled,
        growthType,
        growthAmount,
        growthCadence
      },
      {
        frequency: parsedTiming.frequency,
        day: parsedTiming.day,
        month: parsedTiming.month,
        year: parsedTiming.year,
      },
    );

    const next = $formData.customVariables.slice();
    next.push({
      id: toCustomId(trimmedName),
      ...normalized,
      timingInputMode: 'hybrid',
    });
    $formData.customVariables = next;

    $draftName = '';
    $formData.customVariableDraft.amount = 0;
    $draftType = 'flat';
    $draftFrequency = 'monthly';
    $draftPlacement = 'end';
    $draftTimingInputMode = 'hybrid';
    $draftTimingNaturalText = '';
    $formData.customVariableDraft.timingDay = 1;
    $formData.customVariableDraft.timingMonth = 1;
    $formData.customVariableDraft.timingYear = currentYear;
    $formData.customVariableDraft.yearStart = 0;
    $formData.customVariableDraft.yearEnd = $formData.yearsToRetirement;
    $draftGrowthEnabled = false;
    $draftGrowthType = 'percent';
    $formData.customVariableDraft.growthAmount = 0;
    $draftGrowthCadence = 'annual';
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

    const parsedTiming = parseTimingTextOrUseStructured(editTimingNaturalText, {
      frequency: editFrequency,
      day: editTimingDay,
      month: editTimingMonth,
      year: editTimingYear,
      yearStart: editYearStart,
      yearEnd: editYearEnd,
    });

    if (!parsedTiming) {
      submitError = TIMING_PARSE_ERROR_MESSAGE;
      return;
    }

    const validationError = validateCustomVariableInput(
      {
        name: editName,
        amount: editAmount,
        yearStart: parsedTiming.yearStart,
        yearEnd: parsedTiming.yearEnd,
        growthEnabled: editGrowthEnabled,
        growthAmount: editGrowthAmount,
      },
      {
        frequency: parsedTiming.frequency,
        day: parsedTiming.day,
        month: parsedTiming.month,
        year: parsedTiming.year,
      },
    );
    if (validationError) {
      submitError = validationError;
      return;
    }

    const normalized = normalizeCustomVariableInput(
      {
        name: editName,
        type: editType,
        amount: editAmount,
        placement: editPlacement,
        timingNaturalText: editTimingNaturalText,
        yearStart: parsedTiming.yearStart,
        yearEnd: parsedTiming.yearEnd,
        growthEnabled: editGrowthEnabled,
        growthType: editGrowthType,
        growthAmount: editGrowthAmount,
        growthCadence: editGrowthCadence
      },
      {
        frequency: parsedTiming.frequency,
        day: parsedTiming.day,
        month: parsedTiming.month,
        year: parsedTiming.year,
      },
    );

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
    {formatDate}
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
