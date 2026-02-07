<script lang="ts">
  import { Check, Copy } from '@lucide/svelte';
  import * as Button from '$lib/components/ui/button';

  let {
    value,
    label = 'Copy JSON',
    copiedLabel = 'Copied',
    variant = 'ghost',
    size = 'sm',
    class: className,
    iconOnly = false
  }: {
    value: unknown;
    label?: string;
    copiedLabel?: string;
    variant?: import('$lib/components/ui/button').ButtonVariant;
    size?: import('$lib/components/ui/button').ButtonSize;
    class?: string;
    iconOnly?: boolean;
  } = $props();

  let copied = $state(false);

  const textValue = $derived.by(() => {
    if (typeof value === 'string') return value;

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  });

  async function copy() {
    if (!navigator?.clipboard) return;

    await navigator.clipboard.writeText(textValue);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1200);
  }
</script>

<Button.Root {variant} {size} class={className} onclick={copy} aria-label={label}>
  {#if copied}
    <Check class="size-3.5" />
    {#if !iconOnly}
      {copiedLabel}
    {/if}
  {:else}
    <Copy class="size-3.5" />
    {#if !iconOnly}
      {label}
    {/if}
  {/if}
</Button.Root>
