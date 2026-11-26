// The desktop entry. `vp run desktop#dev` runs it through gpuix-svelte's launcher, which selects
// the GPUI renderer and compiles every .svelte file with the Svelte build gpuix-svelte bundles.
import { utimesSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render_hot } from 'gpuix-svelte';

const root = fileURLToPath(new URL('src/DesktopRoot.svelte', import.meta.url));

await render_hot(root, { title: 'Retirement calculator', width: 960, height: 680 });

// render_hot watches only the root's own directory, so it misses edits to the shared components in
// packages/ui. Touching the root on such an edit triggers its usual remount, which reloads every
// .svelte file outside node_modules, the shared ones included.
const shared = fileURLToPath(new URL('src', import.meta.resolve('@retirement/ui/package.json')));
watch(shared, { recursive: true }, (_event, file) => {
  if (file?.endsWith('.svelte')) {
    const now = new Date();
    utimesSync(root, now, now);
  }
});
