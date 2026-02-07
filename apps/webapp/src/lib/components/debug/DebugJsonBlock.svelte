<script lang="ts">
  import { cn } from '$lib/utils';

  import DebugCopyButton from './DebugCopyButton.svelte';

  let {
    label,
    data,
    wrap = true,
    class: className
  }: {
    label: string;
    data: unknown;
    wrap?: boolean;
    class?: string;
  } = $props();

  const formatted = $derived.by(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  });
</script>

<div class={cn('space-y-2', className)}>
  <div class="flex items-center justify-between gap-2">
    <div class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
    <DebugCopyButton value={formatted} label="Copy" class="h-7 px-2 text-xs" />
  </div>
  <pre
    class={cn(
      'max-h-[44vh] overflow-auto rounded-md border border-border bg-muted/35 p-3 text-[12px] leading-[1.45] text-foreground',
      wrap ? 'wrap-break-words whitespace-pre-wrap' : 'whitespace-pre'
    )}><code>{formatted}</code></pre>
</div>
