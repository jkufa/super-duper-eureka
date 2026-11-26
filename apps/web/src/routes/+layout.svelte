<script lang="ts">
  import { DARK, theme_rule } from 'gpuix-svelte-ui/theme';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  // The kit's palette as a `:root` rule in the server HTML, so the page has its `--ui-*` tokens
  // before hydration. The shared root's `apply_theme()` effect sets the same values afterwards.
  const tokens = `<style>${theme_rule(DARK)}</style>`;
</script>

<svelte:head>
  {@html tokens}
</svelte:head>

{@render children()}
