<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms/client';
  import { fieldProxy } from 'sveltekit-superforms/client';
  import type { DateValue } from '@internationalized/date';
  import * as Form from '$lib/components/ui/form';
  import Calendar29 from '$lib/components/calender/calendar-29.svelte';
  import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';

  type Mode = 'create' | 'edit';
  type CustomVariable = RetirementConfigFormValues['customVariables'][number];

  let {
    form,
    mode = 'create',
    currentYear,
    draftSelectedCalendarDate,
    draftCalendarMinDate,
    draftCalendarMaxDate,
    editSelectedCalendarDate,
    editCalendarMinDate,
    editCalendarMaxDate,
    draftTimingInfo = $bindable<string | null>(null),
    editTimingInfo = $bindable<string | null>(null),
    editTimingNaturalText = $bindable(''),
    editFrequency = $bindable<CustomVariable['frequency']>('monthly'),
    editTimingDay = $bindable(1),
    editTimingMonth = $bindable(1),
    editTimingYear = $bindable(currentYear),
    editYearStart = $bindable(0),
    editYearEnd = $bindable(1),
    scheduleTimingParse,
    flushTimingParse,
    formatDate,
  }: {
    form: SuperForm<RetirementConfigFormValues>;
    mode?: Mode;
    currentYear: number;
    draftSelectedCalendarDate: DateValue | undefined;
    draftCalendarMinDate: DateValue;
    draftCalendarMaxDate: DateValue;
    editSelectedCalendarDate: DateValue | undefined;
    editCalendarMinDate: DateValue;
    editCalendarMaxDate: DateValue;
    draftTimingInfo?: string | null;
    editTimingInfo?: string | null;
    editTimingNaturalText?: string;
    editFrequency?: CustomVariable['frequency'];
    editTimingDay?: number;
    editTimingMonth?: number;
    editTimingYear?: number;
    editYearStart?: number;
    editYearEnd?: number;
    scheduleTimingParse: (target: 'draft' | 'edit', text: string) => void;
    flushTimingParse: (target: 'draft' | 'edit', text: string) => void;
    formatDate: (date: DateValue | undefined) => string;
  } = $props();

  const formData = form.form;
  const draftFrequency = fieldProxy(form, 'customVariableDraft.frequency');
  const draftTimingNaturalText = fieldProxy(form, 'customVariableDraft.timingNaturalText');
</script>

{#if mode === 'create'}
  <Form.Field {form} name="customVariableDraft.timingNaturalText">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="leading-7">Contribution frequency</Form.Label>
        <Calendar29
          id="custom-variable-timing-natural"
          value={$draftTimingNaturalText}
          placeholder="every 15th, every Feb 13, on 1/2/2027, every 15th for 10 years starting in 2028"
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
              return;
            }
            flushTimingParse('draft', $draftTimingNaturalText);
          }}
          onPickDate={(value) => {
            $draftFrequency = 'oneTime';
            $formData.customVariableDraft.timingYear = value.year;
            $formData.customVariableDraft.timingMonth = value.month;
            $formData.customVariableDraft.timingDay = value.day;
            const oneTimeYearOffset = Math.max(0, value.year - currentYear);
            $formData.customVariableDraft.yearStart = oneTimeYearOffset;
            $formData.customVariableDraft.yearEnd = oneTimeYearOffset;
            $draftTimingNaturalText = formatDate(value);
            draftTimingInfo = `Parsed as one-time on ${formatDate(value)}. Applies once in ${String(value.year)}.`;
          }}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  {#if draftTimingInfo}
    <p class="text-xs leading-7 text-muted-foreground">{draftTimingInfo}</p>
  {/if}
{:else}
  <div class="space-y-1.5">
    <label class="leading-7" for="edit-custom-variable-timing-natural">Contribution frequency</label>
    <Calendar29
      id="edit-custom-variable-timing-natural"
      value={editTimingNaturalText}
      placeholder="every 15th, every Feb 13, on 1/2/2027, every 15th for 10 years starting in 2028"
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
        const oneTimeYearOffset = Math.max(0, value.year - currentYear);
        editYearStart = oneTimeYearOffset;
        editYearEnd = oneTimeYearOffset;
        editTimingNaturalText = formatDate(value);
        editTimingInfo = `Parsed as one-time on ${formatDate(value)}. Applies once in ${String(value.year)}.`;
      }}
    />
  </div>
  {#if editTimingInfo}
    <p class="text-xs leading-7 text-muted-foreground">{editTimingInfo}</p>
  {/if}
{/if}
