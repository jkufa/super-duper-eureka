import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join } from 'node:path';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite-plus';
import { defineConfig, lazyPlugins } from 'vite-plus';

// gpuix-svelte bundles its own Svelte, a custom-renderer build, in its nested node_modules. The web
// build must use this app's Svelte everywhere, gpuix-svelte's DOM components included, or two Svelte
// runtimes end up in one page. vite-plugin-svelte dedupes `svelte` for that. This guard, based on
// the upstream shared-components demo's, fails the build when that did not work. gpuix-svelte is
// found from @retirement/ui, which depends on it, so the guard works wherever Bun installed it.
const require = createRequire(import.meta.url);
const appSvelte = realpathSync(dirname(require.resolve('svelte/package.json')));
const ui = dirname(require.resolve('@retirement/ui/package.json'));
const gpuix = dirname(createRequire(`${ui}/`).resolve('gpuix-svelte/package.json'));
const bundledSvelte = `${gpuix}/node_modules/svelte/`;

// The real directory of the Svelte package a module ID belongs to, if any: the nearest package.json
// with a name, so a copy installed under another name (an npm alias) is still recognised.
function svelteDir(id: string): string | undefined {
  const file = id.replace(/^\0/, '').split('?')[0] ?? '';
  if (!isAbsolute(file)) {
    return undefined;
  }
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (!existsSync(manifest)) {
      continue;
    }
    const pkg: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
    const name = typeof pkg === 'object' && pkg !== null && 'name' in pkg ? pkg.name : undefined;
    if (name) {
      return name === 'svelte' ? realpathSync(dir) : undefined;
    }
  }
  return undefined;
}

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
  // The check that counts: every Svelte module in this environment's output, however it was
  // resolved, comes from the Svelte this app resolves. This covers paths another plugin or an alias
  // resolved before resolveId above could see a bare `svelte` import.
  generateBundle(_options, bundle) {
    const strays = new Map<string, string>();
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') {
        continue;
      }
      for (const id of output.moduleIds) {
        const dir = svelteDir(id);
        if (dir && dir !== appSvelte && !strays.has(dir)) {
          strays.set(dir, `${id} (in ${output.fileName})`);
        }
      }
    }
    if (strays.size > 0) {
      const list = [...strays.values()].map((first) => `  ${first}`).join('\n');
      this.error(
        `[${this.environment.name}] the web build contains Svelte other than ${appSvelte}:\n${list}`
      );
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
