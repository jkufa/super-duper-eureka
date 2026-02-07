import adapter from '@sveltejs/adapter-auto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      '@retirement/calculator/types': path.resolve(
        rootDir,
        '../../packages/calculator/src/lib/types.ts',
      ),
      '@retirement/logger': path.resolve(rootDir, '../../packages/logger/src/index.ts'),
    },
  },
};

export default config;
