import path from 'node:path';
import { defineConfig } from 'vite-plus';

import svelteConfig from './svelte.config.js';

// The SvelteKit plugin reads svelte.config.js from process.cwd(), which is the repo root when
// `vp test` runs every project. These unit tests need only Kit's aliases, so resolve them here.
export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(import.meta.dirname, 'src/lib'),
      ...svelteConfig.kit?.alias
    }
  },
  test: {
    name: 'webapp-legacy',
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
