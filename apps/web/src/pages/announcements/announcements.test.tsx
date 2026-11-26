import type {
  AnnouncementForUser,
  AnnouncementReceipts,
  ClassForMember,
  Course,
} from '@sabaq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { routes } from '../../app/routes';
import { SEEN_BATCH_MS } from '../../api/announcements';
import { callsTo, json, mockApi, session, TEST_USER, type Handlers } from '../../test/api';
import { accessibilityViolations, renderWithProviders } from '../../test/render';

const CLASS_ID = '6741f0c2a1b2c3d4e5f60aaa';
const ANNOUNCEMENT_ID = '6741f0c2a1b2c3d4e5f60eee';

const cls = (overrides: Partial<ClassForMember> = {}): ClassForMember => ({
  id: CLASS_ID,
  name: 'BS Computer Science',
  section: '5A',
  program: 'BS Computer Science',
  term: 'Fall 2026',
  institution: null,
  timeZone: 'Asia/Karachi',
  memberCount: 31,
  createdAt: '2026-09-01T09:00:00.000Z',
  role: 'student',
  joinCode: null,
  ...overrides,
});

const COURSE: Course = {
  id: '6741f0c2a1b2c3d4e5f60bbb',
  classId: CLASS_ID,
  code: 'CS-341',
  title: 'Human-Computer Interaction',
  instructorName: null,
  color: 'teal',
  schedule: [],
  createdAt: '2026-09-01T09:00:00.000Z',
};

const announcement = (overrides: Partial<AnnouncementForUser> = {}): AnnouncementForUser => ({
  id: ANNOUNCEMENT_ID,
  classId: CLASS_ID,
  author: { id: '6741f0c2a1b2c3d4e5f60111', name: 'Hamza Khan', avatarUrl: null },
  type: 'deadline',
  courseId: COURSE.id,
  title: 'Lab 11: usability test report',
  body: 'Submit one PDF on the LMS.',
  links: [{ label: 'Lab handout', url: 'https://example.com/lab11.pdf' }],
  pinned: false,
  dueAt: '2027-01-08T18:59:00.000Z',
  startsAt: null,
  venue: null,
  taskType: 'lab',
  taskId: '6741f0c2a1b2c3d4e5f60fff',
  edits: [],
  createdAt: '2026-11-25T08:00:00.000Z',
  updatedAt: '2026-11-25T08:00:00.000Z',
  seenAt: null,
  canManage: false,
  receipts: null,
  ...overrides,
});

const page = (items: AnnouncementForUser[]) => json(200, { items, nextBefore: null });

function start(path: string, handlers: Handlers = {}, role: ClassForMember['role'] = 'student') {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session()),
    'GET /api/classes': () => json(200, [cls({ role })]),
    [`GET /api/classes/${CLASS_ID}`]: () => json(200, cls({ role })),
    [`GET /api/classes/${CLASS_ID}/courses`]: () => json(200, [COURSE]),
    'POST /api/announcements/seen': () => json(204),
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

