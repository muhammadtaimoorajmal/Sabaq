import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
/** Locally, use the installed Chrome; in continuous integration, Playwright's own Chromium. */
const channel = CI ? undefined : 'chrome';

export const WEB_URL = 'http://localhost:4173';
export const API_URL = 'http://localhost:4000';

/**
 * End-to-end tests in a real browser, against the real API (with its temporary demo database)
 * and the production build of the web app.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: CI ? 2 : undefined,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [['github'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: [
    {
      command: 'npx tsx --conditions=@sabaq/source apps/api/src/index.ts',
      cwd: '..',
      url: `${API_URL}/api/health`,
      // Always start fresh servers with test settings; never reuse a developer's running one.
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
        // The web app's address: the API accepts cookie-based requests only from it.
        APP_URL: WEB_URL,
        AUTH_RATE_LIMIT_MAX: '1000',
        RATE_LIMIT_MAX: '10000',
      },
    },
    {
      command:
        'npm run build -w @sabaq/web && npm run preview -w @sabaq/web -- --port 4173 --strictPort',
      cwd: '..',
      url: WEB_URL,
      // Always start fresh servers with test settings; never reuse a developer's running one.
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
