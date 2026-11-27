import { chromium, expect, test } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { API_URL, WEB_URL } from '../playwright.config';
import { DEMO } from './helpers';

/** The refresh cookie of a fresh demo session, so Lighthouse can audit signed-in pages. */
async function sessionCookie(): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO.email, password: DEMO.password }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Signing in for Lighthouse failed');
  return cookie;
}

test.describe('Lighthouse', () => {
  test.setTimeout(600_000);

  test('scores 100 for accessibility on every page', async () => {
    test.skip(test.info().project.name !== 'desktop', 'Runs once, on desktop');
    const chrome = await chromeLauncher.launch({
      chromePath: process.env.CI ? chromium.executablePath() : undefined,
      chromeFlags: ['--headless=new', '--no-sandbox'],
    });
    try {
      const cookie = await sessionCookie();
      for (const [path, signedIn] of [
        ['/sign-in', false],
        ['/sign-up', false],
        ['/forgot-password', false],
        ['/', true],
        ['/settings', true],
        ['/welcome', true],
        ['/inbox', true],
        ['/timeline', true],
        ['/design-system', false],
      ] as const) {
        const result = await lighthouse(`${WEB_URL}${path}`, {
          port: chrome.port,
          onlyCategories: ['accessibility'],
          output: 'json',
          logLevel: 'error',
          ...(signedIn && { extraHeaders: { Cookie: cookie } }),
        });
        const category = result?.lhr.categories.accessibility;
        const failing = Object.values(result?.lhr.audits ?? {})
          .filter(
            (audit) =>
              audit.score !== null && audit.score < 1 && audit.scoreDisplayMode === 'binary',
          )
          .map((audit) => audit.id);
        expect(failing, `${path} failing audits`).toEqual([]);
        expect(category?.score, path).toBe(1);
      }
    } finally {
      await chrome.kill();
    }
  });
});
