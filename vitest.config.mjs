import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'scripts',
          include: ['scripts/**/*.test.mjs'],
          environment: 'node',
        },
      },
      'packages/*/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'scripts/**/*.mjs'],
      exclude: ['**/*.test.*', '**/index.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        // Domain logic decides what students see and whether a submission is safe: no gaps.
        'packages/shared/src/domain/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
