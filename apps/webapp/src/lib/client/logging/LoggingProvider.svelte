<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { WideEventBase } from '@retirement/logger';
  import { initLoggingContext } from './logging-context.svelte';

  const {
    children,
    base,
    pretty,
    indent
  }: {
    children: Snippet;
    base?: Partial<WideEventBase>;
    pretty?: boolean;
    indent?: number;
  } = $props();

  initLoggingContext({
    base,
    pretty,
    indent
  });
</script>

{@render children()}
