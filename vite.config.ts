import cloudflare from '@cloudflare/oxlint-config/vite-plus';
import { defineConfig } from 'vite-plus';

// Tasks here belong to the workspace root. Per-package tasks (build, dev, check) live in each
// package's vite.config.ts, because Vite Task reads a package's tasks from its own config.
export default defineConfig({
  run: {
    tasks: {
      test: 'vp test',
      'retirement-calc': { command: 'bun run packages/cli/src/index.ts', cache: false }
    }
  },
  test: {
    projects: ['packages/calculator']
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
      'implementation/**/*.html'
    ]
  },
  lint: {
    extends: [cloudflare],
    env: cloudflare.env,
    ignorePatterns: [...cloudflare.ignorePatterns],
    options: { typeCheck: true },
    overrides: [
      {
        files: ['packages/cli/**'],
        rules: {
          // The CLI's job is printing results to the terminal.
          'no-console': 'off'
        }
      },
      {
        files: ['packages/logger/**'],
        rules: {
          // Wide events carry arbitrary caller fields by design; a JSON value type rejects interface-typed callers.
          'quality/no-unsafe-dictionary-type': 'off'
        }
      }
    ]
  }
});
