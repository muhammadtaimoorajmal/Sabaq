import type { AgendaTask, SubmissionRule } from '@sabaq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { routes } from '../../app/routes';
import {
  apiError,
  callsTo,
  json,
  mockApi,
  session,
  TEST_USER,
  type Handlers,
} from '../../test/api';
import { accessibilityViolations, renderWithProviders } from '../../test/render';

/** Thursday 26 November 2026, 10:00 in Karachi (the test user's time zone). */
const NOW = new Date('2026-11-26T05:00:00.000Z');
const TASK_ID = '6741f0c2a1b2c3d4e5f60c02';
const CLASS_ID = '6741f0c2a1b2c3d4e5f60aaa';

const RULE: SubmissionRule = {
  namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
  caseSensitive: false,
  allowedExtensions: ['pdf'],
  maxSizeMB: 10,
  channel: { kind: 'lms', label: 'Week 11 folder', url: 'https://lms.example.edu/week-11' },
  latePolicy: { kind: 'not_accepted', graceMinutes: 15 },
};

const task = (overrides: Partial<AgendaTask> = {}): AgendaTask => ({
  id: TASK_ID,
  classId: CLASS_ID,
  ownerId: null,
  announcementId: '6741f0c2a1b2c3d4e5f60e00',
  title: 'Lab 11 report',
  type: 'lab',
  dueAt: '2026-11-26T18:59:00.000Z',
  description: 'Normalize the schema from lab 10.\nSubmit one PDF.',
  courseId: '6741f0c2a1b2c3d4e5f60bbb',
  effort: null,
  submissionRule: RULE,
  createdAt: '2026-11-20T05:00:00.000Z',
  updatedAt: '2026-11-20T05:00:00.000Z',
  completedAt: null,
  course: { id: '6741f0c2a1b2c3d4e5f60bbb', code: 'CS-341', title: 'HCI', color: 'teal' },
  className: 'BS Computer Science',
  classSection: '5A',
  canManage: false,
  canEditRule: false,
  ...overrides,
});

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));
const PDF = new Uint8Array(ascii('%PDF-1.7\n1 0 obj'));
const WORD = new Uint8Array([
  ...[0x50, 0x4b, 0x03, 0x04],
  ...ascii('....[Content_Types].xml....word/document.xml'),
]);
const fileOf = (bytes: Uint8Array<ArrayBuffer>, name: string) => new File([bytes], name);

function start(item: AgendaTask | null, handlers: Handlers = {}) {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session()),
    [`GET /api/tasks/${TASK_ID}`]: () =>
      item ? json(200, item) : apiError(404, 'not_found', 'This task does not exist.'),
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [`/tasks/${TASK_ID}`] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

const FORBIDDEN = 'You do not have permission to do that.';

const fileInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the task page', () => {
  it('shows the task and how to submit it, with the exact file name to copy', async () => {
    const { user } = start(task());
    expect(await screen.findByRole('heading', { level: 1, name: 'Lab 11 report' })).toBeVisible();
    expect(screen.getByText(/^Due Thursday, November 26 at 11:59 PM · in 14 hours$/)).toBeVisible();
    expect(screen.getByText(/Normalize the schema from lab 10\./)).toBeVisible();
    expect(screen.getByRole('link', { name: 'See the announcement' })).toHaveAttribute(
      'href',
      `/classes/${CLASS_ID}?tab=announcements&announcement=6741f0c2a1b2c3d4e5f60e00`,
    );

    const rules = screen.getByRole('heading', { name: 'How to submit' })
      .parentElement as HTMLElement;
    expect(within(rules).getByText('Lab11_NU-24-0002_5A.pdf')).toBeVisible();
    expect(within(rules).getByText('Lab{TASK_NO}_{STUDENT_ID}_{SECTION}')).toBeVisible();
    expect(within(rules).getByText('PDF')).toBeVisible();
    expect(within(rules).getByText('10 MB')).toBeVisible();
    expect(
      within(rules).getByText('On the learning management system · Week 11 folder'),
    ).toBeVisible();
    expect(
      within(rules).getByText(
        'Not accepted after the deadline. Up to 15 minutes late still counts as on time.',
      ),
    ).toBeVisible();
    expect(within(rules).getByRole('link', { name: 'Open the submission page' })).toHaveAttribute(
      'href',
      'https://lms.example.edu/week-11',
    );
    // Students cannot change the rules.
    expect(screen.queryByRole('button', { name: 'Edit rules' })).not.toBeInTheDocument();

    await user.click(
      within(rules).getByRole('button', { name: 'Copy the file name Lab11_NU-24-0002_5A.pdf' }),
    );
    expect(await navigator.clipboard.readText()).toBe('Lab11_NU-24-0002_5A.pdf');
    expect(await screen.findAllByText('File name copied.')).not.toHaveLength(0);
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('catches a renamed Word file, explains every fix and approves the corrected file', async () => {
    const { user, container } = start(task());
    await screen.findByRole('heading', { level: 1, name: 'Lab 11 report' });

    await user.upload(fileInput(container), fileOf(WORD, 'lab 11 final.pdf'));
    const verdict = await screen.findByRole('heading', {
      name: 'Fix 2 problems before submitting',
    });
    await waitFor(() => expect(verdict).toHaveFocus());
    const results = verdict.closest('section') as HTMLElement;
    expect(within(results).getByText('lab 11 final.pdf')).toBeVisible();
    expect(within(results).getByText('The file name does not follow the rule.')).toBeVisible();
    expect(
      within(results).getByText(
        'Expected Lab11_NU-24-0002_5A, but the file is named lab 11 final. Use the separators from the rule instead of spaces.',
      ),
    ).toBeVisible();
    expect(
      within(results).getByText('This is not really a PDF file: it is a Word document.'),
    ).toBeVisible();
    expect(within(results).getByText(/It was probably renamed\./)).toBeVisible();
    expect(within(results).getByText('Rename the file to:')).toBeVisible();
    expect(within(results).getByText('Lab11_NU-24-0002_5A.pdf')).toBeVisible();
    expect(within(results).getByText('Submit it on the learning management system.')).toBeVisible();
    // Problems come first, and each status is spoken, not only colored.
    const items = within(results).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/^Problem:/);
    expect(items[1]).toHaveTextContent(/^Problem:/);
    expect(await accessibilityViolations()).toEqual([]);

    await user.upload(fileInput(container), fileOf(PDF, 'Lab11_NU-24-0002_5A.pdf'));
    const ready = await screen.findByRole('heading', { name: 'Ready to submit' });
    expect(
      within(ready.closest('section') as HTMLElement).getByText(
        'It follows every rule for this task.',
      ),
    ).toBeVisible();
    expect(screen.getByText('The file really is a PDF file.')).toBeVisible();
    expect(screen.getByText(/^Size \d+ byte/)).toBeVisible();
    expect(screen.getByText('On time: due in 14 hours.')).toBeVisible();
  });

  it('checks a file dropped onto the page', async () => {
    const { container } = start(task());
    await screen.findByRole('heading', { level: 1, name: 'Lab 11 report' });
    const zone = screen.getByText('Drag your file here').parentElement as HTMLElement;
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(within(zone).getByText('Drop the file to check it')).toBeVisible();
    fireEvent.dragLeave(zone, { relatedTarget: document.body });
    expect(within(zone).getByText('Drag your file here')).toBeVisible();
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, {
      dataTransfer: { files: [fileOf(new Uint8Array(), 'Lab11_NU-24-0002_5A.pdf')] },
    });
    expect(
      await screen.findByRole('heading', { name: 'Fix 1 problem before submitting' }),
    ).toBeVisible();
    expect(screen.getByText('The file is empty.')).toBeVisible();
    expect(screen.getByText('Save your work again and choose the saved file.')).toBeVisible();
    expect(fileInput(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('asks for missing details instead of guessing the file name', async () => {
    const { user, container } = start(task(), {
      'POST /api/auth/refresh': () => json(200, session({ ...TEST_USER, studentId: null })),
    });
    expect(
      await screen.findByText('Add your student ID to see your exact file name.'),
    ).toBeVisible();
    await user.upload(fileInput(container), fileOf(PDF, 'Lab11_12345_5A.pdf'));
    expect(
      await screen.findByRole('heading', { name: 'Check 1 thing before submitting' }),
    ).toBeVisible();
    expect(
      screen.getByText('The name looks right, but the student ID could not be checked.'),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Add it in your profile' })[0]).toHaveAttribute(
      'href',
      '/settings#section-profile',
    );
  });

  it('says which class details are missing, without sending the student to their profile', async () => {
    start(task({ classSection: null, title: 'Final lab report' }), {
      'POST /api/auth/refresh': () => json(200, session({ ...TEST_USER, studentId: null })),
    });
    expect(
      await screen.findByText('Add your student ID to see your exact file name.'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'This task has no task number and section set, so your exact file name cannot be worked out. Ask your class representative.',
      ),
    ).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Add it in your profile' })).toHaveLength(1);
  });

  it('still checks the content and timing of work without rules', async () => {
    vi.setSystemTime(new Date('2026-11-27T05:00:00.000Z'));
    const { user, container } = start(task({ submissionRule: null }));
    expect(
      await screen.findByText('No submission rules have been set for this task.'),
    ).toBeVisible();
    expect(screen.getByText(/You can still check that your file opens/)).toBeVisible();
    expect(screen.getByText('Overdue')).toBeVisible();

    await user.upload(fileInput(container), fileOf(WORD, 'notes.docx'));
    expect(
      await screen.findByRole('heading', { name: 'Check 1 thing before submitting' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Late: the deadline passed 10 hours ago. Check whether late work is accepted.',
      ),
    ).toBeVisible();
    expect(screen.getByText('The file really is a DOCX file.')).toBeVisible();
    // Where to submit is unknown, so it is not invented.
    expect(screen.queryByText(/^Submit it (on|by|in|as)/)).not.toBeInTheDocument();
  });

  it('marks the task done from its page', async () => {
    let done: string | null = null;
    const { user, fetchMock } = start(null, {
      [`GET /api/tasks/${TASK_ID}`]: () => json(200, task({ completedAt: done })),
      [`PUT /api/tasks/${TASK_ID}/completion`]: () => {
        done = NOW.toISOString();
        return json(200, { completedAt: done });
      },
    });
    const box = await screen.findByRole('checkbox', { name: 'Mark as done' });
    await user.click(box);
    await waitFor(() => expect(box).toBeChecked());
    expect(callsTo(fetchMock, 'PUT', `/api/tasks/${TASK_ID}/completion`)).toHaveLength(1);
  });

  it('says when the task does not exist, and goes back to Today', async () => {
    const { user, router } = start(null);
    expect(await screen.findByRole('heading', { name: 'Task not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open timeline' })).toHaveAttribute(
      'href',
      '/timeline',
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('explains when the task cannot be loaded', async () => {
    start(null, { [`GET /api/tasks/${TASK_ID}`]: () => apiError(500, 'internal_error') });
    expect(
      await screen.findByText('This task could not be loaded.', {}, { timeout: 10_000 }),
    ).toBeVisible();
  });
});

describe('setting submission rules', () => {
  it('builds a rule with details, a live example and validation, then saves it', async () => {
    let saved: unknown = null;
    const { user, fetchMock } = start(task({ submissionRule: null, canEditRule: true }), {
      [`PUT /api/tasks/${TASK_ID}/rule`]: ({ body }) => {
        saved = body;
        return json(200, task({ submissionRule: RULE, canEditRule: true }));
      },
    });
    expect(
      await screen.findByText(/Add the file name, file types, size limit and where to submit/),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add submission rules' }));
    const sheet = await screen.findByRole('dialog', { name: 'Submission rules' });

    const pattern = within(sheet).getByLabelText(/^File name rule/);
    await user.type(pattern, 'Lab');
    await user.click(within(sheet).getByRole('button', { name: 'Insert Task number' }));
    await user.type(pattern, '_');
    await user.click(within(sheet).getByRole('button', { name: 'Insert Student ID' }));
    expect(pattern).toHaveValue('Lab{TASK_NO}_{STUDENT_ID}');
    await user.click(within(sheet).getByRole('button', { name: 'pdf' }));
    expect(within(sheet).getByRole('button', { name: 'pdf' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(sheet).getByText('Lab3_70012345.pdf')).toBeVisible();

    await user.type(within(sheet).getByLabelText(/^Largest file size/), 'big');
    await user.type(within(sheet).getByLabelText(/^Other types/), 'sql, bad!');
    await user.click(within(sheet).getByRole('radio', { name: 'Accepted with a penalty' }));
    await user.clear(within(sheet).getByLabelText('Penalty (%)'));
    await user.type(within(sheet).getByLabelText('Penalty (%)'), '150');
    await user.click(within(sheet).getByRole('button', { name: 'Save rules' }));
    expect(
      await within(sheet).findByText('Enter a size from 0.1 to 1024 MB.', { selector: 'span' }),
    ).toBeVisible();
    expect(
      within(sheet).getAllByText('“bad!” is not a valid file extension.').length,
    ).toBeGreaterThan(0);
    expect(
      within(sheet).getAllByText('Enter a whole number from 1 to 100.').length,
    ).toBeGreaterThan(0);
    expect(callsTo(fetchMock, 'PUT', `/api/tasks/${TASK_ID}/rule`)).toHaveLength(0);

    await user.clear(within(sheet).getByLabelText(/^Largest file size/));
    await user.type(within(sheet).getByLabelText(/^Largest file size/), '10');
    await user.clear(within(sheet).getByLabelText(/^Other types/));
    await user.type(within(sheet).getByLabelText(/^Other types/), '.SQL');
    await user.clear(within(sheet).getByLabelText('Penalty (%)'));
    await user.type(within(sheet).getByLabelText('Penalty (%)'), '10');
    await user.type(within(sheet).getByLabelText(/^Details/), 'Week 11 folder');
    await user.click(within(sheet).getByRole('checkbox', { name: /Capital letters must match/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save rules' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toEqual({
      namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}',
      caseSensitive: true,
      allowedExtensions: ['pdf', 'sql'],
      maxSizeMB: 10,
      channel: { kind: 'lms', label: 'Week 11 folder', url: null },
      latePolicy: { kind: 'penalty', graceMinutes: 0, penaltyPercent: 10 },
    });
    expect(
      await screen.findAllByText('Submission rules saved. Students see them with the task.'),
    ).not.toHaveLength(0);
    expect(await screen.findByText('Lab11_NU-24-0002_5A.pdf')).toBeVisible();
    // Many keystrokes: allow for slower machines.
  }, 20_000);

  it('explains pattern mistakes in words', async () => {
    const { user } = start(task({ canEditRule: true }));
    await user.click(await screen.findByRole('button', { name: 'Edit rules' }));
    const sheet = await screen.findByRole('dialog', { name: 'Submission rules' });
    const pattern = within(sheet).getByLabelText(/^File name rule/);
    expect(pattern).toHaveValue('Lab{TASK_NO}_{STUDENT_ID}_{SECTION}');
    expect(within(sheet).getByLabelText(/^Link/)).toHaveValue('https://lms.example.edu/week-11');
    expect(within(sheet).getByLabelText(/^Grace period/)).toHaveValue('15');

    const tryPattern = async (value: string, message: string) => {
      fireEvent.change(pattern, { target: { value } });
      await user.click(within(sheet).getByRole('button', { name: 'Save rules' }));
      expect((await within(sheet).findAllByText(message)).length).toBeGreaterThan(0);
    };
    await tryPattern(
      'Lab{WEEK}',
      'WEEK is not a detail Sabaq knows. Use the buttons to insert one.',
    );
    await tryPattern('Lab{TASK_NO', 'Each { needs a matching }.');
    await tryPattern('Lab/{TASK_NO}', 'File names cannot contain /');
    fireEvent.change(within(sheet).getByLabelText(/^Link/), { target: { value: 'lms' } });
    await tryPattern('Lab', 'Enter a full web address starting with https://');
    fireEvent.change(within(sheet).getByLabelText(/^Grace period/), { target: { value: '-1' } });
    await tryPattern('Lab', 'Enter a whole number from 0 to 1440.');
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('removes rules with an Undo', async () => {
    const { user, fetchMock } = start(task({ canEditRule: true }), {
      [`DELETE /api/tasks/${TASK_ID}/rule`]: () =>
        json(200, task({ submissionRule: null, canEditRule: true })),
      [`PUT /api/tasks/${TASK_ID}/rule`]: () => json(200, task({ canEditRule: true })),
    });
    await user.click(await screen.findByRole('button', { name: 'Remove rules' }));
    expect(
      await screen.findByText('No submission rules have been set for this task.'),
    ).toBeVisible();
    await user.click((await screen.findAllByRole('button', { name: 'Undo' }))[0] as HTMLElement);
    await waitFor(() =>
      expect(callsTo(fetchMock, 'PUT', `/api/tasks/${TASK_ID}/rule`)).toHaveLength(1),
    );
    const [, init] = callsTo(fetchMock, 'PUT', `/api/tasks/${TASK_ID}/rule`)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(RULE);
    expect(await screen.findByText('Lab11_NU-24-0002_5A.pdf')).toBeVisible();
  });

  it('says when the server refuses to remove the rules', async () => {
    const { user } = start(task({ canEditRule: true }), {
      [`DELETE /api/tasks/${TASK_ID}/rule`]: () => apiError(403, 'forbidden'),
    });
    await user.click(await screen.findByRole('button', { name: 'Remove rules' }));
    expect(await screen.findAllByText(FORBIDDEN)).not.toHaveLength(0);
    expect(screen.getByText('Lab11_NU-24-0002_5A.pdf')).toBeVisible();
  });

  it('changes where to submit', async () => {
    let saved: unknown = null;
    const { user } = start(task({ canEditRule: true }), {
      [`PUT /api/tasks/${TASK_ID}/rule`]: ({ body }) => {
        saved = body;
        return json(200, task({ canEditRule: true }));
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Edit rules' }));
    const sheet = await screen.findByRole('dialog', { name: 'Submission rules' });
    await user.selectOptions(within(sheet).getByLabelText('Where to submit'), 'in_person');
    await user.click(within(sheet).getByRole('button', { name: 'pdf' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ allowedExtensions: [], channel: { kind: 'in_person' } });
  });

  it('says when saving fails offline', async () => {
    const { user } = start(task({ canEditRule: true }), {
      [`PUT /api/tasks/${TASK_ID}/rule`]: () => {
        throw new TypeError('Failed to fetch');
      },
      [`DELETE /api/tasks/${TASK_ID}/rule`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Edit rules' }));
    const sheet = await screen.findByRole('dialog', { name: 'Submission rules' });
    await user.click(within(sheet).getByRole('button', { name: 'Save rules' }));
    expect(
      await within(sheet).findByText(/You are offline, so this change was not saved/),
    ).toBeVisible();
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Remove rules' }));
    expect(
      await screen.findAllByText(/You are offline, so this change was not saved/),
    ).not.toHaveLength(0);
  });
});

describe('reaching the task page', () => {
  it('opens from Today, where the next deadline offers to check the file', async () => {
    const item = task();
    const { user, router } = start(item, {
      'GET /api/agenda': () =>
        json(200, {
          timeZone: 'Asia/Karachi',
          from: '2026-11-26',
          to: '2026-12-03',
          tasks: [item],
          sessions: [],
        }),
    });
    await router.navigate('/');
    const next = await screen.findByRole('region', { name: 'Next deadline' });
    expect(within(next).getByRole('link', { name: 'Check your file' })).toHaveAttribute(
      'href',
      `/tasks/${TASK_ID}`,
    );
    expect(screen.getByText('Submission rules')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Open “Lab 11 report”' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Lab 11 report' })).toBeVisible();
  });
});
