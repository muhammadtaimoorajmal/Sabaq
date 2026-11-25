import type { User } from '@sabaq/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { routes } from '../../app/routes';
import { combineUpdates, SAVE_DELAY_MS } from '../../preferences/PreferencesSync';
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
import { useAuth } from '../../auth/AuthProvider';
import { AvatarPicker } from './AvatarPicker';

const AVATAR = `/api/users/${TEST_USER.id}/avatar/v2`;

/** Starts the app signed in as `user` at `path`. */
function start(path: string, handlers: Handlers = {}, user: User = TEST_USER) {
  const fetchMock = mockApi({
    'POST /api/auth/refresh': () => json(200, session(user)),
    'GET /api/auth/sessions': () => json(200, []),
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('combineUpdates', () => {
  it('keeps the latest value of each field, including nested quiet hours', () => {
    expect(
      combineUpdates(
        { theme: 'dark', notifications: { quietHours: { start: '22:00' } } },
        { textScale: 1.25, notifications: { email: true, quietHours: { end: '06:00' } } },
      ),
    ).toEqual({
      theme: 'dark',
      textScale: 1.25,
      notifications: { email: true, quietHours: { start: '22:00', end: '06:00' } },
    });
    expect(combineUpdates({ theme: 'dark' }, { theme: 'light' })).toEqual({ theme: 'light' });
  });
});

describe('preferences follow the account', () => {
  it('takes over the account’s preferences when signing in', async () => {
    start(
      '/settings',
      {},
      { ...TEST_USER, preferences: { ...TEST_USER.preferences, theme: 'dark' } },
    );
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('saves changes to the account a moment later, together', async () => {
    const { user, fetchMock } = start('/settings', {
      'PATCH /api/account/preferences': ({ body }) =>
        json(200, { ...TEST_USER, preferences: { ...TEST_USER.preferences, ...(body as object) } }),
    });
    const display = await screen.findByRole('region', { name: 'Display' });
    await user.click(within(display).getByRole('radio', { name: 'Dark' }));
    await user.click(within(display).getByRole('radio', { name: 'Compact' }));
    await waitFor(
      () => expect(callsTo(fetchMock, 'PATCH', '/api/account/preferences')).toHaveLength(1),
      {
        timeout: SAVE_DELAY_MS + 1000,
      },
    );
    const [, init] = callsTo(fetchMock, 'PATCH', '/api/account/preferences')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ theme: 'dark', density: 'compact' });
  });

  it('explains when a change could not be saved, but keeps it on this device', async () => {
    const { user } = start('/settings', {
      'PATCH /api/account/preferences': () => apiError(503, 'service_unavailable'),
    });
    const display = await screen.findByRole('region', { name: 'Display' });
    await user.click(within(display).getByRole('radio', { name: 'Dark' }));
    expect(
      await screen.findByText(
        /could not be saved to your account/,
        {},
        { timeout: SAVE_DELAY_MS + 1000 },
      ),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('settings', () => {
  it('has a link to every section and no accessibility problems', async () => {
    start('/settings');
    const nav = await screen.findByRole('navigation', { name: 'On this page' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Profile',
      'Display',
      'Date and time',
      'Notifications',
      'Password and devices',
      'Your data',
    ]);
    expect(await accessibilityViolations()).toEqual([]);
  });

  it('saves the profile and clears an emptied student ID', async () => {
    const { user, fetchMock } = start('/settings', {
      'PATCH /api/account/profile': ({ body }) => json(200, { ...TEST_USER, ...(body as object) }),
    });
    const profile = await screen.findByRole('region', { name: 'Profile' });
    expect(within(profile).getByText('zara.ahmed@northfield.example')).toBeInTheDocument();
    expect(within(profile).getByText('Confirmed')).toBeInTheDocument();
    const name = within(profile).getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(name, 'Zara A. Khan');
    await user.clear(within(profile).getByLabelText(/Student ID/));
    await user.click(within(profile).getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'PATCH', '/api/account/profile')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Zara A. Khan', studentId: null });
  });

  it('shows the quiet hours in the chosen time format', async () => {
    const { user } = start('/settings', {
      'PATCH /api/account/preferences': () => json(200, TEST_USER),
    });
    const notifications = await screen.findByRole('region', { name: 'Notifications' });
    await user.click(within(notifications).getByRole('switch', { name: 'Quiet hours' }));
    expect(
      within(notifications).getByText('Quiet every day from 10:00 PM until 7:00 AM.'),
    ).toBeInTheDocument();
    fireEvent.change(within(notifications).getByLabelText('From'), { target: { value: '23:30' } });
    expect(
      within(notifications).getByText('Quiet every day from 11:30 PM until 7:00 AM.'),
    ).toBeInTheDocument();

    const regional = screen.getByRole('region', { name: 'Date and time' });
    await user.click(within(regional).getByRole('radio', { name: '14:30' }));
    expect(
      within(notifications).getByText('Quiet every day from 23:30 until 07:00.'),
    ).toBeInTheDocument();
  });

  it('downloads a copy of the data', async () => {
    const createObjectURL = vi.fn(() => 'blob:export');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { user } = start('/settings', {
      'GET /api/account/export': () => json(200, { format: { name: 'sabaq-account-export' } }),
    });
    await user.click(await screen.findByRole('button', { name: 'Download my data' }));
    expect(await screen.findByText('Your data was downloaded.')).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});

describe('deleting the account', () => {
  const open = async (handlers: Handlers) => {
    const app = start('/settings', handlers);
    await app.user.click(await screen.findByRole('button', { name: 'Delete account…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your account?' });
    return { ...app, dialog };
  };

  it('asks for the password, and says when it is wrong', async () => {
    const { user, dialog } = await open({
      'DELETE /api/account': () =>
        json(400, {
          error: {
            code: 'validation_failed',
            message: 'x',
            requestId: 'r',
            issues: [{ path: 'password', code: 'incorrect', message: 'x' }],
          },
        }),
    });
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    expect(within(dialog).getByText('Enter your password.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Enter your password to confirm/), 'nope');
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    expect(await within(dialog).findByText('This password is not correct.')).toBeInTheDocument();
  });

  it('lists the classes to hand over first', async () => {
    const { user, dialog } = await open({
      'DELETE /api/account': () =>
        json(409, {
          error: {
            code: 'last_manager',
            message: 'x',
            requestId: 'r',
            issues: [
              {
                path: 'classes.6741f0c2a1b2c3d4e5f60799',
                code: 'last_manager',
                message: 'BS Computer Science · 5A',
              },
            ],
          },
        }),
    });
    await user.type(within(dialog).getByLabelText(/Enter your password to confirm/), 'sabaq-demo');
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    const link = await within(dialog).findByRole('link', { name: 'BS Computer Science · 5A' });
    expect(link).toHaveAttribute('href', '/classes/6741f0c2a1b2c3d4e5f60799?tab=members');
  });

  it('signs out once the account is deleted', async () => {
    const { user, dialog, router } = await open({ 'DELETE /api/account': () => json(204) });
    await user.type(within(dialog).getByLabelText(/Enter your password to confirm/), 'sabaq-demo');
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
    expect(await screen.findByText('Your account was deleted.')).toBeInTheDocument();
  });
});

describe('profile photo', () => {
  /** Renders the picker for a signed-in person and waits for the session. */
  function Picker(props: Parameters<typeof AvatarPicker>[0]) {
    const { state } = useAuth();
    return state.status === 'authenticated' ? <AvatarPicker {...props} /> : null;
  }

  const file = (type = 'image/png') => new File(['x'], 'me.png', { type });

  /** The hidden file input, once the session has loaded. */
  const fileInput = (container: HTMLElement) =>
    waitFor(() => {
      const element = container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!element) throw new Error('The photo picker has not appeared yet');
      return element;
    });

  it('uploads the prepared photo and offers to remove it', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/refresh': () => json(200, session()),
      'PUT /api/account/avatar': () => json(200, { ...TEST_USER, avatarUrl: AVATAR }),
      'DELETE /api/account/avatar': () => json(200, TEST_USER),
    });
    const prepare = vi.fn(() => Promise.resolve('data:image/webp;base64,UklGRg=='));
    const { user, container } = renderWithProviders(<Picker prepare={prepare} />);
    await user.upload(await fileInput(container), file());
    expect(await screen.findByText('Photo updated.')).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'PUT', '/api/account/avatar')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ image: 'data:image/webp;base64,UklGRg==' });

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(await screen.findByText('Photo removed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a photo' })).toBeInTheDocument();
  });

  it('explains files that are not supported images', async () => {
    mockApi({ 'POST /api/auth/refresh': () => json(200, session()) });
    const { container } = renderWithProviders(<Picker />);
    const input = await fileInput(container);
    // The `accept` attribute is only a hint, so the type is checked again.
    await act(async () => {
      fireEvent.change(input, { target: { files: [file('image/gif')] } });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG or WebP image.');
  });
});
