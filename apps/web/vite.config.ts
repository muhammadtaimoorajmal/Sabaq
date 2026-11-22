import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Use @sabaq/shared's TypeScript sources directly, so changes apply without a build.
    conditions: ['@sabaq/source', 'module', 'browser', 'development|production'],
  },
  server: {
    port: 5173,
    // Same-origin API calls during development, exactly as the Vercel rewrite does in production.
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Libraries change rarely: separate chunks stay cached when only the app changes.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'validation', test: /node_modules[\\/]zod[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
});
