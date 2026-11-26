// Fails when a SvelteKit app would load a version of cookie or devalue that its Kit does not accept.
//
// Vite bundles Kit's server runtime into each app's server output but leaves these two as bare
// imports. Node, and adapter-vercel's file tracing, then resolve them from the app's directory, not
// Kit's. The workspace holds Kit 2 (webapp-legacy) and Kit 3 (web), which want different majors of
// cookie, and Svelte 5.59 wants devalue 6, which neither Kit accepts. Bun hoists one copy of each to
// the root, so each app declares both with its Kit's range. This script catches the next
// disagreement, for example after a Kit upgrade.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { semver } from 'bun';

const checked = ['cookie', 'devalue'];
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
// cookie 2 and devalue do not export `./package.json` for require.resolve to find.
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
  const found: Array<string> = [];
  for (const dep of checked) {
    const range = kit.dependencies?.[dep];
    if (!range) {
      problems.push(
        `${app.name}: Kit ${kit.version} no longer depends on ${dep}. ` +
          `Remove it from scripts/check-kit-deps.ts.`
      );
      continue;
    }
    const dir = packageDir(appDir, dep);
    const pkg = dir ? readPackage(dir) : undefined;
    if (pkg?.version && pkg.name === dep && semver.satisfies(pkg.version, range)) {
      found.push(`${dep} ${pkg.version}`);
      continue;
    }
    const loaded = pkg ? `${pkg.name} ${pkg.version}` : 'nothing';
    problems.push(
      `${app.name}: Kit ${kit.version} needs ${dep} ${range}, but the app's server output would ` +
        `load ${loaded}. Add "${dep}": "${range}" to apps/${entry}/package.json.`
    );
  }
  process.stdout.write(`${app.name}: Kit ${kit.version}, ${found.join(', ')}\n`);
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join('\n')}\n`);
  process.exit(1);
}
