// The desktop entry. `vp run desktop#dev` runs it through gpuix-svelte's launcher, which selects
// the GPUI renderer and compiles every .svelte file with the Svelte build gpuix-svelte bundles.
import { utimesSync, watch } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render_hot } from 'gpuix-svelte';

const root = fileURLToPath(new URL('src/DesktopRoot.svelte', import.meta.url));

await render_hot(root, { title: 'Retirement calculator', width: 960, height: 680 });

// render_hot watches only the root's own directory, so it misses edits in packages/ui. This watcher
// handles them the way render_hot handles its own directory:
// - A .svelte edit touches the root, which triggers render_hot's usual remount. That reloads every
//   .svelte file outside node_modules, the shared ones included.
// - A .ts or .js edit (.svelte.ts included) cannot be reloaded: modules load once per process. Like
//   render_hot, print a restart notice once per file.
const shared = fileURLToPath(new URL('src', import.meta.resolve('@retirement/ui/package.json')));
const stale = new Set<string>();
watch(shared, { recursive: true }, (_event, file) => {
  // Dotfiles are editors' temporary files from an atomic save.
  if (!file || basename(file).startsWith('.')) {
    return;
  }
  if (file.endsWith('.svelte')) {
    const now = new Date();
    utimesSync(root, now, now);
  } else if (/\.[jt]s$/.test(file) && !stale.has(file)) {
    stale.add(file);
    process.stderr.write(
      `[desktop] packages/ui/src/${file} changed — modules load once per process, restart to pick it up\n`
    );
  }
});
