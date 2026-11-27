import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';

/** Changes with every build, so the service worker and offline data are replaced together. */
const BUILD_ID = Date.now().toString(36);

/**
 * Lists every file of the build in `precache.json`, so the service worker can keep the whole
 * app (including pages not visited yet) for offline use.
 */
function precacheManifest(): Plugin {
  return {
    name: 'sabaq-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map'))
        .sort();
      const version = createHash('sha256').update(files.join(' ')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'precache.json',
        source: JSON.stringify({ version, files }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheManifest()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
