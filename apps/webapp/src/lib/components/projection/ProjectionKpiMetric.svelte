<script lang="ts">
  import NumberFlow from '@number-flow/svelte';
  import { currencyFormatOptions } from '$lib/formatters';

  let {
    label,
    value,
    animated = false,
    valueClass = ''
  }: {
    label: string;
    value: number;
    animated?: boolean;
    valueClass?: string;
  } = $props();
</script>

<div class="space-y-1">
  <dt class="text-xs font-medium text-muted-foreground">{label}</dt>
  <dd>
    <NumberFlow
      willChange
      {value}
      {animated}
      respectMotionPreference={true}
      locales="en-US"
      format={currencyFormatOptions}
      class={`text-2xl font-semibold tabular-nums ${valueClass}`}
    />
  </dd>
</div>
