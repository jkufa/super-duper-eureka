// The `gpuixHTML` namespace that tsconfig's `svelteOptions` points svelte-check at, so every
// component, the shared ones included, is checked as GPUI markup. This sits in a file rather than
// in tsconfig's `types` because a reference written in a file may still walk up node_modules,
// which finds gpuix-svelte whether Bun hoisted it or installed it for this app.
/// <reference types="gpuix-svelte/html" />
