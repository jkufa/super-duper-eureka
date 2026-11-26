import type { Component } from 'svelte';
import type { ChartPaintProps } from './chart-paint';

/**
 * What each app hands the shared root. Whole-file platform differences live behind this
 * interface, implemented once per app, instead of `imports` conditions in this package.
 */
export interface Platform {
  name: 'web' | 'desktop';
  /** Spike evidence: where the shared components report the events they handled. */
  trace?: (event: string, detail?: unknown) => void;
  /** Spike Q4: the thin paint layer of the chart. SVG elements on the web, mask layers on GPUI. */
  ChartPaint: Component<ChartPaintProps>;
  /** Spike Q5: desktop only for now. Writes a string to the system clipboard. */
  clipboard?: { write(text: string): Promise<void> };
  /** Spike Q5: desktop only for now. One JSON document in the OS app-data directory. */
  store?: {
    /** Where the document lives, shown in the window. */
    location: string;
    /** `null` when nothing was saved yet. */
    load(): Promise<SavedState | null>;
    save(value: SavedState): Promise<void>;
  };
}

/** Spike Q5: what the desktop writes to its app-data file and reads back after a restart. */
export interface SavedState {
  note: string;
  savedAt: string;
}

/** Spike Q2: what the web's server load (or the desktop's boot) hands the shared root. */
export interface Scenario {
  name: string;
  startingBalance: number;
  /** Who produced it: "the server load" on the web, "the desktop boot" in the window. */
  source: string;
}
