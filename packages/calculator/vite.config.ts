import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      build: { command: 'tsc --build', dependsOn: [{ task: 'build', from: 'dependencies' }] },
      bench: { command: 'vpx scripts/bench.ts && bun scripts/bench.ts', cache: false }
    }
  },
  test: {
    name: 'calculator',
    include: ['src/lib/**/__testing__/**/*.test.ts', 'scripts/**/__testing__/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
