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
      'apps/*/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/*/src/**/*.ts',
        'apps/api/src/**/*.ts',
        'apps/web/src/**/*.{ts,tsx}',
        'scripts/**/*.mjs',
      ],
      // Entry points only wire tested modules together; test helpers are not product code.
      exclude: ['**/*.test.*', '**/index.ts', '**/main.tsx', '**/src/test/**'],
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
