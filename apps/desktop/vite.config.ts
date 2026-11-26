import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      // `--bun` runs the window on Bun. Without it the launcher picks Node under `vp run`, and Node
      // cannot load @retirement/calculator, whose runtime entry is only a `module` field.
      dev: { command: 'gpuix-svelte --bun app.ts', cache: false },
      // gpuix-svelte's packaged build (Bun only): an unsigned dist/Retirement Calculator.app. Kept
      // out of `build` so `vp run build` does not package a 110 MB app every time.
      package: { command: 'bun build.ts', cache: false },
      check: {
        command:
          'svelte-check --tsconfig ./tsconfig.json --config ./svelte.config.js --fail-on-warnings'
      }
    }
  }
});
