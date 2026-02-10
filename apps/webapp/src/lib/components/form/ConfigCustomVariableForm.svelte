<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import { parseDate } from 'chrono-node';
  import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
  import * as Form from '$lib/components/ui/form';
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
  import { Input } from '$lib/components/ui/input';
  import * as Button from '$lib/components/ui/button';
  import * as Toggle from '$lib/components/ui/toggle';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import Calendar29 from '$lib/components/calender/calendar-29.svelte';
  import ConfigNumericField from './ConfigNumericField.svelte';

  type Mode = 'create' | 'edit';
  type CustomVariable = RetirementConfigFormValues['customVariables'][number];

  const MONTH_LOOKUP: Record<string, number> = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sept: 9,
    sep: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
  };

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
  let draftShowYearRange = $state(false);
  let editTimingInfo = $state<string | null>(null);
  let draftParseDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let editParseDebounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  const TIMING_PARSE_DEBOUNCE_MS = 400;
  const TIMING_PARSE_ERROR_MESSAGE = 'Unable to parse that contribution frequency. Try "every 15th", "every Feb 13", or "on 1/2/2027".';

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

  function validateValues(
    name: string,
    amount: number,
    frequency: CustomVariable['frequency'],
    timingDay: number,
    timingMonth: number,
    timingYear: number,
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
    if (!Number.isFinite(timingDay) || timingDay < 1 || timingDay > 31) {
      return 'Day must be between 1 and 31.';
    }
    if ((frequency === 'annual' || frequency === 'oneTime') && (!Number.isFinite(timingMonth) || timingMonth < 1 || timingMonth > 12)) {
      return 'Month must be between 1 and 12.';
    }
    if (frequency === 'oneTime' && (!Number.isFinite(timingYear) || timingYear < 2000 || timingYear > 2200)) {
      return 'Year must be between 2000 and 2200.';
    }
    if (growthEnabled && (!Number.isFinite(growthAmount) || growthAmount < 0)) {
      return 'Growth amount must be 0 or greater.';
    }
    return null;
  }

  function parseTimingText(input: string) {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return null;

    const monthlyMatch = normalized.match(/^(?:every|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of\s+every\s+month)?$/);
    if (monthlyMatch) {
      const day = Number.parseInt(monthlyMatch[1], 10);
      if (day >= 1 && day <= 31) {
        return {
          frequency: 'monthly' as const,
          day,
          month: 1,
          year: currentYear,
          summary: `Parsed as monthly on day ${String(day)}.`
        };
      }
    }

    const annualMatch = normalized.match(/^(?:every|on)\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
    if (annualMatch) {
      const monthToken = annualMatch[1];
      const month = MONTH_LOOKUP[monthToken];
      const day = Number.parseInt(annualMatch[2], 10);
      if (month && day >= 1 && day <= 31) {
        return {
          frequency: 'annual' as const,
          day,
          month,
          year: currentYear,
          summary: `Parsed as annual on ${monthToken} ${String(day)}.`
        };
      }
    }

    const parsed = parseDate(input);
    if (parsed) {
      const formatted = parsed.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      return {
        frequency: 'oneTime' as const,
        day: parsed.getDate(),
        month: parsed.getMonth() + 1,
        year: parsed.getFullYear(),
        summary: `Parsed as one-time on ${formatted}.`
      };
    }

    return null;
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
      draftTimingInfo = parsed.summary;
    } else {
      editFrequency = parsed.frequency;
      editTimingDay = parsed.day;
      editTimingMonth = parsed.month;
      editTimingYear = parsed.year;
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

    const parsedTiming = parseTimingText(timingNaturalText);

    if (!parsedTiming) {
      submitError = TIMING_PARSE_ERROR_MESSAGE;
      return;
    }

    const frequency = parsedTiming.frequency;
    const timingDay = parsedTiming.day;
    const timingMonth = parsedTiming.month;
    const timingYear = parsedTiming.year;

    const validationError = validateValues(
      trimmedName,
      parsedAmount,
      frequency,
      timingDay,
      timingMonth,
      timingYear,
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
      timingInputMode: 'hybrid',
      timingNaturalText,
      timingDay: Math.max(1, Math.min(31, Math.trunc(timingDay))),
      timingMonth: Math.max(1, Math.min(12, Math.trunc(timingMonth))),
      timingYear: Math.max(2000, Math.min(2200, Math.trunc(timingYear))),
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
    draftShowYearRange = false;
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

    const parsedTiming = parseTimingText(editTimingNaturalText);

    if (!parsedTiming) {
      submitError = TIMING_PARSE_ERROR_MESSAGE;
      return;
    }

    const frequency = parsedTiming.frequency;
    const timingDay = parsedTiming.day;
    const timingMonth = parsedTiming.month;
    const timingYear = parsedTiming.year;

    const validationError = validateValues(
      editName,
      editAmount,
      frequency,
      timingDay,
      timingMonth,
      timingYear,
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
      frequency,
      placement: editPlacement,
      timingInputMode: 'hybrid',
      timingNaturalText: editTimingNaturalText,
      timingDay: Math.max(1, Math.min(31, Math.trunc(timingDay))),
      timingMonth: Math.max(1, Math.min(12, Math.trunc(timingMonth))),
      timingYear: Math.max(2000, Math.min(2200, Math.trunc(timingYear))),
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

  {#snippet timingFieldsCreate()}
    <Form.Field {form} name="customVariableDraft.timingNaturalText">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label class="text-xs leading-7 text-muted-foreground">Contribution frequency</Form.Label>
          <Calendar29
            id="custom-variable-timing-natural"
            value={$draftTimingNaturalText}
            placeholder="every 15th, every Feb 13, on 1/2/2027"
            showCalendar={true}
            inputProps={props}
            selectedDate={draftSelectedCalendarDate}
            minDate={draftCalendarMinDate}
            maxDate={draftCalendarMaxDate}
            onInputValue={(next) => {
              $draftTimingNaturalText = next;
              scheduleTimingParse('draft', next);
            }}
            onBlurValue={() => {
              const trimmed = $draftTimingNaturalText.trim();
              if (trimmed.length === 0) {
                draftTimingInfo = null;
                draftShowYearRange = false;
                return;
              }
              flushTimingParse('draft', $draftTimingNaturalText);
              const parsed = parseTimingText($draftTimingNaturalText);
              draftShowYearRange = Boolean(parsed && parsed.frequency !== 'oneTime');
            }}
            onPickDate={(value) => {
              $draftFrequency = 'oneTime';
              $formData.customVariableDraft.timingYear = value.year;
              $formData.customVariableDraft.timingMonth = value.month;
              $formData.customVariableDraft.timingDay = value.day;
              $draftTimingNaturalText = formatDate(value);
              draftTimingInfo = `Parsed as one-time on ${formatDate(value)}.`;
              draftShowYearRange = false;
            }}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    {#if draftTimingInfo}
      <p class="text-xs leading-7 text-muted-foreground">{draftTimingInfo}</p>
    {/if}

  {/snippet}

  {#snippet timingFieldsEdit()}
    <div class="space-y-1.5">
      <label class="text-xs font-medium leading-7 text-muted-foreground" for="edit-custom-variable-timing-natural">Contribution frequency</label>
      <Calendar29
        id="edit-custom-variable-timing-natural"
        value={editTimingNaturalText}
        placeholder="every 15th, every Feb 13, on 1/2/2027"
        showCalendar={true}
        selectedDate={editSelectedCalendarDate}
        minDate={editCalendarMinDate}
        maxDate={editCalendarMaxDate}
        onInputValue={(next) => {
          editTimingNaturalText = next;
          scheduleTimingParse('edit', next);
        }}
        onBlurValue={() => {
          if (editTimingNaturalText.trim().length === 0) {
            editTimingInfo = null;
            return;
          }
          flushTimingParse('edit', editTimingNaturalText);
        }}
        onPickDate={(value) => {
          editFrequency = 'oneTime';
          editTimingYear = value.year;
          editTimingMonth = value.month;
          editTimingDay = value.day;
          editTimingNaturalText = formatDate(value);
          editTimingInfo = `Parsed as one-time on ${formatDate(value)}.`;
        }}
      />
    </div>
    {#if editTimingInfo}
      <p class="text-xs leading-7 text-muted-foreground">{editTimingInfo}</p>
    {/if}

  {/snippet}

  {#snippet draftGrowthSection()}
    <div class="space-y-2 rounded-md border border-border/70 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-medium leading-7 text-muted-foreground">Growth (optional)</p>
        <Toggle.Root bind:pressed={$draftGrowthEnabled} variant="outline" size="sm">
          {$draftGrowthEnabled ? 'Enabled' : 'Disabled'}
        </Toggle.Root>
      </div>
      {#if $draftGrowthEnabled}
        <Form.Field {form} name="customVariableDraft.growthType">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label class="text-xs leading-7 text-muted-foreground">Increment type</Form.Label>
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
              <Form.Label class="text-xs leading-7 text-muted-foreground">Cadence</Form.Label>
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
        <p class="text-xs font-medium leading-7 text-muted-foreground">Growth (optional)</p>
        <Toggle.Root bind:pressed={editGrowthEnabled} variant="outline" size="sm">
          {editGrowthEnabled ? 'Enabled' : 'Disabled'}
        </Toggle.Root>
      </div>
      {#if editGrowthEnabled}
        <div class="space-y-1.5">
          <span class="text-xs font-medium leading-7 text-muted-foreground">Increment type</span>
          <ToggleGroup.Root type="single" bind:value={editGrowthType} variant="outline" class="w-full">
            <ToggleGroup.Item value="percent" class="flex-grow-2">Percent %</ToggleGroup.Item>
            <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium leading-7 text-muted-foreground" for="edit-custom-variable-growth-amount">
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
          <span class="text-xs font-medium leading-7 text-muted-foreground">Cadence</span>
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
          <Form.Label class="text-xs leading-7 text-muted-foreground">Variable name</Form.Label>
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
          <Form.Label class="text-xs leading-7 text-muted-foreground">Type</Form.Label>
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

    {@render timingFieldsCreate()}

    {#if draftShowYearRange}
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
    {/if}

    {@render draftGrowthSection()}
  {:else}
    <div class="space-y-1.5">
      <label class="text-xs font-medium leading-7 text-muted-foreground" for="edit-custom-variable-name"
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
      <span class="text-xs font-medium leading-7 text-muted-foreground">Type</span>
      <ToggleGroup.Root type="single" bind:value={editType} variant="outline" class="w-full">
        <ToggleGroup.Item value="salaryPercent" class="flex-grow-2">Percent %</ToggleGroup.Item>
        <ToggleGroup.Item value="flat" class="flex-grow-2">Amount $</ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>

    <div class="space-y-1.5">
      <label class="text-xs font-medium leading-7 text-muted-foreground" for="edit-custom-variable-amount">
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

    {@render timingFieldsEdit()}

    {#if editFrequency !== 'oneTime'}
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <label class="text-xs font-medium leading-7 text-muted-foreground" for="edit-custom-variable-year-start"
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
          <label class="text-xs font-medium leading-7 text-muted-foreground" for="edit-custom-variable-year-end"
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
    {/if}

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
