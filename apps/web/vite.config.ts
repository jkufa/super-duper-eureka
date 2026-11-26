import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite-plus';
import { defineConfig, lazyPlugins } from 'vite-plus';

// gpuix-svelte bundles its own Svelte, a custom-renderer build, in its nested node_modules. The web
// build must use this app's Svelte everywhere, gpuix-svelte's DOM components included, or two Svelte
// runtimes end up in one page. vite-plugin-svelte dedupes `svelte` for that. This guard, based on
// the upstream shared-components demo's, fails the build when that did not work. gpuix-svelte is
// found from @retirement/ui, which depends on it, so the guard works wherever Bun installed it.
const ui = dirname(createRequire(import.meta.url).resolve('@retirement/ui/package.json'));
const gpuix = dirname(createRequire(`${ui}/`).resolve('gpuix-svelte/package.json'));
const bundledSvelte = `${gpuix}/node_modules/svelte/`;

// The svelte package directory a module ID belongs to, if any. Greedy, so a nested copy such as
// gpuix-svelte/node_modules/svelte is told apart from the top-level one.
const svelteDir = (id: string) => /^\0?(.*\/node_modules\/svelte)\//.exec(id)?.[1];

const oneSvelte: Plugin = {
  name: 'one-svelte',
  enforce: 'pre',
  // Names the importer when a bare `svelte` import resolves to the bundled copy.
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
  },
  // The check that counts: every module in this environment's output, however it was resolved,
  // comes from one svelte package, and not the bundled one. This covers paths another plugin or an
  // alias resolved before resolveId above could see a bare `svelte` import.
  generateBundle(_options, bundle) {
    const dirs = new Map<string, string>();
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') {
        continue;
      }
      for (const id of output.moduleIds) {
        const dir = svelteDir(id);
        if (dir && !dirs.has(dir)) {
          dirs.set(dir, `${id} (in ${output.fileName})`);
        }
      }
    }
    const env = this.environment.name;
    const bundled = [...dirs].find(([dir]) => `${dir}/` === bundledSvelte);
    if (bundled) {
      this.error(`[${env}] gpuix-svelte's bundled svelte is in the web build: ${bundled[1]}`);
    }
    if (dirs.size > 1) {
      const list = [...dirs].map(([dir, first]) => `  ${dir}: ${first}`).join('\n');
      this.error(`[${env}] the web build contains ${dirs.size} svelte copies:\n${list}`);
    }
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
