# webapp-legacy

The current SvelteKit web app. It stays live until the new app passes the parity gate in `implementation/gpuix-port/`, then it is deleted. Its source is frozen apart from formatting.

Run these from the repo root.

## Developing

```sh
vp install
vp run dev
```

Copy `.env.example` to `.env` first. The build reads `MOCK_REAL_DATA` at build time.

## Building

```sh
vp run webapp-legacy#build
```

## Checking

```sh
vp run webapp-legacy#check
```

This runs `svelte-kit sync` and `svelte-check`. `vp check` at the root covers formatting, lint and TypeScript, but not `.svelte` files.
