import { computeDailyLoad, type Workload, type WorkloadItem } from '@sabaq/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { routes } from '../../app/routes';
import { apiError, callsTo, json, mockApi, session, type Handlers } from '../../test/api';
import { accessibilityViolations, renderWithProviders } from '../../test/render';
import { DueDateAdvice } from './DueDateAdvice';

/** Thursday 26 November 2026, 10:00 in Karachi. Weeks start on Monday 23 November. */
const NOW = new Date('2026-11-26T05:00:00.000Z');
const CLASS_ID = '6741f0c2a1b2c3d4e5f60aaa';
const ZONE = 'Asia/Karachi';
const COURSE = {
  id: '6741f0c2a1b2c3d4e5f60bbb',
  code: 'CS-341',
  title: 'HCI',
  color: 'teal' as const,
};

const item = (id: number, overrides: Partial<WorkloadItem>): WorkloadItem => ({
  id: `6741f0c2a1b2c3d4e5f60c${String(id).padStart(2, '0')}`,
  title: 'Task',
  type: 'assignment',
  dueAt: '2026-11-30T13:00:00.000Z',
  effort: null,
  course: COURSE,
  classId: CLASS_ID,
  className: 'BS Computer Science',
  ...overrides,
});

const ITEMS: WorkloadItem[] = [
  // Tuesday 24 November, already past: heavy, but behind us.
  item(1, { title: 'Old exam', type: 'exam', dueAt: '2026-11-24T05:00:00.000Z' }),
  item(2, { title: 'Old quiz', type: 'quiz', dueAt: '2026-11-24T06:00:00.000Z' }),
  // Monday 30 November: a project and an assignment, heavy.
  item(3, { title: 'Project milestone', type: 'project', dueAt: '2026-11-30T13:00:00.000Z' }),
  item(4, { title: 'Assignment 2', dueAt: '2026-11-30T18:59:00.000Z' }),
  // Tuesday 1 December: a lab, light; a personal task.
  item(5, { title: 'Lab 11', type: 'lab', dueAt: '2026-12-01T18:59:00.000Z' }),
  item(6, {
    title: 'Revise chapter 4',
    type: 'reading',
    dueAt: '2026-12-01T10:00:00.000Z',
    course: null,
    classId: null,
    className: null,
  }),
];

const workload = (from: string, to: string, items = ITEMS): Workload => ({
  timeZone: ZONE,
  from,
  to,
  days: computeDailyLoad(items, { from, to, timeZone: ZONE }),
  items,
});

function start(path: string, handlers: Handlers = {}) {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session()),
    'GET /api/workload': () => json(200, workload('2026-11-23', '2026-12-20')),
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

