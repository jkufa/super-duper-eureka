import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Platform, SavedState } from '@retirement/ui/platform';
import ChartPaint from './ChartPaint.svelte';

/** The bundle identifier the packaged app is built with, and the app-data folder's name. */
export const APP_ID = 'com.retirement.desktop';

// macOS keeps per-app data under ~/Library/Application Support/<bundle id>. Windows and Linux are
// out of scope for the spike.
const dataDir = join(homedir(), 'Library', 'Application Support', APP_ID);
const dataFile = join(dataDir, 'spike-state.json');

function parseSavedState(value: unknown): SavedState {
  if (
    typeof value === 'object' &&
    value !== null &&
    'note' in value &&
    typeof value.note === 'string' &&
    'savedAt' in value &&
    typeof value.savedAt === 'string'
  ) {
    return { note: value.note, savedAt: value.savedAt };
  }
  throw new Error(`${dataFile} does not hold { note, savedAt }`);
}

export const platform: Platform = {
  name: 'desktop',
  ChartPaint,
  // stderr, because under gpuix's automation stdout carries the protocol.
  trace: (event, detail) => {
    process.stderr.write(`[spike] ${event} ${JSON.stringify(detail ?? null)}\n`);
  },
  // gpuix-svelte 0.6.0 has no clipboard API, and the window runs in Bun, so it asks macOS's own
  // pbcopy. Windows and Linux would need clip.exe / wl-copy or xclip.
  clipboard: {
    write: (text) =>
      new Promise((resolve, reject) => {
        const child = execFile('pbcopy', (error) => (error ? reject(error) : resolve()));
        child.stdin?.end(text);
      })
  },
  store: {
    location: dataFile,
    async load() {
      if (!existsSync(dataFile)) {
        return null;
      }
      return parseSavedState(JSON.parse(await readFile(dataFile, 'utf8')));
    },
    async save(value) {
      await mkdir(dataDir, { recursive: true });
      await writeFile(dataFile, `${JSON.stringify(value, null, 2)}\n`);
    }
  }
};
