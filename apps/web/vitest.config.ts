import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  resolve: { conditions: ['@sabaq/source', 'module', 'browser', 'development|production'] },
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    // Interface tests drive whole screens with real timers; leave room on busy machines.
    testTimeout: 15_000,
  },
});
