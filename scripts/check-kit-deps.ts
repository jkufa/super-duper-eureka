// Fails when a SvelteKit app would load a different copy of one of Kit's runtime dependencies than
// Kit itself resolves.
//
// Vite bundles Kit's server runtime into each app's server output but leaves Kit's dependencies
// (cookie, devalue, ...) as bare imports. Node, and adapter-vercel's file tracing, then resolve them
// from the app's directory, not Kit's. The workspace holds Kit 2 (webapp-legacy) and Kit 3 (web),
// which want different majors of some of these, and Bun hoists only one copy to the root. Each app
// therefore declares the dependencies whose hoisted copy is wrong for its Kit, using Kit's own
// range. This script catches the next disagreement, for example after a Kit upgrade.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');

interface PackageJson {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function isPackageJson(value: unknown): value is PackageJson {
  return typeof value === 'object' && value !== null && 'name' in value;
}

function readPackage(dir: string): PackageJson {
  const value: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (!isPackageJson(value)) {
    throw new Error(`${dir}/package.json has no name`);
  }
  return value;
}

// The package directory Node's resolution reaches from `from`. Walks node_modules directly because
// some of these packages have no entry that require.resolve could find.
function packageDir(from: string, name: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) {
      return realpathSync(candidate);
    }
    if (dirname(dir) === dir) {
      return undefined;
    }
  }
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* sourceFiles(path);
    } else if (entry.name.endsWith('.js')) {
      yield path;
    }
  }
}

// Static and dynamic imports, not JSDoc `@import` tags, which are types only.
const importPattern =
  /^\s*(?:import|export)\s[^;]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

// The packages imported by the Kit code that Vite bundles into the server output: everything
// reachable from src/runtime and the non-Vite entry points in src/exports. The Vite plugin, sync
// and build code (src/exports/vite, src/core) runs at build time from Kit's own directory, so its
// imports resolve correctly already and are left out.
function runtimeImports(kitDir: string): Set<string> {
  const seeds = [...sourceFiles(join(kitDir, 'src/runtime'))];
  for (const file of sourceFiles(join(kitDir, 'src/exports'))) {
    if (!file.includes('/src/exports/vite/')) {
      seeds.push(file);
    }
  }
  const seen = new Set<string>();
  const names = new Set<string>();
  const queue = [...seeds];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file) || !existsSync(file)) {
      continue;
    }
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(importPattern)) {
      const spec = match[1] ?? match[2] ?? match[3] ?? '';
      if (spec.startsWith('.')) {
        queue.push(join(dirname(file), spec));
      } else if (!spec.startsWith('node:')) {
        const parts = spec.split('/');
        names.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec));
      }
    }
  }
  return names;
}

const problems: Array<string> = [];
for (const entry of readdirSync(join(root, 'apps'))) {
  const appDir = join(root, 'apps', entry);
  if (!existsSync(join(appDir, 'package.json'))) {
    continue;
  }
  const app = readPackage(appDir);
  if (!app.dependencies?.['@sveltejs/kit'] && !app.devDependencies?.['@sveltejs/kit']) {
    continue;
  }
  const kitDir = packageDir(appDir, '@sveltejs/kit');
  if (!kitDir) {
    problems.push(`${app.name}: @sveltejs/kit is not installed`);
    continue;
  }
  const kit = readPackage(kitDir);
  const imported = runtimeImports(kitDir);
  const checked = Object.keys(kit.dependencies ?? {}).filter((dep) => imported.has(dep));
  for (const dep of checked) {
    const range = kit.dependencies?.[dep] ?? '';
    const fromApp = packageDir(appDir, dep);
    const fromKit = packageDir(kitDir, dep);
    if (fromApp !== fromKit) {
      const version = (dir?: string) => (dir ? readPackage(dir).version : 'nothing');
      problems.push(
        `${app.name}: Kit ${kit.version} imports ${dep} ${range} and resolves ${version(fromKit)}, ` +
          `but the app's server output would load ${version(fromApp)}. ` +
          `Add "${dep}": "${range}" to apps/${entry}/package.json.`
      );
    }
  }
  process.stdout.write(
    `${app.name}: Kit ${kit.version}, runtime dependencies checked: ${checked.join(', ')}\n`
  );
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join('\n')}\n`);
  process.exit(1);
}
