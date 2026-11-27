import { expect, type Page, test } from '@playwright/test';
import { expectNoViolations, NEW_PASSWORD, newEmail } from './helpers';

/** The demo class's join code (see the API's demo data). */
const DEMO_CODE = 'NRTH-5A26';

/** A brand-new student in the demo class, so tests never change the shared demo accounts. */
async function newStudent(page: Page) {
  const email = newEmail();
  const response = await page.request.post('/api/auth/register', {
    data: { name: 'Sara Javed', email, password: NEW_PASSWORD },
  });
  expect(response.status()).toBe(201);
  await page.goto(`/join?code=${DEMO_CODE}`);
  await page.getByRole('button', { name: 'Join class' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Computer Science · 5A' }),
  ).toBeVisible();
  return email;
}

test('a student finds their next deadline at a glance', async ({ page }) => {
  const email = await newStudent(page);
  await page.context().clearCookies();
  await page.goto('/sign-in');
  await page.locator('#sign-in-email').fill(email);
  await page.locator('#sign-in-password').fill(NEW_PASSWORD);
  const started = Date.now();
  await page.getByRole('button', { name: /^Sign in$/ }).click();

  // The next deadline is the first thing after the greeting, and arrives within seconds.
  const next = page.getByRole('region', { name: 'Next deadline' });
  await expect(next).toBeVisible();
  expect(Date.now() - started).toBeLessThan(5_000);
  await expect(next.getByText(/^Due .+ · in /)).toBeVisible();
  await expect(page.getByRole('region', { name: "Today's classes" })).toBeVisible();
  await expectNoViolations(page);
});

test('ticking off work, undoing it, and adding a personal task', async ({ page }) => {
  await newStudent(page);
  await page.goto('/');
  const first = page.getByRole('checkbox').first();
  await expect(first).toBeVisible();
  // Follow the task by its title: finished overdue work leaves Today until it is undone.
  const title = await first.evaluate(
    (element) =>
      document.querySelector(`label[for="${element.id}"]`)?.firstChild?.firstChild?.textContent ??
      '',
  );
  await first.click();
  await expect(page.getByText(`Marked “${title}” as done.`)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('checkbox', { name: title }).first()).not.toBeChecked();

  await page.getByRole('button', { name: 'Add a personal task' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a personal task' });
  await sheet.getByLabel(/What do you need to do/).fill('Print the HCI notes');
  await sheet.getByRole('button', { name: 'Tomorrow' }).click();
  await sheet.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Task added.')).toBeVisible();
  await expect(page.getByRole('region', { name: /Tomorrow/ })).toContainText('Print the HCI notes');
});

test('the timeline works by keyboard in every view', async ({ page }) => {
  await newStudent(page);
  await page.goto('/timeline?view=month');
  const selected = page.locator('[aria-pressed="true"]');
  await expect(selected).toBeVisible();
  await selected.focus();
  const before = await selected.getAttribute('data-day');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[aria-pressed="true"]')).toBeFocused();
  expect(await page.locator('[aria-pressed="true"]').getAttribute('data-day')).not.toBe(before);
  await expectNoViolations(page);

  for (const view of ['week', 'list']) {
    await page.goto(`/timeline?view=${view}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
    await expectNoViolations(page);
  }
});

test('Today and the timeline open without a connection after the first visit', async ({
  page,
  context,
}) => {
  await newStudent(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Next deadline' })).toBeVisible();
  // Wait until the app and the agenda are saved on the device.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sabaq.cache')?.includes('"agenda"')))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Next deadline' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /offline|connection/i })).toBeVisible();
  await page.getByRole('link', { name: 'Timeline' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Timeline' })).toBeVisible();
  await context.setOffline(false);
});
