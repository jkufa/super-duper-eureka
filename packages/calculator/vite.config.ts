import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      build: { command: 'tsc --build', dependsOn: [{ task: 'build', from: 'dependencies' }] },
      'write-baseline': { command: 'vpx scripts/write-baseline.ts', cache: false },
      bench: { command: 'vpx scripts/bench.ts && bun scripts/bench.ts', cache: false }
    }
  },
  test: {
    name: 'calculator',
    include: ['src/lib/**/__testing__/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
