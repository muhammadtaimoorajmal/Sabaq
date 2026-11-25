import type { ClassForMember, Course, Member } from '@sabaq/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
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

const CLASS_ID = '6741f0c2a1b2c3d4e5f60aaa';
const cls = (overrides: Partial<ClassForMember> = {}): ClassForMember => ({
  id: CLASS_ID,
  name: 'BS Computer Science',
  section: '5A',
  program: 'BS Computer Science',
  term: 'Fall 2026',
  institution: 'Northfield University',
  timeZone: 'Asia/Karachi',
  memberCount: 3,
  createdAt: '2026-09-01T09:00:00.000Z',
  role: 'class_rep',
  joinCode: 'K7MQ3XRA',
  ...overrides,
});
const COURSE: Course = {
  id: '6741f0c2a1b2c3d4e5f60bbb',
  classId: CLASS_ID,
  code: 'CS-341',
  title: 'Human-Computer Interaction',
  instructorName: 'Dr. Ayesha Siddiqui',
  color: 'blue',
  schedule: [{ kind: 'lecture', dayOfWeek: 1, start: '09:00', end: '10:30', venue: 'B-204' }],
  createdAt: '2026-09-01T09:00:00.000Z',
};
const member = (id: string, name: string, role: Member['role']): Member => ({
  user: { id, name, avatarUrl: null },
  role,
  joinedAt: '2026-09-02T09:00:00.000Z',
});
const MEMBERS = [
  member(TEST_USER.id, TEST_USER.name, 'class_rep'),
  member('6741f0c2a1b2c3d4e5f60ccc', 'Ali Raza', 'student'),
  member('6741f0c2a1b2c3d4e5f60ddd', 'Dr. Ayesha Siddiqui', 'instructor'),
];

function start(path: string, handlers: Handlers = {}) {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session()),
    [`GET /api/classes/${CLASS_ID}`]: () => json(200, cls()),
    [`GET /api/classes/${CLASS_ID}/courses`]: () => json(200, [COURSE]),
    [`GET /api/classes/${CLASS_ID}/members`]: () => json(200, MEMBERS),
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

const bodyOf = (fetchMock: ReturnType<typeof mockApi>, method: string, path: string) =>
  JSON.parse(String(callsTo(fetchMock, method, path)[0]?.[1]?.body)) as unknown;

