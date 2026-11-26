/**
 * What each app hands the shared root. Whole-file platform differences live behind this
 * interface, implemented once per app, instead of `imports` conditions in this package.
 */
export interface Platform {
  name: 'web' | 'desktop';
}
