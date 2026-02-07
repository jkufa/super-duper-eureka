import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

import base from '@jkufa/eslint/base';
import stylistic from '@jkufa/eslint/stylistic';
import svelte from '@jkufa/eslint/svelte';
import css from '@jkufa/eslint/css';

import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  { ignores: ['src/routes/layout.css'] },
  ...base,
  ...stylistic,
  ...css,
  {
    files: ['**/*.svelte'],
    extends: [prettier],
  },
  ...svelte,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  { files: ['src/lib/components/ui/button/button.svelte'], rules: { 'svelte/no-navigation-without-resolve': 'off' } },
);
