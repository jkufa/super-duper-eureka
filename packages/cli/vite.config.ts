import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      build: { command: 'tsc --build', dependsOn: [{ task: 'build', from: 'dependencies' }] }
    }
  },
  test: {
    name: 'cli',
    include: ['src/__testing__/**/*.test.ts'],
    environment: 'node'
  }
});
