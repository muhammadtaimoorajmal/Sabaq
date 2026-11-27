import type { Agenda, AgendaSession, AgendaTask } from '@sabaq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { routes } from '../../app/routes';
import { callsTo, json, mockApi, session, TEST_USER, type Handlers } from '../../test/api';
import { accessibilityViolations, renderWithProviders } from '../../test/render';

/** Thursday 26 November 2026, 10:00 in Karachi (the test user's time zone). */
const NOW = new Date('2026-11-26T05:00:00.000Z');
const CLASS_ID = '6741f0c2a1b2c3d4e5f60aaa';
const COURSE = {
  id: '6741f0c2a1b2c3d4e5f60bbb',
  code: 'CS-341',
  title: 'Human-Computer Interaction',
  color: 'teal' as const,
};

const task = (overrides: Partial<AgendaTask>): AgendaTask => ({
  id: '6741f0c2a1b2c3d4e5f60c00',
  classId: CLASS_ID,
  ownerId: null,
  announcementId: '6741f0c2a1b2c3d4e5f60e00',
  title: 'Lab 11 report',
  type: 'lab',
  dueAt: '2026-11-26T18:59:00.000Z',
  description: '',
  courseId: COURSE.id,
  effort: null,
  submissionRule: null,
  createdAt: '2026-11-20T05:00:00.000Z',
  updatedAt: '2026-11-20T05:00:00.000Z',
  completedAt: null,
  course: COURSE,
  className: 'BS Computer Science',
  canManage: false,
  ...overrides,
});

const sessionAt = (overrides: Partial<AgendaSession>): AgendaSession => ({
  id: 's1',
  classId: CLASS_ID,
  className: 'BS Computer Science',
  course: COURSE,
  kind: 'lecture',
  day: '2026-11-26',
  startsAt: '2026-11-26T09:00:00.000Z',
  endsAt: '2026-11-26T10:30:00.000Z',
  venue: 'B-204',
  originalVenue: null,
  status: 'scheduled',
  announcementId: null,
  ...overrides,
});

const TASKS: AgendaTask[] = [
  task({
    id: '6741f0c2a1b2c3d4e5f60c01',
    title: 'Late essay',
    dueAt: '2026-11-24T18:00:00.000Z',
    type: 'assignment',
  }),
  task({ id: '6741f0c2a1b2c3d4e5f60c02', title: 'Lab 11 report' }),
  task({
    id: '6741f0c2a1b2c3d4e5f60c03',
    title: 'Revise chapter 4',
    type: 'reading',
    dueAt: '2026-11-27T15:00:00.000Z',
    classId: null,
    ownerId: TEST_USER.id,
    announcementId: null,
    course: null,
    courseId: null,
    className: null,
    canManage: true,
  }),
  task({
    id: '6741f0c2a1b2c3d4e5f60c04',
    title: 'Quiz 3',
    type: 'quiz',
    dueAt: '2026-11-30T04:00:00.000Z',
  }),
];
const SESSIONS: AgendaSession[] = [
  sessionAt({ id: 's1', startsAt: '2026-11-26T04:00:00.000Z', endsAt: '2026-11-26T05:30:00.000Z' }),
  sessionAt({ id: 's2', status: 'cancelled', announcementId: '6741f0c2a1b2c3d4e5f60e01' }),
  sessionAt({
    id: 's3',
    kind: 'lab',
    status: 'moved',
    venue: 'Hall A',
    originalVenue: 'Lab 3',
    startsAt: '2026-11-26T11:00:00.000Z',
    endsAt: '2026-11-26T13:00:00.000Z',
  }),
];
const agenda = (overrides: Partial<Agenda> = {}): Agenda => ({
  timeZone: 'Asia/Karachi',
  from: '2026-11-26',
  to: '2026-12-03',
  tasks: TASKS,
  sessions: SESSIONS,
  ...overrides,
});

