import cloudflare from '@cloudflare/oxlint-config/vite-plus';
import { defineConfig } from 'vite-plus';

// Tasks here belong to the workspace root. Per-package tasks (build, dev, check) live in each
// package's vite.config.ts, because Vite Task reads a package's tasks from its own config.
export default defineConfig({
  run: {
    tasks: {
      test: 'vp test',
      e2e: { command: 'playwright test', cwd: 'apps/e2e', cache: false },
      'e2e:debugger': {
        command: 'playwright test tests/debugger.spec.ts',
        cwd: 'apps/e2e',
        cache: false
      },
      'e2e:ui': { command: 'playwright test --ui', cwd: 'apps/e2e', cache: false },
      'retirement-calc': { command: 'bun run packages/cli/src/index.ts', cache: false }
    }
  },
  test: {
    projects: ['packages/calculator', 'apps/webapp-legacy']
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    singleQuote: true,
    trailingComma: 'none',
    printWidth: 100,
    svelte: true,
    ignorePatterns: ['bun.lock', 'apps/webapp-legacy/static/**'],
    overrides: [
      {
        // Only the legacy app uses Tailwind.
        files: ['apps/webapp-legacy/**'],
        options: {
          sortTailwindcss: { stylesheet: './apps/webapp-legacy/src/routes/layout.css' }
        }
      }
    ]
  },
  lint: {
    extends: [cloudflare],
    env: cloudflare.env,
    ignorePatterns: [
      ...cloudflare.ignorePatterns,
      // Reference code for later specs. Its imports only resolve once it moves into a package.
      'implementation/**',
      // Legacy barrels re-export named exports from .svelte modules, which the type checker cannot
      // see (TS2614). Type codes cannot be scoped per path, and svelte-check covers these files.
      'apps/webapp-legacy/src/lib/components/ui/button/index.ts',
      'apps/webapp-legacy/src/lib/components/ui/card/index.ts',
      'apps/webapp-legacy/src/lib/components/ui/toggle/index.ts'
    ],
    options: { typeCheck: true },
    overrides: [
      {
        files: ['**/*.svelte'],
        rules: {
          // Runes and $store subscriptions are compiler globals; svelte-check reports truly undefined names.
          'no-undef': 'off'
        }
      },
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
      },
      {
        files: ['apps/e2e/tests/**'],
        rules: {
          // page.evaluate callbacks are serialized into the browser, so helpers cannot be hoisted out of them.
          'unicorn/consistent-function-scoping': 'off'
        }
      },
      {
        // Legacy source is frozen apart from formatting and import rewrites, and the app is deleted at parity.
        // Each rule below would need real code changes there.
        files: ['apps/webapp-legacy/**'],
        rules: {
          'import/no-namespace': 'off',
          'no-unused-expressions': 'off',
          'quality/no-known-value-widening': 'off',
          'quality/no-unknown-type-aliases': 'off',
          'quality/no-unsafe-dictionary-type': 'off',
          'typescript/no-explicit-any': 'off',
          'typescript/no-unsafe-type-assertion': 'off',
          'unicorn/no-typeof-undefined': 'off',
          'unicorn/prefer-import-meta-properties': 'off',
          'unicorn/prefer-string-replace-all': 'off'
        }
      }
    ]
  }
});
