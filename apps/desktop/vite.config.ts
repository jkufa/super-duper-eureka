import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      // `--bun` runs the window on Bun. Without it the launcher picks Node under `vp run`, and Node
      // cannot load @retirement/calculator, whose runtime entry is only a `module` field.
      dev: { command: 'gpuix-svelte --bun app.ts', cache: false },
      check: {
        command:
          'svelte-check --tsconfig ./tsconfig.json --config ./svelte.config.js --fail-on-warnings'
      }
    }
  }
});