function start(path: string, handlers: Handlers = {}) {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session()),
    'GET /api/classes': () =>
      json(200, [{ id: CLASS_ID, name: 'BS Computer Science', role: 'student' }]),
    'GET /api/agenda': () => json(200, agenda()),
    [`GET /api/classes/${CLASS_ID}/courses`]: () => json(200, []),
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Today', () => {
  it('leads with the next deadline, then overdue, today, classes, tomorrow and the week', async () => {
    start('/');
    const next = await screen.findByRole('region', { name: 'Next deadline' });
    expect(within(next).getByText('Lab 11 report')).toBeInTheDocument();
    expect(
      within(next).getByText(/^Due Thursday, November 26 at 11:59 PM · in 14 hours$/),
    ).toBeInTheDocument();

    const overdue = screen.getByRole('region', { name: /Overdue/ });
    expect(within(overdue).getByText('Late essay')).toBeInTheDocument();
    expect(within(overdue).getByText(/^Was due/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Due today/ })).toHaveTextContent('Lab 11 report');
    expect(screen.getByRole('region', { name: /Tomorrow/ })).toHaveTextContent('Revise chapter 4');
    expect(screen.getByRole('region', { name: /Later this week/ })).toHaveTextContent('Quiz 3');

    const classes = screen.getByRole('region', { name: "Today's classes" });
    expect(within(classes).getByText('Cancelled')).toBeInTheDocument();
    expect(within(classes).getByText('Hall A (usually Lab 3)')).toBeInTheDocument();
    expect(within(classes).getByText('9:00 AM–10:30 AM')).toBeInTheDocument();
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('marks a task done at once, with an Undo', async () => {
    // The mock remembers the change, like the real server.
    let done: string | null = null;
    const { user, fetchMock } = start('/', {
      'GET /api/agenda': () =>
        json(
          200,
          agenda({
            tasks: TASKS.map((item) =>
              item.id === TASKS[1]?.id ? { ...item, completedAt: done } : item,
            ),
          }),
        ),
      'PUT /api/tasks/6741f0c2a1b2c3d4e5f60c02/completion': () => {
        done = NOW.toISOString();
        return json(200, { completedAt: done });
      },
      'DELETE /api/tasks/6741f0c2a1b2c3d4e5f60c02/completion': () => {
        done = null;
        return json(204);
      },
    });
    const box = await screen.findByRole('checkbox', { name: /Lab 11 report/ });
    await user.click(box);
    await waitFor(() => expect(box).toBeChecked());
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(
        callsTo(fetchMock, 'DELETE', '/api/tasks/6741f0c2a1b2c3d4e5f60c02/completion'),
      ).toHaveLength(1),
    );
    expect(
      callsTo(fetchMock, 'PUT', '/api/tasks/6741f0c2a1b2c3d4e5f60c02/completion'),
    ).toHaveLength(1);
  });

  it('puts the change back and explains when offline', async () => {
    const { user } = start('/', {
      'PUT /api/tasks/6741f0c2a1b2c3d4e5f60c02/completion': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const box = await screen.findByRole('checkbox', { name: /Lab 11 report/ });
    await user.click(box);
    expect(
      await screen.findByText(/You are offline, so this change was not saved/),
    ).toBeInTheDocument();
    await waitFor(() => expect(box).not.toBeChecked());
  });

  it('adds a personal task after checking it, and edits and deletes it', async () => {
    const { user, fetchMock } = start('/', {
      'POST /api/tasks': () => json(201, TASKS[2]),
      'PATCH /api/tasks/6741f0c2a1b2c3d4e5f60c03': () => json(200, TASKS[2]),
      'DELETE /api/tasks/6741f0c2a1b2c3d4e5f60c03': () => json(204),
    });
    await user.click(await screen.findByRole('button', { name: 'Add a personal task' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add a personal task' });
    await user.click(within(sheet).getByRole('button', { name: 'Add task' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('There are 2 problems to fix');
    await user.type(within(sheet).getByLabelText(/What do you need to do/), 'Print notes');
    await user.click(within(sheet).getByRole('button', { name: 'Tomorrow' }));
    await user.click(within(sheet).getByRole('button', { name: 'Add task' }));
    expect(await screen.findByText('Task added.')).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'POST', '/api/tasks')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      title: 'Print notes',
      type: 'assignment',
      dueAt: '2026-11-27T18:59:00.000Z',
      courseId: null,
    });

    await user.click(screen.getByRole('button', { name: 'Actions for “Revise chapter 4”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const editSheet = await screen.findByRole('dialog', { name: 'Edit task' });
    await user.click(within(editSheet).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Task saved.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for “Revise chapter 4”' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: /Delete “Revise chapter 4”/ });
    await user.click(within(confirm).getByRole('button', { name: 'Delete task' }));
    expect(await screen.findByText('Task deleted.')).toBeInTheDocument();
  });

  it('teaches what to do when there is nothing yet', async () => {
    start('/', {
      'GET /api/classes': () => json(200, []),
      'GET /api/agenda': () => json(200, agenda({ tasks: [], sessions: [] })),
    });
    expect(
      await screen.findByRole('heading', { name: 'Your semester starts here' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join a class' })).toBeInTheDocument();
    expect(screen.getByText('Join a class to see its timetable here.')).toBeInTheDocument();
  });

  it('says when the week is clear', async () => {
    start('/', { 'GET /api/agenda': () => json(200, agenda({ tasks: [], sessions: [] })) });
    expect(
      await screen.findByRole('heading', { name: 'Nothing due this week' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No classes today.')).toBeInTheDocument();
  });
});

describe('Timeline', () => {
  it('lists days with their tasks and classes, and filters them', async () => {
    const { user, router } = start('/timeline');
    expect(
      await screen.findByRole('heading', { level: 2, name: '30 days from Thursday, November 26' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 3, name: /Thursday, November 26/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Quiz 3')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Kind of task'), 'reading');
    expect(router.state.location.search).toContain('type=reading');
    expect(screen.queryByText('Quiz 3')).not.toBeInTheDocument();
    expect(screen.getByText('Revise chapter 4')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Kind of task'), 'exam');
    expect(
      screen.getByRole('heading', { name: 'Nothing matches these filters' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Quiz 3')).toBeInTheDocument();
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('shows done work only when asked', async () => {
    const { user } = start('/timeline', {
      'GET /api/agenda': () =>
        json(
          200,
          agenda({ tasks: [task({ title: 'Finished lab', completedAt: NOW.toISOString() })] }),
        ),
    });
    await screen.findByRole('heading', { level: 2, name: /30 days from/ });
    expect(screen.queryByText('Finished lab')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Show done' }));
    expect(screen.getByText('Finished lab')).toBeInTheDocument();
  });

  it('moves through weeks, fetching each one', async () => {
    const { user, fetchMock } = start('/timeline?view=week');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nov 23 – Nov 29, 2026' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nov 30 – Dec 6, 2026' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('from=2026-11-30&to=2026-12-06')),
      ).toBe(true),
    );
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nov 16 – Nov 22, 2026' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nov 23 – Nov 29, 2026' }),
    ).toBeInTheDocument();
  });

  it('shows a month grid that arrow keys move through', async () => {
    const { user } = start('/timeline?view=month');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'November 2026' }),
    ).toBeInTheDocument();
    const today = await screen.findByRole('button', {
      name: 'Thursday, November 26, 1 task due, class changes',
    });
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 3, name: /Thursday, November 26/ }),
    ).toBeInTheDocument();

    today.focus();
    fireEvent.keyDown(today, { key: 'ArrowDown' });
    const nextWeek = screen.getByRole('button', { name: /^Thursday, December 3,/ });
    expect(nextWeek).toHaveAttribute('aria-pressed', 'true');
    expect(nextWeek).toHaveFocus();
    fireEvent.keyDown(nextWeek, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /^Wednesday, December 2,/ })).toHaveFocus();

    // Moving into December by keyboard shows December.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'December 2026' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'November 2026' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'December 2026' }),
    ).toBeInTheDocument();
  });

  it('moves the list thirty days at a time', async () => {
    const { user } = start('/timeline');
    await user.click(await screen.findByRole('button', { name: 'Next 30 days' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: '30 days from Saturday, December 26' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous 30 days' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: '30 days from Thursday, November 26' }),
    ).toBeInTheDocument();
  });
});
