import cloudflare from '@cloudflare/oxlint-config/vite-plus';
import { defineConfig } from 'vite-plus';

export default defineConfig({
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
    ignorePatterns: cloudflare.ignorePatterns,
    // The preset turns type-aware linting on. Step 8 of the migration spec enables it after removing baseUrl.
    options: { typeAware: false },
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
          'unicorn/no-typeof-undefined': 'off',
          'unicorn/prefer-import-meta-properties': 'off',
          'unicorn/prefer-string-replace-all': 'off'
        }
      }
    ]
  }
});