describe('the workload page', () => {
  it('sums up the weeks ahead in words, and shows each day without relying on colour', async () => {
    const { user, fetchMock } = start('/workload');
    expect(
      await screen.findByRole('heading', { level: 2, name: '1 heavy day ahead' }),
    ).toBeVisible();
    expect(screen.getByText('Busiest week: Nov 30 – Dec 6, with 4 tasks due.')).toBeVisible();
    expect(callsTo(fetchMock, 'GET', '/api/workload')[0]?.[0]).toContain(
      'from=2026-11-23&to=2026-12-20',
    );

    const heavy = screen.getByRole('button', {
      name: 'Monday, November 30: heavy, 2 tasks due',
    });
    expect(heavy).toHaveTextContent('30');
    const today = screen.getByRole('button', { name: /^Thursday, November 26: free/ });
    expect(today).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Thursday, November 26: Free' })).toBeVisible();
    expect(screen.getByText('Nothing is due on this day.')).toBeVisible();

    // Arrow keys move by a day and by a week.
    today.focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    const tuesday = screen.getByRole('button', { name: /^Tuesday, December 1: light/ });
    await waitFor(() => expect(tuesday).toHaveFocus());
    const panel = screen.getByRole('region', { name: 'Tuesday, December 1: Light' });
    expect(within(panel).getByRole('link', { name: 'Lab 11' })).toHaveAttribute(
      'href',
      `/tasks/${ITEMS[4]?.id}`,
    );
    expect(within(panel).getByText('Personal')).toBeVisible();
    await user.keyboard('{Home}');
    expect(tuesday).toHaveFocus();

    // The legend explains the dots.
    expect(screen.getByText('Each dot is one step heavier.')).toBeVisible();
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('shows the same days as a table and a longer period on request', async () => {
    const { user, fetchMock, router } = start('/workload', {
      'GET /api/workload': () => json(200, workload('2026-11-23', '2027-03-14')),
    });
    await screen.findByRole('heading', { level: 2, name: '1 heavy day ahead' });
    await user.click(screen.getByRole('radio', { name: 'Table' }));
    const table = screen.getByRole('table', {
      name: 'Days with work due. Free days are left out.',
    });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(rows[2] as HTMLElement).getByRole('rowheader')).toHaveTextContent(
      'Monday, November 30',
    );
    expect(rows[2]).toHaveTextContent('Heavy');
    expect(rows[2]).toHaveTextContent('Project milestone');
    expect(router.state.location.search).toBe('?show=table');

    await user.click(screen.getByRole('radio', { name: 'Next 16 weeks' }));
    await waitFor(() =>
      expect(callsTo(fetchMock, 'GET', '/api/workload').at(-1)?.[0]).toContain('to=2027-03-14'),
    );
    expect(router.state.location.search).toBe('?show=table&range=term');
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('says when nothing is due, and when the workload cannot be loaded', async () => {
    start('/workload', {
      'GET /api/workload': () => json(200, workload('2026-11-23', '2026-12-20', [])),
    });
    expect(
      await screen.findByRole('heading', { name: 'No heavy days ahead. The work is spread out.' }),
    ).toBeVisible();
    expect(screen.getByText('Nothing is due in this period.')).toBeVisible();
  });

  it('explains a failure', async () => {
    start('/workload', { 'GET /api/workload': () => apiError(403, 'forbidden') });
    expect(await screen.findByText('The workload could not be loaded.')).toBeVisible();
  });

  it('is reached from the timeline, and each class has its own', async () => {
    const { user, fetchMock, router } = start('/timeline', {
      'GET /api/classes': () =>
        json(200, [
          {
            id: CLASS_ID,
            name: 'BS Computer Science',
            program: 'BSCS',
            term: 'Fall 2026',
            section: '5A',
            timeZone: ZONE,
            role: 'student',
            memberCount: 30,
            joinCode: null,
            archivedAt: null,
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ]),
      [`GET /api/classes/${CLASS_ID}`]: () =>
        json(200, {
          id: CLASS_ID,
          name: 'BS Computer Science',
          program: 'BSCS',
          term: 'Fall 2026',
          section: '5A',
          timeZone: ZONE,
          role: 'student',
          memberCount: 30,
          joinCode: null,
          archivedAt: null,
          createdAt: '2026-09-01T00:00:00.000Z',
        }),
      [`GET /api/classes/${CLASS_ID}/workload`]: () =>
        json(200, workload('2026-11-23', '2026-12-20', ITEMS.slice(2, 5))),
    });
    await user.click(await screen.findByRole('link', { name: 'Workload' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/workload'));

    await router.navigate(`/classes/${CLASS_ID}?tab=workload`);
    expect(
      await screen.findByText('How heavy each day is for this class, across all its courses.'),
    ).toBeVisible();
    expect(await screen.findByRole('heading', { name: '1 heavy day ahead' })).toBeVisible();
    expect(callsTo(fetchMock, 'GET', `/api/classes/${CLASS_ID}/workload`)).not.toHaveLength(0);
  });
});

describe('advice while choosing a due date', () => {
  const advise = (dueAt: string, handlers: Handlers, onPick = vi.fn()) => {
    mockApi(handlers);
    const result = renderWithProviders(
      <MemoryRouter>
        <DueDateAdvice
          classId={CLASS_ID}
          timeZone={ZONE}
          dueAt={dueAt}
          type="quiz"
          ignoreTaskId={null}
          onPick={onPick}
        />
      </MemoryRouter>,
    );
    return { ...result, onPick };
  };
  const classWorkload = (items: WorkloadItem[]) => ({
    [`GET /api/classes/${CLASS_ID}/workload`]: () =>
      json(200, workload('2026-11-27', '2026-12-03', items)),
  });

  it('warns about a busy day and offers lighter days nearby, at the same time', async () => {
    const { user, onPick } = advise('2026-11-30T18:59:00.000Z', classWorkload(ITEMS.slice(2)));
    const alert = await screen.findByText('Monday, November 30 is already busy for the class');
    const box = alert.closest('div')?.parentElement as HTMLElement;
    expect(
      within(box).getByText(
        /2 other tasks are due that day: CS-341 Project milestone and CS-341 Assignment 2\. With this one, the day is extreme\./,
      ),
    ).toBeVisible();
    expect(
      within(box).getByText('This is only advice: you can still choose this day.'),
    ).toBeVisible();
    const choices = within(box).getAllByRole('button');
    expect(choices.map((button) => button.textContent)).toEqual([
      'Sunday, November 29 (light)',
      'Wednesday, December 2 (light)',
      // As close as possible: two days earlier beats three days later.
      'Saturday, November 28 (light)',
    ]);
    await user.click(choices[1] as HTMLElement);
    // 11:59 PM in Karachi on the new day.
    expect(onPick).toHaveBeenCalledWith('2026-12-02T18:59:00.000Z');
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('confirms a calm day quietly', async () => {
    advise('2026-12-02T18:59:00.000Z', classWorkload(ITEMS.slice(2)));
    expect(await screen.findByText('The class on Wednesday, December 2')).toBeVisible();
    expect(
      screen.getByText('Nothing else is due that day. With this one, the day is light.'),
    ).toBeVisible();
  });

  it('says when there is no lighter day, and stays silent offline', async () => {
    // Every day nearby already has an exam and a project.
    const days = ['11-27', '11-28', '11-29', '11-30', '12-01', '12-02', '12-03'];
    const crowded = days.flatMap((day, index) => [
      item(10 + index * 2, { type: 'exam', dueAt: `2026-${day}T10:00:00.000Z` }),
      item(11 + index * 2, { type: 'project', dueAt: `2026-${day}T11:00:00.000Z` }),
    ]);
    advise('2026-11-30T18:59:00.000Z', classWorkload(crowded));
    expect(await screen.findByText('There is no lighter day nearby.')).toBeVisible();
  });

  it('leaves the advice out when the workload cannot be read', async () => {
    advise('2026-11-30T18:59:00.000Z', {
      [`GET /api/classes/${CLASS_ID}/workload`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(screen.getByText('Checking how busy the class is that day…')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByText('Checking how busy the class is that day…'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/busy|lighter/)).not.toBeInTheDocument();
  });
});
