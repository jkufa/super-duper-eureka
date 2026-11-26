import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
  plugins: lazyPlugins(() => [tailwindcss(), sveltekit()]),
  run: {
    tasks: {
      build: {
        command: 'vp build',
        // Inlined at build time through $env/static/private, so a change must rebuild.
        cache: { env: ['MOCK_REAL_DATA'] },
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }]
      },
      dev: { command: 'vp dev', cache: false },
      check: {
        command: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
        // Uncached: a replayed `svelte-kit sync` would skip regenerating .svelte-kit, which svelte-check needs.
        cache: false
      }
    }
  }
});
