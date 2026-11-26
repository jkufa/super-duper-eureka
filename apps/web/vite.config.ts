import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite-plus';
import { defineConfig, lazyPlugins } from 'vite-plus';

// gpuix-svelte bundles its own Svelte, a custom-renderer build, in its nested node_modules. The web
// build must use this app's Svelte everywhere, gpuix-svelte's DOM components included, or two Svelte
// runtimes end up in one page. vite-plugin-svelte dedupes `svelte` for that; this guard, copied from
// the upstream shared-components demo, fails the build if any `svelte` import still resolves to the
// bundled copy. gpuix-svelte is found from @retirement/ui, which depends on it, so the guard works
// wherever Bun installed it.
const ui = dirname(createRequire(import.meta.url).resolve('@retirement/ui/package.json'));
const gpuix = dirname(createRequire(`${ui}/`).resolve('gpuix-svelte/package.json'));
const bundledSvelte = `${gpuix}/node_modules/svelte/`;

const oneSvelte: Plugin = {
  name: 'one-svelte',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!/^svelte(\/|$)/.test(source)) {
      return null;
    }
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    if (resolved?.id.startsWith(bundledSvelte)) {
      throw new Error(
        `gpuix-svelte's bundled svelte reached the web build: ${source} from ${importer}`
      );
    }
    return resolved;
  }
};

export default defineConfig({
  plugins: lazyPlugins(() => [oneSvelte, sveltekit({ adapter: adapter() })]),
  // The workspace packages ship TypeScript source. The dev server would otherwise externalize them
  // and load them through Node, which ignores their `module` entry and cannot run their source.
  ssr: { noExternal: [/^@retirement\//] },
  run: {
    tasks: {
      build: {
        command: 'vp build',
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }]
      },
      dev: { command: 'vp dev', cache: false },
      check: {
        command: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings',
        // Uncached: a replayed `svelte-kit sync` would skip regenerating its output, which svelte-check needs.
        cache: false
      }
    }
  }
});
