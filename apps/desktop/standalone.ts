// The packaged app's entry (spike Q6). `gpuix-svelte/build` reads the title and `app` options from
// this file's source, so they are written out as literals. The dev entry is app.ts.
import { render } from 'gpuix-svelte';
import DesktopRoot from './src/DesktopRoot.svelte';

render(DesktopRoot, {
  title: 'Retirement calculator',
  width: 1200,
  height: 900,
  // Keep `identifier` in step with APP_ID in src/platform.ts: both name the app-data folder.
  app: { name: 'Retirement Calculator', identifier: 'com.retirement.desktop' }
});
