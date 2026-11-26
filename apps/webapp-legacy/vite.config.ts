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
      check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json'
    }
  }
});
