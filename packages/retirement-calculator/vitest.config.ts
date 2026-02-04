import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/lib/__testing__/**/*.test.ts'],
    globals: true,
    environment: 'node',
  },
});