describe('classes list', () => {
  it('offers to join or create a class when there are none, also on Today', async () => {
    start('/classes');
    expect(await screen.findByText('You are not in a class yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join a class' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: 'Create a class' })).toHaveAttribute(
      'href',
      '/classes/new',
    );
  });

  it('lists classes with role and size', async () => {
    start('/', { 'GET /api/classes': () => json(200, [cls()]) });
    const link = await screen.findByRole('link', { name: /BS Computer Science/ });
    expect(link).toHaveAttribute('href', `/classes/${CLASS_ID}`);
    expect(within(link).getByText('Class representative')).toBeInTheDocument();
    expect(within(link).getByText('3 members')).toBeInTheDocument();
  });

  it('offers a retry when classes cannot be loaded', async () => {
    start('/classes', { 'GET /api/classes': () => apiError(500, 'internal_error') });
    expect(
      await screen.findByText('Your classes could not be loaded.', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});

describe('joining', () => {
  it('fills in the code from a shared link and joins in one tap', async () => {
    const { user, router, fetchMock } = start('/join?code=k7mq3xra', {
      'POST /api/classes/join': () => json(201, cls({ role: 'student' })),
    });
    const input = await screen.findByLabelText(/Join code/);
    expect(input).toHaveValue('K7MQ-3XRA');
    await user.click(screen.getByRole('button', { name: 'Join class' }));
    expect(await screen.findByText('You joined BS Computer Science.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/classes/${CLASS_ID}`));
    expect(bodyOf(fetchMock, 'POST', '/api/classes/join')).toEqual({ code: 'K7MQ3XRA' });
  });

  it('formats a typed code, checks its length and explains an unknown one', async () => {
    const { user } = start('/join', {
      'POST /api/classes/join': () => apiError(404, 'join_code_invalid'),
    });
    const input = await screen.findByLabelText(/Join code/);
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Join class' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter the 8 letters and numbers of the code.',
    );
    await user.type(input, 'd 2345');
    expect(input).toHaveValue('ABCD-2345');
    await user.click(screen.getByRole('button', { name: 'Join class' }));
    expect(await screen.findByText(/No class uses this code/)).toBeInTheDocument();
  });

  it('says so when you are already in the class', async () => {
    const { user } = start('/join?code=K7MQ-3XRA', {
      'GET /api/classes': () => json(200, [cls()]),
      'POST /api/classes/join': () => json(200, cls()),
    });
    await screen.findByRole('heading', { level: 1, name: 'Join a class' });
    await waitFor(() => expect(screen.getByLabelText(/Join code/)).toHaveValue('K7MQ-3XRA'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(screen.getByRole('button', { name: 'Join class' }));
    expect(await screen.findByText('You are already in BS Computer Science.')).toBeInTheDocument();
  });
});

describe('creating a class', () => {
  // A long journey with a lot of typing; slower when every test file runs at once.
  it('lists missing details, then creates the class and opens it', async () => {
    const { user, router, fetchMock } = start('/classes/new', {
      'POST /api/classes': () => json(201, cls({ role: 'instructor' })),
    });
    await user.click(await screen.findByRole('button', { name: 'Create class' }));
    expect(screen.getByRole('alert')).toHaveTextContent('There are 3 problems to fix');

    await user.type(screen.getByLabelText(/Class name/), 'BS Computer Science');
    await user.type(screen.getByLabelText(/^Section/), '5A');
    await user.type(screen.getByLabelText(/^Term/), 'Fall 2026');
    await user.type(screen.getByLabelText(/^Program/), 'BS Computer Science');
    await user.selectOptions(screen.getByLabelText(/Time zone/), 'Asia/Karachi');
    await user.click(screen.getByRole('radio', { name: 'I am the instructor' }));
    await user.click(screen.getByRole('button', { name: 'Create class' }));

    expect(
      await screen.findByText('Class created. Share the join code with your class.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/classes/${CLASS_ID}`);
    expect(bodyOf(fetchMock, 'POST', '/api/classes')).toEqual({
      name: 'BS Computer Science',
      section: '5A',
      term: 'Fall 2026',
      program: 'BS Computer Science',
      timeZone: 'Asia/Karachi',
      myRole: 'instructor',
    });
  }, 15_000);
});

describe('a class', () => {
  it('shows the invite card, copies the code and link, and shows a QR code', async () => {
    const { user } = start(`/classes/${CLASS_ID}`);
    expect(await screen.findByText('K7MQ-3XRA')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(await navigator.clipboard.readText()).toBe('K7MQ-3XRA');
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/join?code=K7MQ-3XRA`,
    );
    expect(await screen.findAllByText('Copied to the clipboard.')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Show QR code' }));
    expect(
      await screen.findByRole('img', {
        name: 'QR code that opens the join link for BS Computer Science',
      }),
    ).toBeInTheDocument();
  });

  it('replaces the join code after confirming', async () => {
    const { user } = start(`/classes/${CLASS_ID}`, {
      [`POST /api/classes/${CLASS_ID}/join-code`]: () => json(200, cls({ joinCode: 'ZZZZ2222' })),
    });
    await user.click(await screen.findByRole('button', { name: 'Get a new code' }));
    const dialog = screen.getByRole('dialog', { name: 'Replace the join code?' });
    await user.click(within(dialog).getByRole('button', { name: 'Get a new code' }));
    expect(await screen.findByText('ZZZZ-2222')).toBeInTheDocument();
  });

  it('shows courses with their timetable', async () => {
    start(`/classes/${CLASS_ID}`);
    expect(
      await screen.findByRole('heading', { name: 'Human-Computer Interaction' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM–10:30 AM')).toBeInTheDocument();
  });

  it('adds a course with a session, checking the times and duplicate codes', async () => {
    let attempts = 0;
    const { user, fetchMock } = start(`/classes/${CLASS_ID}`, {
      [`GET /api/classes/${CLASS_ID}/courses`]: () => json(200, []),
      [`POST /api/classes/${CLASS_ID}/courses`]: ({ body }) =>
        attempts++ === 0
          ? json(400, {
              error: {
                code: 'validation_failed',
                message: 'x',
                requestId: 'r',
                issues: [{ path: 'code', code: 'duplicate', message: 'duplicate' }],
              },
            })
          : json(201, { ...COURSE, ...(body as object) }),
    });
    await user.click(await screen.findByRole('button', { name: 'Add a course' }));
    const sheet = screen.getByRole('dialog', { name: 'Add a course' });
    await user.type(within(sheet).getByLabelText(/Course code/), 'CS-352');
    await user.type(within(sheet).getByLabelText(/Course title/), 'Software Engineering');
    await user.click(within(sheet).getByRole('radio', { name: 'Teal' }));
    await user.click(within(sheet).getByRole('button', { name: 'Add a session' }));
    const end = within(sheet).getByLabelText('Ends');
    await user.clear(end);
    await user.type(end, '08:00');
    await user.click(within(sheet).getByRole('button', { name: 'Save course' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent(
      'The session must end after it starts.',
    );

    await user.clear(end);
    await user.type(end, '11:00');
    await user.click(within(sheet).getByRole('button', { name: 'Save course' }));
    await waitFor(() =>
      expect(within(sheet).getByLabelText(/Course code/)).toHaveAccessibleDescription(
        /A course with this code already exists in the class\./,
      ),
    );

    await user.clear(within(sheet).getByLabelText(/Course code/));
    await user.type(within(sheet).getByLabelText(/Course code/), 'CS-353');
    await user.click(within(sheet).getByRole('button', { name: 'Save course' }));
    expect(await screen.findByText('CS-353 saved.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', `/api/classes/${CLASS_ID}/courses`)).toHaveLength(2);
    const [, init] = callsTo(fetchMock, 'POST', `/api/classes/${CLASS_ID}/courses`)[1] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      code: 'CS-353',
      color: 'teal',
      instructorName: null,
      schedule: [{ kind: 'lecture', dayOfWeek: 1, start: '09:00', end: '11:00', venue: null }],
    });
  });

  it('edits and removes a course', async () => {
    const { user, fetchMock } = start(`/classes/${CLASS_ID}`, {
      [`PATCH /api/classes/${CLASS_ID}/courses/${COURSE.id}`]: () => json(200, COURSE),
      [`DELETE /api/classes/${CLASS_ID}/courses/${COURSE.id}`]: () => json(204),
    });
    await user.click(await screen.findByRole('button', { name: 'Actions for CS-341' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit CS-341' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit CS-341' });
    expect(within(sheet).getByLabelText(/Course title/)).toHaveValue('Human-Computer Interaction');
    await user.click(within(sheet).getByRole('button', { name: 'Remove session 1' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save course' }));
    expect(await screen.findByText('CS-341 saved.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for CS-341' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove CS-341' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remove CS-341?' })).getByRole('button', {
        name: 'Remove CS-341',
      }),
    );
    expect(await screen.findByText('CS-341 removed.')).toBeInTheDocument();
    expect(
      callsTo(fetchMock, 'DELETE', `/api/classes/${CLASS_ID}/courses/${COURSE.id}`),
    ).toHaveLength(1);
  });

  it('manages members: change a role, remove someone, and leave', async () => {
    const { user, router, fetchMock } = start(`/classes/${CLASS_ID}?tab=members`, {
      [`PATCH /api/classes/${CLASS_ID}/members/6741f0c2a1b2c3d4e5f60ccc`]: () => json(200, MEMBERS),
      [`DELETE /api/classes/${CLASS_ID}/members/6741f0c2a1b2c3d4e5f60ccc`]: () => json(204),
      [`DELETE /api/classes/${CLASS_ID}/members/${TEST_USER.id}`]: () => json(204),
    });
    expect(await screen.findByText('Ali Raza')).toBeInTheDocument();
    // A class representative cannot change an instructor.
    expect(
      screen.queryByRole('button', { name: 'Actions for Dr. Ayesha Siddiqui' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for Ali Raza' }));
    expect(screen.queryByRole('menuitem', { name: 'Make Instructor' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Make Class representative' }));
    expect(await screen.findByText('Ali Raza is now Class representative.')).toBeInTheDocument();
    expect(
      bodyOf(fetchMock, 'PATCH', `/api/classes/${CLASS_ID}/members/6741f0c2a1b2c3d4e5f60ccc`),
    ).toEqual({
      role: 'class_rep',
    });

    await user.click(screen.getByRole('button', { name: 'Actions for Ali Raza' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove from class' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remove Ali Raza?' })).getByRole('button', {
        name: 'Remove from class',
      }),
    );
    expect(await screen.findByText('Ali Raza was removed.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Leave class' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Leave BS Computer Science?' })).getByRole(
        'button',
        { name: 'Leave class' },
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/classes'));
  });

  it('explains why the last manager cannot leave', async () => {
    const { user } = start(`/classes/${CLASS_ID}?tab=members`, {
      [`DELETE /api/classes/${CLASS_ID}/members/${TEST_USER.id}`]: () =>
        apiError(409, 'last_manager'),
    });
    await user.click(await screen.findByRole('button', { name: 'Leave class' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave class' }),
    );
    expect(
      await screen.findByText(/needs at least one instructor or class representative/),
    ).toBeInTheDocument();
  });

  it('saves class details and removes the class from settings', async () => {
    const { user, router, fetchMock } = start(`/classes/${CLASS_ID}?tab=settings`, {
      [`PATCH /api/classes/${CLASS_ID}`]: ({ body }) =>
        json(200, cls(body as Partial<ClassForMember>)),
      [`DELETE /api/classes/${CLASS_ID}`]: () => json(204),
    });
    const name = await screen.findByLabelText(/Class name/);
    await user.clear(name);
    await user.type(name, 'BSCS');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Class details saved.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PATCH', `/api/classes/${CLASS_ID}`)).not.toHaveProperty('myRole');

    await user.click(screen.getByRole('button', { name: 'Remove class' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove class' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/classes'));
  });

  it('hides management from students', async () => {
    start(`/classes/${CLASS_ID}`, {
      [`GET /api/classes/${CLASS_ID}`]: () => json(200, cls({ role: 'student' })),
    });
    await screen.findByRole('heading', { name: 'Human-Computer Interaction' });
    expect(screen.queryByRole('tab', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get a new code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for CS-341' })).not.toBeInTheDocument();
  });

  it('shows the not-found page for a class you are not in', async () => {
    start(`/classes/${CLASS_ID}`, {
      [`GET /api/classes/${CLASS_ID}`]: () => apiError(404, 'not_found'),
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it.each([
    ['/classes', {}],
    ['/join', {}],
    ['/classes/new', {}],
    [`/classes/${CLASS_ID}`, {}],
    [`/classes/${CLASS_ID}?tab=members`, {}],
    [`/classes/${CLASS_ID}?tab=settings`, {}],
  ])('%s has no detectable violations', async (path, handlers) => {
    start(path, handlers);
    await screen.findByRole('heading', { level: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await accessibilityViolations()).toEqual([]);
  });
});
