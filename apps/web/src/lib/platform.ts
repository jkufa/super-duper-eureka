import type { Platform } from '@retirement/ui/platform';
import ChartPaint from './ChartPaint.svelte';

export const platform: Platform = {
  name: 'web',
  ChartPaint,
  // Shows in the browser console; the spike's headless runs read it from there.
  trace: (event, detail) => console.debug(`[spike] ${event} ${JSON.stringify(detail ?? null)}`)
};
