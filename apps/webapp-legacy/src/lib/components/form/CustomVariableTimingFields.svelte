<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { DateValue } from '@internationalized/date';
  import * as Form from '$lib/components/ui/form';
  import Calendar29 from '$lib/components/calender/calendar-29.svelte';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type DraftPath = 'customVariableDraft' | 'customVariableEditDraft';
  type Frequency = RetirementConfigFormValues['customVariables'][number]['frequency'];
  type FrequencyFieldPath = 'customVariableDraft.frequency' | 'customVariableEditDraft.frequency';
  type TimingNaturalFieldPath =
    | 'customVariableDraft.timingNaturalText'
    | 'customVariableEditDraft.timingNaturalText';

  /* eslint-disable no-unused-vars */
  let {
    form,
    draftPath = 'customVariableDraft',
    inputIdPrefix = 'custom-variable',
    parseTarget = 'draft',
    currentYear,
    selectedCalendarDate,
    calendarMinDate,
    calendarMaxDate,
    timingInfo = $bindable<string | null>(null),
    scheduleTimingParse,
    flushTimingParse,
    formatDate
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    draftPath?: DraftPath;
    inputIdPrefix?: string;
    parseTarget?: 'draft' | 'edit';
    currentYear: number;
    selectedCalendarDate: DateValue | undefined;
    calendarMinDate: DateValue;
    calendarMaxDate: DateValue;
    timingInfo?: string | null;
    scheduleTimingParse(target: 'draft' | 'edit', text: string): void;
    flushTimingParse(target: 'draft' | 'edit', text: string): void;
    formatDate(date: DateValue | undefined): string;
  } = $props();
  /* eslint-enable no-unused-vars */

  const formData = form.form;
  const draftFrequency = fieldProxy(form, `${draftPath}.frequency` as FrequencyFieldPath);
  const draftTimingNaturalText = fieldProxy(
    form,
    `${draftPath}.timingNaturalText` as TimingNaturalFieldPath
  );
  const timingNaturalFieldName = `${draftPath}.timingNaturalText` as TimingNaturalFieldPath;

  function applyPickedDate(value: DateValue) {
    const oneTimeYearOffset = Math.max(0, value.year - currentYear);
    if (draftPath === 'customVariableDraft') {
      $formData.customVariableDraft.timingYear = value.year;
      $formData.customVariableDraft.timingMonth = value.month;
      $formData.customVariableDraft.timingDay = value.day;
      $formData.customVariableDraft.yearStart = oneTimeYearOffset;
      $formData.customVariableDraft.yearEnd = oneTimeYearOffset;
    } else {
      $formData.customVariableEditDraft.timingYear = value.year;
      $formData.customVariableEditDraft.timingMonth = value.month;
      $formData.customVariableEditDraft.timingDay = value.day;
      $formData.customVariableEditDraft.yearStart = oneTimeYearOffset;
      $formData.customVariableEditDraft.yearEnd = oneTimeYearOffset;
    }
  }
</script>

<Form.Field {form} name={timingNaturalFieldName}>
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label class="leading-7">Contribution frequency</Form.Label>
      <Calendar29
        id={`${inputIdPrefix}-timing-natural`}
        value={$draftTimingNaturalText}
        placeholder="every 15th, every Feb 13, on 1/2/2027, every 15th for 10 years starting in 2028"
        showCalendar={true}
        inputProps={props}
        selectedDate={selectedCalendarDate}
        minDate={calendarMinDate}
        maxDate={calendarMaxDate}
        onInputValue={(next) => {
          $draftTimingNaturalText = next;
          scheduleTimingParse(parseTarget, next);
        }}
        onBlurValue={() => {
          const trimmed = $draftTimingNaturalText.trim();
          if (trimmed.length === 0) {
            timingInfo = null;
            return;
          }
          flushTimingParse(parseTarget, $draftTimingNaturalText);
        }}
        onPickDate={(value) => {
          $draftFrequency = 'oneTime' as Frequency;
          applyPickedDate(value);
          $draftTimingNaturalText = formatDate(value);
          timingInfo = `Parsed as one-time on ${formatDate(value)}. Applies once in ${String(value.year)}.`;
        }}
      />
    {/snippet}
  </Form.Control>
  <Form.FieldErrors />
</Form.Field>
{#if timingInfo}
  <p class="text-xs leading-7 text-muted-foreground">{timingInfo}</p>
{/if}
