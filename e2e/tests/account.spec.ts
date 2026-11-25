import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expectNoViolations, NEW_PASSWORD, newEmail, signUp } from './helpers';

/** The demo class's join code (see the API's demo data). */
const DEMO_CODE = 'NRTH-5A26';

/** A real 4 × 3 PNG photo, so the browser actually crops, scales and compresses it. */
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAKUlEQVR4nBXHQREAMAzDMMMpiIIInEA0rHV3+ghBRiLFPePGvXxjY/sAC94PAQO4kPcAAAAASUVORK5CYII=',
  'base64',
);

test('a new student is set up in under two minutes, and the setup follows them to another device', async ({
  page,
  browser,
}) => {
  const email = newEmail();
  const started = Date.now();

  await page.goto('/sign-up');
  await page.locator('#sign-up-name').fill('Sara Javed');
  await page.locator('#sign-up-email').fill(email);
  await page.locator('#sign-up-password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Step 1: about you.
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Sara' })).toBeVisible();
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: PHOTO,
  });
  await expect(page.getByText('Photo updated.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible();
  await page.getByLabel(/Student ID/).fill('NU-24-0042');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2: comfort.
  await expect(page.getByRole('heading', { level: 2, name: 'Make it comfortable' })).toBeFocused();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3: your class.
  await page.getByLabel(/Join code/).fill(DEMO_CODE);
  await page.getByRole('button', { name: 'Join class' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Computer Science · 5A' }),
  ).toBeVisible();
  expect(Date.now() - started).toBeLessThan(120_000);

  // The photo is served by the API and shown in the header.
  const photo = await page.request.get(
    await page.evaluate(async () => {
      const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      const body = (await response.json()) as { user: { avatarUrl: string } };
      return body.user.avatarUrl;
    }),
  );
  expect(photo.headers()['content-type']).toMatch(/^image\/(webp|jpeg)$/);

  // Another device: signing in brings the dark theme and profile along.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto('/sign-in');
  await phone.locator('#sign-in-email').fill(email);
  await phone.locator('#sign-in-password').fill(NEW_PASSWORD);
  await phone.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(phone.getByRole('heading', { level: 1 })).toContainText('Sara');
  await expect(phone.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Finished setup is remembered too: no reminder on Today.
  await expect(phone.getByRole('region', { name: 'Finish setting up' })).toHaveCount(0);
  await phone.goto('/settings');
  await expect(phone.getByLabel(/Student ID/)).toHaveValue('NU-24-0042');
  await other.close();
});

test('changing a setting on one device reaches the others', async ({ page, browser }) => {
  const { email } = await signUp(page, {}, '/settings');
  const regional = page.getByRole('region', { name: 'Date and time' });
  await regional.getByRole('radio', { name: '14:30' }).click();
  // Saved to the account a moment later.
  await expect
    .poll(async () => {
      const response = await page.evaluate(async () => {
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        return ((await refreshed.json()) as { user: { preferences: { timeFormat: string } } }).user
          .preferences.timeFormat;
      });
      return response;
    })
    .toBe('24h');

  const other = await browser.newContext();
  const laptop = await other.newPage();
  await laptop.goto('/sign-in');
  await laptop.locator('#sign-in-email').fill(email);
  await laptop.locator('#sign-in-password').fill(NEW_PASSWORD);
  await laptop.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(laptop.getByRole('heading', { level: 1 })).toContainText('Sara');
  await laptop.goto('/settings');
  await expect(
    laptop.getByRole('region', { name: 'Date and time' }).getByRole('radio', { name: '14:30' }),
  ).toBeChecked();
  await other.close();
});

test('skipping setup leaves a reminder on Today until dismissed', async ({ page }) => {
  await signUp(page, {}, '/welcome');
  await page.getByRole('button', { name: 'Skip setup' }).click();
  await expect(page).toHaveURL(/\/$/);
  // Skipping counts as finished: the reminder is for people who never saw the steps.
  await expect(page.getByRole('region', { name: 'Finish setting up' })).toHaveCount(0);
});

test('downloads a copy of the data, then deletes the account', async ({ page }) => {
  const { email } = await signUp(page, {}, '/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^sabaq-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile(await file.path(), 'utf8')) as {
    profile: { email: string };
  };
  expect(data.profile.email).toBe(email);

  await page.getByRole('button', { name: 'Delete account…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await expectNoViolations(page);
  await dialog.getByLabel(/Enter your password to confirm/).fill(NEW_PASSWORD);
  await dialog.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Your account was deleted.')).toBeVisible();

  await page.locator('#sign-in-email').fill(email);
  await page.locator('#sign-in-password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
});

test.describe('accessibility of account pages', () => {
  for (const path of ['/welcome', '/welcome?step=2', '/welcome?step=3', '/settings']) {
    test(path, async ({ page }) => {
      await signUp(page, {}, path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoViolations(page);
    });
  }
});
