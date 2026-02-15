<script lang="ts">
  import { Github } from '@lucide/svelte';
  import * as Button from '$lib/components/ui/button';
  import * as NavigationMenu from '$lib/components/ui/navigation-menu';
</script>

<nav class="flex items-center gap-4 border-b border-border px-4 py-2">
  <h1 class="text-sm font-semibold">Better Retirement Calculator</h1>

  <NavigationMenu.Root>
    <NavigationMenu.List>
      <!-- nav items go here -->
    </NavigationMenu.List>
  </NavigationMenu.Root>

  <Button.Root
    href="https://github.com/jkufa/super-duper-eureka"
    target="_blank"
    rel="noreferrer"
    variant="outline"
    class="ms-auto"
  >
    <Github class="size-4" />
    View repo
  </Button.Root>
</nav>
