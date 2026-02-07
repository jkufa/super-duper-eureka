<script lang="ts" module>
  import { cn, type WithElementRef } from '$lib/utils.js';
  import type { HTMLAttributes } from 'svelte/elements';

  export type CardFooterProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
  let { class: className, ref = $bindable(null), children, ...restProps }: CardFooterProps = $props();
</script>

<div bind:this={ref} data-slot="card-footer" class={cn('flex items-center p-4 pt-0', className)} {...restProps}>
  {@render children?.()}
</div>
