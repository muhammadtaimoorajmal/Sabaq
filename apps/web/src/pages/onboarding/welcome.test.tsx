import type { ClassForMember, User } from '@sabaq/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { routes } from '../../app/routes';
import { callsTo, json, mockApi, session, TEST_USER, type Handlers } from '../../test/api';
import { accessibilityViolations, renderWithProviders } from '../../test/render';

const NEW_USER: User = { ...TEST_USER, studentId: null, onboardedAt: null };
const DONE = { ...NEW_USER, onboardedAt: '2026-11-25T10:00:00.000Z' };

const CLASS: ClassForMember = {
  id: '6741f0c2a1b2c3d4e5f60799',
  name: 'BS Computer Science · 5A',
  section: '5A',
  program: 'BS Computer Science',
  term: 'Fall 2026',
  institution: null,
  timeZone: 'Asia/Karachi',
  joinCode: 'NRTH5A26',
  createdBy: '6741f0c2a1b2c3d4e5f60701',
  createdAt: '2026-09-01T09:00:00.000Z',
  role: 'student',
  memberCount: 31,
} as ClassForMember;

function start(path: string, handlers: Handlers = {}) {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session(NEW_USER)),
    'POST /api/account/onboarding': () => json(200, DONE),
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

describe('welcome steps', () => {
  it('walks through profile, comfort and class, with progress and focus on each step', async () => {
    const { user, router, fetchMock } = start('/welcome', {
      'PATCH /api/account/profile': ({ body }) => json(200, { ...NEW_USER, ...(body as object) }),
      'POST /api/classes/join': () => json(201, CLASS),
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome, Zara' }),
    ).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: 'Setup progress' });
    expect(within(progress).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    expect(await accessibilityViolations()).toEqual([]);

    await user.type(screen.getByLabelText(/Student ID/), 'NU-24-0002');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const comfort = await screen.findByRole('heading', { level: 2, name: 'Make it comfortable' });
    expect(comfort).toHaveFocus();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(within(progress).getAllByRole('listitem')[0]).toHaveTextContent('(completed)');
    expect(router.state.location.search).toBe('?step=2');
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Join your class' })).toHaveFocus();
    await user.type(screen.getByLabelText(/Join code/), 'nrth5a26');
    await user.click(screen.getByRole('button', { name: 'Join class' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/classes/${CLASS.id}`));
    expect(callsTo(fetchMock, 'POST', '/api/account/onboarding')).toHaveLength(1);
    const [, init] = callsTo(fetchMock, 'PATCH', '/api/account/profile')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Zara Ahmed', studentId: 'NU-24-0002' });
  });

  it('can be skipped from any step', async () => {
    const { user, router, fetchMock } = start('/welcome?step=2');
    await user.click(await screen.findByRole('button', { name: 'Skip setup' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(callsTo(fetchMock, 'POST', '/api/account/onboarding')).toHaveLength(1);
  });

  it('goes back a step, and shows classes already joined from an invitation', async () => {
    const { user } = start('/welcome?step=3', { 'GET /api/classes': () => json(200, [CLASS]) });
    expect(await screen.findByText('BS Computer Science · 5A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Make it comfortable' }),
    ).toBeInTheDocument();
  });

  it('treats an unknown step as the first', async () => {
    start('/welcome?step=9');
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
  });
});

describe('Today', () => {
  it('invites people who skipped the welcome steps to finish them, until dismissed', async () => {
    const { user, fetchMock } = start('/');
    const card = await screen.findByRole('region', { name: 'Finish setting up' });
    expect(within(card).getByRole('link', { name: 'Continue setup' })).toHaveAttribute(
      'href',
      '/welcome',
    );
    await user.click(within(card).getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Finish setting up' })).not.toBeInTheDocument(),
    );
    expect(callsTo(fetchMock, 'POST', '/api/account/onboarding')).toHaveLength(1);
  });
});