describe('inbox', () => {
  it('shows what matters first: type, course, class, due date, unread state and links', async () => {
    start('/inbox', { 'GET /api/announcements': () => page([announcement()]) });
    const card = await screen.findByRole('article', { name: 'Lab 11: usability test report' });
    expect(within(card).getByText('Deadline')).toBeInTheDocument();
    expect(within(card).getByText('CS-341')).toBeInTheDocument();
    expect(within(card).getByText('BS Computer Science')).toBeInTheDocument();
    // 18:59 UTC is 11:59 PM in Karachi, the person's time zone.
    expect(within(card).getByText('Due Friday, January 8, 2027 at 11:59 PM')).toBeInTheDocument();
    expect(within(card).getByText('Unread')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Lab handout/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('records what has been seen, together in one request', async () => {
    const { fetchMock } = start('/inbox', {
      'GET /api/announcements': () =>
        page([
          announcement(),
          announcement({ id: '6741f0c2a1b2c3d4e5f60e01', title: 'Bring laptops' }),
        ]),
    });
    await screen.findByRole('article', { name: 'Bring laptops' });
    await waitFor(
      () => expect(callsTo(fetchMock, 'POST', '/api/announcements/seen')).toHaveLength(1),
      { timeout: SEEN_BATCH_MS + 1000 },
    );
    const [, init] = callsTo(fetchMock, 'POST', '/api/announcements/seen')[0] ?? [];
    expect(JSON.parse(String(init?.body)).ids).toHaveLength(2);
    await waitFor(() => {
      for (const card of screen.getAllByRole('article')) {
        expect(within(card).queryByText('Unread')).not.toBeInTheDocument();
      }
    });
  });

  it('marks announcements changed after they were seen', async () => {
    start('/inbox', {
      'GET /api/announcements': () =>
        page([
          announcement({
            edits: [
              {
                editedAt: '2026-11-25T10:00:00.000Z',
                editedBy: { id: '6741f0c2a1b2c3d4e5f60111', name: 'Hamza Khan', avatarUrl: null },
                changedFields: ['dueAt', 'venue'],
              },
            ],
          }),
        ]),
    });
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Updated since you saw it')).toBeInTheDocument();
    fireEvent.click(within(card).getByText(/^Edited/));
    expect(
      within(card).getByText(/Hamza Khan changed the due date and the venue/),
    ).toBeInTheDocument();
  });

  it('filters by unread, type and words', async () => {
    const { user, fetchMock } = start('/inbox');
    await screen.findByRole('heading', { name: 'No announcements yet' });
    await user.click(screen.getByRole('radio', { name: 'Unread' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'venue_change');
    await user.type(screen.getByLabelText('Search announcements'), 'lab');
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('type=venue_change&unread=true&q=lab'),
        ),
      ).toBe(true),
    );
    expect(await screen.findByRole('heading', { name: 'Nothing matches' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Search announcements')).toHaveValue('');
  });

  it('marks everything as read at once', async () => {
    const { user, fetchMock } = start('/inbox', {
      'GET /api/announcements': () => page([announcement()]),
    });
    await user.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    expect(await screen.findByText('All caught up.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/announcements/seen').length).toBeGreaterThan(0);
  });

  it('shows the number of unread announcements in the navigation', async () => {
    start('/inbox', {
      'GET /api/announcements/unread': () => json(200, { total: 3, byClass: { [CLASS_ID]: 3 } }),
    });
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: /^Inbox\s*\(3 unread\)$/ })).toBeInTheDocument(),
    );
  });
});

describe('posting and managing', () => {
  const manager = (overrides: Partial<AnnouncementForUser> = {}) =>
    announcement({
      canManage: true,
      seenAt: '2026-11-25T08:00:00.000Z',
      receipts: { seen: 18, members: 31 },
      ...overrides,
    });

  it('posts a deadline after checking the required fields, with a live preview', async () => {
    const { user, fetchMock } = start(
      `/classes/${CLASS_ID}`,
      { [`POST /api/classes/${CLASS_ID}/announcements`]: () => json(201, manager()) },
      'class_rep',
    );
    await user.click(await screen.findByRole('button', { name: 'Post announcement' }));
    const sheet = await screen.findByRole('dialog', { name: 'Post an announcement' });
    expect(within(sheet).getByRole('radio', { name: /Deadline/ })).toBeChecked();
    await user.click(within(sheet).getByRole('button', { name: 'Post announcement' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('There are 2 problems to fix');

    await user.type(within(sheet).getByLabelText(/^Title/), 'Lab 12 report');
    await user.selectOptions(within(sheet).getByLabelText('Course'), COURSE.id);
    fireEvent.change(within(sheet).getByLabelText('Date'), { target: { value: '2027-01-15' } });
    fireEvent.change(within(sheet).getByLabelText('Time'), { target: { value: '23:59' } });
    const preview = within(sheet).getByRole('article', { name: 'Lab 12 report' });
    expect(
      within(preview).getByText('Due Friday, January 15, 2027 at 11:59 PM'),
    ).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Post announcement' }));
    expect(await screen.findByText(/Posted to BS Computer Science/)).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'POST', `/api/classes/${CLASS_ID}/announcements`)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: 'deadline',
      title: 'Lab 12 report',
      courseId: COURSE.id,
      taskType: 'assignment',
      dueAt: '2027-01-15T18:59:00.000Z',
    });
  });

  it('asks a venue change for its time and room, and checks links', async () => {
    const { user } = start(`/classes/${CLASS_ID}`, {}, 'class_rep');
    await user.click(await screen.findByRole('button', { name: 'Post announcement' }));
    const sheet = await screen.findByRole('dialog', { name: 'Post an announcement' });
    await user.click(within(sheet).getByRole('radio', { name: /Venue change/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Add a link' }));
    await user.type(within(sheet).getByLabelText('Address (https://…)'), 'not a link');
    await user.click(within(sheet).getByRole('button', { name: 'Post announcement' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('There are 5 problems to fix');
    expect(within(sheet).getAllByText('Enter a full address starting with https://.')).toHaveLength(
      2,
    );
    await user.click(within(sheet).getByRole('button', { name: 'Remove link 1' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('There are 3 problems to fix');
  });

  it('edits with every field of the type, pins and deletes', async () => {
    const { user, fetchMock } = start(
      `/classes/${CLASS_ID}`,
      {
        'GET /api/announcements': () => page([manager()]),
        [`PATCH /api/classes/${CLASS_ID}/announcements/${ANNOUNCEMENT_ID}`]: () =>
          json(200, manager()),
        [`DELETE /api/classes/${CLASS_ID}/announcements/${ANNOUNCEMENT_ID}`]: () => json(204),
      },
      'class_rep',
    );
    const actions = await screen.findByRole('button', {
      name: 'Actions for “Lab 11: usability test report”',
    });
    await user.click(actions);
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit announcement' });
    expect(within(sheet).getByText(/The type cannot change/)).toBeInTheDocument();
    await user.clear(within(sheet).getByLabelText(/^Title/));
    await user.type(within(sheet).getByLabelText(/^Title/), 'Lab 11 (extended)');
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    const [, init] =
      callsTo(fetchMock, 'PATCH', `/api/classes/${CLASS_ID}/announcements/${ANNOUNCEMENT_ID}`)[0] ??
      [];
    expect(JSON.parse(String(init?.body))).toEqual({
      courseId: COURSE.id,
      title: 'Lab 11 (extended)',
      body: 'Submit one PDF on the LMS.',
      links: [{ label: 'Lab handout', url: 'https://example.com/lab11.pdf' }],
      pinned: false,
      dueAt: '2027-01-08T18:59:00.000Z',
      taskType: 'lab',
    });

    await user.click(screen.getByRole('button', { name: /Actions for/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pin to the top' }));
    expect(await screen.findByText('Pinned to the top.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Actions for/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: /Delete “Lab 11/ });
    await user.click(within(confirm).getByRole('button', { name: 'Delete announcement' }));
    expect(await screen.findByText('Announcement deleted.')).toBeInTheDocument();
  });

  it('shows who has and has not seen it', async () => {
    const receipts: AnnouncementReceipts = {
      announcementId: ANNOUNCEMENT_ID,
      memberCount: 3,
      seenCount: 1,
      notSeen: [
        { id: '6741f0c2a1b2c3d4e5f60c01', name: 'Ali Raza', avatarUrl: null },
        { id: '6741f0c2a1b2c3d4e5f60c02', name: 'Sana Malik', avatarUrl: null },
      ],
      seen: [
        {
          user: { id: TEST_USER.id, name: 'Zara Ahmed', avatarUrl: null },
          seenAt: '2026-11-25T09:00:00.000Z',
        },
      ],
    };
    const { user } = start(
      '/inbox',
      {
        'GET /api/announcements': () => page([manager({ receipts: { seen: 1, members: 3 } })]),
        [`GET /api/classes/${CLASS_ID}/announcements/${ANNOUNCEMENT_ID}/receipts`]: () =>
          json(200, receipts),
      },
      'class_rep',
    );
    await user.click(await screen.findByRole('button', { name: /Seen by 1 of 3/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Who has seen it' });
    expect(await within(sheet).findByText('Ali Raza')).toBeInTheDocument();
    expect(within(sheet).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    await user.click(within(sheet).getByRole('tab', { name: 'Seen (1)' }));
    expect(within(sheet).getByText('Zara Ahmed')).toBeInTheDocument();
    expect(await accessibilityViolations()).toEqual([]);
  });
});

describe('class page', () => {
  it('opens on announcements and jumps to one from a notification link', async () => {
    start(`/classes/${CLASS_ID}?tab=announcements&announcement=${ANNOUNCEMENT_ID}`, {
      'GET /api/announcements': () => page([announcement()]),
    });
    expect(
      await screen.findByRole('tab', { name: 'Announcements', selected: true }),
    ).toBeInTheDocument();
    const card = await screen.findByRole('article', { name: 'Lab 11: usability test report' });
    await waitFor(() => expect(card).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Post announcement' })).not.toBeInTheDocument();
  });
});

describe('details', () => {
  it('folds long details behind "Show more"', async () => {
    const body = `${'Read chapter 4 carefully. '.repeat(20)}The end.`;
    const { user } = start('/inbox', {
      'GET /api/announcements': () =>
        page([announcement({ type: 'material', dueAt: null, taskType: null, body, links: [] })]),
    });
    const card = await screen.findByRole('article');
    expect(within(card).queryByText(/The end\./)).not.toBeInTheDocument();
    const toggle = within(card).getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(within(card).getByText(/The end\./)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('posts an assessment with its kind and venue', async () => {
    const { user, fetchMock } = start(
      `/classes/${CLASS_ID}`,
      {
        [`POST /api/classes/${CLASS_ID}/announcements`]: () =>
          json(201, announcement({ type: 'assessment' })),
      },
      'instructor',
    );
    await user.click(await screen.findByRole('button', { name: 'Post announcement' }));
    const sheet = await screen.findByRole('dialog', { name: 'Post an announcement' });
    await user.click(within(sheet).getByRole('radio', { name: /Quiz or exam/ }));
    await user.selectOptions(within(sheet).getByLabelText('Kind of task'), 'exam');
    await user.type(within(sheet).getByLabelText(/^Title/), 'Midterm');
    await user.type(within(sheet).getByRole('textbox', { name: /^Venue/ }), 'Hall A');
    await user.click(within(sheet).getByRole('button', { name: 'Tomorrow' }));
    await user.click(within(sheet).getByRole('button', { name: 'Post announcement' }));
    expect((await screen.findAllByText(/Posted to/)).length).toBeGreaterThan(0);
    const [, init] = callsTo(fetchMock, 'POST', `/api/classes/${CLASS_ID}/announcements`)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: 'assessment',
      taskType: 'exam',
      venue: 'Hall A',
    });
  });

  it('says when everyone, or nobody, has seen it', async () => {
    const { user } = start(
      '/inbox',
      {
        'GET /api/announcements': () =>
          page([
            announcement({
              canManage: true,
              seenAt: '2026-11-25T08:00:00.000Z',
              receipts: { seen: 0, members: 0 },
            }),
          ]),
        [`GET /api/classes/${CLASS_ID}/announcements/${ANNOUNCEMENT_ID}/receipts`]: () =>
          json(200, {
            announcementId: ANNOUNCEMENT_ID,
            memberCount: 0,
            seenCount: 0,
            notSeen: [],
            seen: [],
          }),
      },
      'class_rep',
    );
    await user.click(await screen.findByRole('button', { name: /Seen by 0 of 0/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Who has seen it' });
    expect(await within(sheet).findByText('Everyone has seen it.')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('tab', { name: 'Seen (0)' }));
    expect(within(sheet).getByText('Nobody has seen it yet.')).toBeInTheDocument();
  });
});
