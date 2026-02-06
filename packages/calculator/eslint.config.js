import { defineConfig } from 'eslint/config';
import base from '@jkufa/eslint/base';
import stylistic from '@jkufa/eslint/stylistic';

export default defineConfig([
  ...base,
  ...stylistic,
]);
