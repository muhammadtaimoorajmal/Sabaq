import { expect, type Page, test } from '@playwright/test';
import { expectNoViolations, NEW_PASSWORD, newEmail, scrollsSideways } from './helpers';

/** The demo class's join code (see the API's demo data). */
const DEMO_CODE = 'NRTH-5A26';

/** A day in the demo class's time zone, `offset` days from today, as YYYY-MM-DD. */
const classDay = (offset: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(
    new Date(Date.now() + offset * 86_400_000),
  );

async function newStudent(page: Page) {
  const response = await page.request.post('/api/auth/register', {
    data: { name: 'Sara Javed', email: newEmail(), password: NEW_PASSWORD },
  });
  expect(response.status()).toBe(201);
  await page.goto(`/join?code=${DEMO_CODE}`);
  await page.getByRole('button', { name: 'Join class' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Computer Science · 5A' }),
  ).toBeVisible();
}

test('a student sees crunch days in words, as a calendar and as a table', async ({ page }) => {
  await newStudent(page);
  await page.goto('/timeline');
  await page.getByRole('link', { name: 'Workload' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Workload' })).toBeVisible();
  // The demo week has a crunch three days from now.
  await expect(page.getByRole('heading', { level: 2, name: /heavy days? ahead/ })).toBeVisible();
  await expect(page.getByText(/^Busiest week: /)).toBeVisible();
  const today = page.locator('[aria-pressed="true"]');
  const before = await today.getAttribute('data-day');
  await today.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[aria-pressed="true"]')).not.toHaveAttribute('data-day', before ?? '');
  await expect(page.locator('[aria-pressed="true"]')).toBeFocused();
  await expectNoViolations(page);
  expect(await scrollsSideways(page)).toBe(false);

  await page.getByRole('radio', { name: 'Table' }).click();
  const table = page.getByRole('table', { name: /Days with work due/ });
  await expect(table.getByRole('cell', { name: /Heavy|Extreme/ }).first()).toBeVisible();
  await expectNoViolations(page);
  expect(await scrollsSideways(page)).toBe(false);
});

test('choosing a busy due date suggests lighter days, without blocking', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Class representative' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hamza');
  await page.getByRole('link', { name: 'Classes' }).first().click();
  await page.getByRole('link', { name: /BS Computer Science/ }).click();
  await page.getByRole('button', { name: 'Post announcement' }).click();
  const composer = page.getByRole('dialog', { name: 'Post an announcement' });
  await composer.getByLabel(/^Title/).fill(`Quiz ${Date.now()}`);
  await composer.getByLabel('Date', { exact: true }).fill(classDay(3));

  await expect(composer.getByText(/is already busy for the class$/)).toBeVisible();
  await expect(
    composer.getByText('This is only advice: you can still choose this day.'),
  ).toBeVisible();
  await expectNoViolations(page);
  const lighter = composer.getByRole('button', { name: /\((free|light|moderate)\)$/ }).first();
  await lighter.click();
  await expect(composer.getByText(/^Due date moved to .+, same time\.$/)).toBeVisible();
  await expect(composer.getByText(/^The class on /)).toBeVisible();
  // Nothing was posted: the advice only changed the date in the form.
  await composer.getByRole('button', { name: 'Cancel' }).click();
});
