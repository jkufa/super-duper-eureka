import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    name: 'calculator',
    include: ['src/lib/**/__testing__/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
