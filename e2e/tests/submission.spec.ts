import { expect, type Page, test } from '@playwright/test';
import { expectNoViolations, NEW_PASSWORD, newEmail, scrollsSideways } from './helpers';

/** The demo class's join code (see the API's demo data). */
const DEMO_CODE = 'NRTH-5A26';
const STUDENT_ID = 'FA24-BCS-042';

/** Written into the test files, to prove the file itself never leaves the browser. */
const MARKER = 'only-on-this-device';
const pdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.7\n% ${MARKER}\n1 0 obj\n`),
});
const wordRenamedToPdf = (name: string) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from(`....[Content_Types].xml....word/document.xml ${MARKER}`),
  ]),
});

async function signInAsClassRep(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Class representative' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hamza');
}

/** A brand-new student with a student ID, signed in and joined to the demo class. */
async function newStudent(page: Page) {
  const response = await page.request.post('/api/auth/register', {
    data: { name: 'Sara Javed', email: newEmail(), password: NEW_PASSWORD, studentId: STUDENT_ID },
  });
  expect(response.status()).toBe(201);
  await page.goto(`/join?code=${DEMO_CODE}`);
  await page.getByRole('button', { name: 'Join class' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Computer Science · 5A' }),
  ).toBeVisible();
}

test('rules posted with a deadline let a student fix their file before submitting', async ({
  page,
  browser,
}) => {
  const title = `Lab 77 ${Date.now()}`;

  // The class representative posts a deadline with file rules, seeing the name students get.
  await signInAsClassRep(page);
  await page.getByRole('link', { name: 'Classes' }).first().click();
  await page.getByRole('link', { name: /BS Computer Science/ }).click();
  await page.getByRole('button', { name: 'Post announcement' }).click();
  const composer = page.getByRole('dialog', { name: 'Post an announcement' });
  await composer.getByLabel(/^Title/).fill(title);
  await composer.getByRole('button', { name: 'Tomorrow' }).click();
  await composer.getByRole('switch', { name: 'Add submission rules' }).click();
  await composer.getByLabel(/^File name rule/).fill('Lab');
  await composer.getByRole('button', { name: 'Insert Task number' }).click();
  await composer.getByLabel(/^File name rule/).press('End');
  await composer.getByLabel(/^File name rule/).pressSequentially('_');
  await composer.getByRole('button', { name: 'Insert Student ID' }).click();
  await composer.getByRole('button', { name: 'pdf' }).click();
  await composer.getByLabel(/^Largest file size/).fill('5');
  await expect(composer.getByText('Lab3_70012345.pdf')).toBeVisible();
  await expectNoViolations(page);
  await composer.getByRole('button', { name: 'Post announcement' }).click();
  await expect(page.getByText(/Posted to BS Computer Science/)).toBeVisible();

  // A student opens the task from the timeline and sees their exact file name.
  const context = await browser.newContext();
  const student = await context.newPage();
  await newStudent(student);
  const uploads: string[] = [];
  student.on('request', (request) => {
    const body = request.postData();
    if (body?.includes(MARKER)) uploads.push(request.url());
  });
  await student.goto('/timeline');
  await student.getByRole('link', { name: `Open “${title}”` }).click();
  await expect(student.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(student.getByText('Lab77_FA24-BCS-042.pdf').first()).toBeVisible();

  // A Word file renamed to PDF, with the wrong name: both problems, with exact fixes.
  const input = student.locator('input[type="file"]');
  await input.setInputFiles(wordRenamedToPdf('lab77 final.pdf'));
  const verdict = student.getByRole('heading', { name: 'Fix 2 problems before submitting' });
  await expect(verdict).toBeFocused();
  await expect(
    student.getByText('This is not really a PDF file: it is a Word document.'),
  ).toBeVisible();
  await expect(student.getByText('Rename the file to:')).toBeVisible();
  await expectNoViolations(student);
  expect(await scrollsSideways(student)).toBe(false);

  // The fixed file passes.
  await input.setInputFiles(pdf('Lab77_FA24-BCS-042.pdf'));
  await expect(student.getByRole('heading', { name: 'Ready to submit' })).toBeFocused();
  await expect(student.getByText('It follows every rule for this task.')).toBeVisible();

  // Nothing about the files was sent anywhere.
  expect(uploads).toEqual([]);
  await context.close();
});

test('class representatives set rules on an existing task from its page', async ({ page }) => {
  await signInAsClassRep(page);
  await page.goto('/timeline');
  // Any class task: the rules editor opens with what is already set.
  await page
    .getByRole('link', { name: /^Open “/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 2, name: 'Submit it right' })).toBeVisible();
  const edit = page.getByRole('button', { name: /^(Edit rules|Add submission rules)$/ });
  await edit.click();
  const sheet = page.getByRole('dialog', { name: 'Submission rules' });
  await expect(sheet.getByLabel(/^File name rule/)).toBeVisible();
  await expectNoViolations(page);
  // Nothing is changed: the shared demo data stays as it is.
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toBeHidden();
});
