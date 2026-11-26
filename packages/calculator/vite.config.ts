import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      build: { command: 'tsc --build', dependsOn: [{ task: 'build', from: 'dependencies' }] }
    }
  },
  test: {
    name: 'calculator',
    include: ['src/lib/**/__testing__/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
