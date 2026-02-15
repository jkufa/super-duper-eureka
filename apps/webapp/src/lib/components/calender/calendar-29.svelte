<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import { parseDate } from 'chrono-node';
  import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date';

  function formatDate(date: DateValue | undefined) {
    if (!date) return '';

    return date.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  /* eslint-disable no-unused-vars */
  let {
    id,
    value = $bindable(''),
    placeholder = 'Tomorrow or next week',
    showCalendar = true,
    inputProps,
    selectedDate,
    minDate,
    maxDate,
    onInputValue,
    onBlurValue,
    onPickDate
  }: {
    id: string;
    value?: string;
    placeholder?: string;
    showCalendar?: boolean;
    inputProps?: Omit<HTMLInputAttributes, 'type' | 'files' | 'id' | 'value' | 'placeholder'>;
    selectedDate?: DateValue;
    minDate?: DateValue;
    maxDate?: DateValue;
    onInputValue?(next: string): void;
    onBlurValue?: () => void;
    onPickDate?(next: DateValue): void;
  } = $props();
  /* eslint-enable no-unused-vars */

  let open = $state(false);

  const calendarValue = $derived.by(() => {
    if (selectedDate) return selectedDate;
    const parsed = parseDate(value);
    if (!parsed) return undefined;
    return new CalendarDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  });

  const calendarPlaceholder = $derived.by(() => {
    if (calendarValue) return calendarValue;

    let anchorDate: DateValue = today(getLocalTimeZone());
    if (minDate && anchorDate.compare(minDate) < 0) {
      anchorDate = minDate;
    }
    if (maxDate && anchorDate.compare(maxDate) > 0) {
      anchorDate = maxDate;
    }
    return anchorDate;
  });
</script>

<div class="relative flex gap-2">
  <Input
    {...inputProps}
    {id}
    type="text"
    {value}
    {placeholder}
    class={showCalendar ? 'bg-background pe-10' : 'bg-background'}
    oninput={(event) => {
      const next = (event.currentTarget as HTMLInputElement).value;
      value = next;
      onInputValue?.(next);
    }}
    onblur={() => {
      onBlurValue?.();
    }}
    onkeydown={(e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        open = true;
      }
    }}
  />
  {#if showCalendar}
    <Popover.Root bind:open>
      <Popover.Trigger id={`${id}-date-picker`}>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" class="absolute end-2 top-1/2 size-6 -translate-y-1/2">
            <CalendarIcon class="size-3.5" />
            <span class="sr-only">Select date</span>
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-auto overflow-hidden p-0" align="end">
        <Calendar
          type="single"
          value={calendarValue}
          placeholder={calendarPlaceholder}
          minValue={minDate}
          maxValue={maxDate}
          captionLayout="dropdown"
          onValueChange={(next) => {
            if (!next) return;
            const formatted = formatDate(next);
            value = formatted;
            onInputValue?.(formatted);
            onPickDate?.(next);
            open = false;
          }}
        />
      </Popover.Content>
    </Popover.Root>
  {/if}
</div>
