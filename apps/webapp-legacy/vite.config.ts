import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
  plugins: lazyPlugins(() => [tailwindcss(), sveltekit()]),
  run: {
    tasks: {
      build: {
        command: 'vp build',
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }]
      },
      dev: { command: 'vp dev', cache: false },
      check: {
        command: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
        // Restoring the synced .svelte-kit files on a hit would invalidate the build task's cache.
        cache: { output: [] }
      }
    }
  }
});
