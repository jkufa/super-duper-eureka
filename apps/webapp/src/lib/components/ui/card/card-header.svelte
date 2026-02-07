<script lang="ts" module>
  import { cn, type WithElementRef } from '$lib/utils.js';
  import type { HTMLAttributes } from 'svelte/elements';

  export type CardHeaderProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...restProps
  }: CardHeaderProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="card-header"
  class={cn('flex flex-col gap-1.5 p-4', className)}
  {...restProps}
>
  {@render children?.()}
</div>
