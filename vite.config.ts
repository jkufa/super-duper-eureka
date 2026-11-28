import cloudflare from '@cloudflare/oxlint-config/vite-plus';
import { defineConfig } from 'vite-plus';

// Tasks here belong to the workspace root. Per-package tasks (build, dev, check) live in each
// package's vite.config.ts, because Vite Task reads a package's tasks from its own config.
export default defineConfig({
  run: {
    tasks: {
      test: 'vp test',
      'retirement-calc': { command: 'bun run packages/cli/src/index.ts', cache: false },
      'parity-corpus': {
        command: 'bun packages/calculator/scripts/write-corpus.ts',
        cache: false
      },
      parity: { command: 'bun packages/calculator/scripts/parity.ts', cache: false }
    }
  },
  test: {
    projects: ['packages/calculator', 'packages/cli']
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    singleQuote: true,
    trailingComma: 'none',
    printWidth: 100,
    ignorePatterns: [
      'bun.lock',
      // Local Claude Code settings, written by the tool.
      '.claude/**',
      // Generated research pages.
      'implementation/**/*.html',
      // Parity cases, printed by the corpus's stableJson.
      'parity/**'
    ]
  },
  lint: {
    extends: [cloudflare],
    env: cloudflare.env,
    ignorePatterns: [...cloudflare.ignorePatterns],
    options: { typeCheck: true }
  }
});
