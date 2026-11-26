// svelte-check looks up a Svelte config from each file's own directory upwards. Without this one,
// the shared components would find the workspace root's vite.config.ts, which has no Svelte plugin,
// and fail both apps' checks. The components need no options of their own.
export default {};
