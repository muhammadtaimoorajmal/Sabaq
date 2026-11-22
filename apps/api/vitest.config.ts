import { defineProject } from 'vitest/config';

export default defineProject({
  // Resolve @sabaq/shared to its TypeScript sources, so tests never need a prior build.
  ssr: { resolve: { conditions: ['@sabaq/source'] } },
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
