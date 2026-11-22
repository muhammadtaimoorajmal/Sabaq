import type { PreferencesUpdate } from '@sabaq/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/client';
import { WIDE_SCREEN } from '../lib/useMediaQuery';
import { apiError, callsTo, json, mockApi, session, TEST_USER, type Handlers } from '../test/api';
import { accessibilityViolations, renderWithProviders } from '../test/render';
import { systemMedia } from '../test/setup';
import { App } from './App';
import { routes } from './routes';

const SESSIONS = [
  {
    id: 'a1',
    device: 'Chrome on Windows',
    current: true,
    createdAt: '2026-11-20T10:00:00Z',
    lastUsedAt: new Date().toISOString(),
  },
  {
    id: 'b2',
    device: 'Safari on iOS',
    current: false,
    createdAt: '2026-11-18T10:00:00Z',
    lastUsedAt: '2026-11-21T10:00:00Z',
  },
];

const signedIn: Handlers = {
  'POST /api/auth/refresh': () => json(200, session()),
  'GET /api/auth/sessions': () => json(200, SESSIONS),
};

function start(
  path: string,
  handlers: Handlers = {},
  preferences: PreferencesUpdate = {},
  pages: RouteObject[] = [],
) {
  const fetchMock = mockApi(handlers);
  const [root] = routes;
  // Extra test pages live inside the real root layout, so they get its error page.
  const tree: RouteObject[] =
    pages.length > 0 && root
      ? [{ ...root, children: [...pages, ...(root.children ?? [])] } as RouteObject]
      : routes;
  const router = createMemoryRouter(tree, { initialEntries: [path] });
  const result = renderWithProviders(<App router={router} />, preferences);
  return { ...result, router, fetchMock };
}

describe('protected pages', () => {
  it('send signed-out visitors to sign in, then bring them back', async () => {
    const { user, router } = start('/settings', {
      'POST /api/auth/login': () => json(200, session()),
      'GET /api/auth/sessions': () => json(200, SESSIONS),
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fsettings');
    await waitFor(() => expect(document.title).toBe('Sign in · Sabaq'));

    await user.type(screen.getByLabelText(/E-mail address/), 'Zara.Ahmed@Northfield.example ');
    await user.type(screen.getByLabelText(/^Password/), 'sabaq-demo');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('open directly when a session can be restored from the cookie', async () => {
    start('/', signedIn);
    expect(await screen.findByRole('heading', { level: 1, name: /Zara/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Today · Sabaq'));
  });

  it('explain a session that ended while working, and keep the page to return to', async () => {
    let refreshes = 0;
    const { router } = start('/settings', {
      // The first refresh restores the session; later, the session has ended on the server.
      'POST /api/auth/refresh': () =>
        refreshes++ === 0 ? json(200, session()) : apiError(401, 'session_expired'),
      'GET /api/auth/sessions': () => apiError(401, 'session_expired'),
    });
    expect(await screen.findByText(/Your session ended/)).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fsettings&reason=expired');
  });

  it('do not send people to other sites after signing in', async () => {
    const { user, router } = start('/sign-in?next=//evil.example', {
      'POST /api/auth/login': () => json(200, session()),
    });
    await user.type(await screen.findByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('sign in', () => {
  it('lists missing fields before calling the server', async () => {
    const { user, fetchMock } = start('/sign-in');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('There are 2 problems to fix');
    expect(callsTo(fetchMock, 'POST', '/api/auth/login')).toHaveLength(0);
  });

  it('explains a wrong password in plain language', async () => {
    const { user } = start('/sign-in', {
      'POST /api/auth/login': () => apiError(401, 'invalid_credentials'),
    });
    await user.type(await screen.findByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The e-mail address or password is incorrect.',
    );
  });

  it('sends people who are already signed in onward', async () => {
    start('/sign-in?next=/settings', signedIn);
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});

describe('the shell', () => {
  it('shows a bottom bar on phones and a sidebar on wide screens', async () => {
    start('/', signedIn);
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(nav).toHaveClass('fixed');
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('uses a sidebar on wide screens', async () => {
    systemMedia.set(WIDE_SCREEN, true);
    start('/', signedIn);
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toHaveClass(
      'sticky',
    );
  });

  it('moves focus to the new page heading and updates the title after navigating', async () => {
    const { user } = start('/', signedIn);
    await screen.findByRole('heading', { level: 1, name: /Zara/ });
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(document.title).toBe('Settings · Sabaq');
  });

  it('signs out from the account menu', async () => {
    const { user, fetchMock } = start('/', signedIn);
    await user.click(await screen.findByRole('button', { name: 'Account menu for Zara Ahmed' }));
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByText('You have signed out.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/auth/logout')).toHaveLength(1);
  });

  it('opens settings from the account menu', async () => {
    const { user } = start('/', signedIn);
    await user.click(await screen.findByRole('button', { name: 'Account menu for Zara Ahmed' }));
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('offers display settings before signing in', async () => {
    const { user } = start('/sign-in');
    await user.click(await screen.findByRole('button', { name: 'Display settings' }));
    const sheet = screen.getByRole('dialog', { name: 'Display' });
    await user.click(within(sheet).getByRole('radio', { name: 'High contrast' }));
    expect(document.documentElement.dataset.theme).toBe('high-contrast');
  });

  it.each<[string, string, PreferencesUpdate]>([
    ['signed-in pages', '/', {}],
    ['signed-in pages in Urdu', '/settings', { language: 'ur' }],
    ['the sign-in page', '/sign-in', {}],
    ['the not-found page', '/nowhere', {}],
  ])('has no detectable accessibility violations on %s', async (_name, path, preferences) => {
    start(path, signedIn, preferences);
    await screen.findByRole('heading', { level: 1 });
    expect(await accessibilityViolations()).toEqual([]);
  });
});

describe('settings', () => {
  it('lists signed-in devices and signs one out', async () => {
    const { user, fetchMock } = start('/settings', {
      ...signedIn,
      'DELETE /api/auth/sessions/b2': () => json(204),
    });
    expect(await screen.findByText('Safari on iOS')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out of Safari on iOS' }));
    expect(await screen.findByText('Signed out of Safari on iOS.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'DELETE', '/api/auth/sessions/b2')).toHaveLength(1);
  });

  it('confirms before signing out of every device', async () => {
    const { user, fetchMock } = start('/settings', {
      ...signedIn,
      'POST /api/auth/logout-all': () => json(204),
    });
    await user.click(await screen.findByRole('button', { name: 'Sign out of all devices' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out of all devices?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sign out of all devices' }));
    expect(await screen.findByText('You have signed out.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/auth/logout-all')).toHaveLength(1);
  });

  it('offers a retry when devices cannot be loaded', async () => {
    start('/settings', {
      ...signedIn,
      'GET /api/auth/sessions': () => apiError(500, 'internal_error'),
    });
    expect(
      await screen.findByText('Your devices could not be loaded.', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('reports a failed sign-out of a device', async () => {
    const { user } = start('/settings', {
      ...signedIn,
      'DELETE /api/auth/sessions/b2': () => apiError(404, 'not_found'),
    });
    await user.click(await screen.findByRole('button', { name: 'Sign out of Safari on iOS' }));
    expect(
      await screen.findByText('We could not find what you were looking for.'),
    ).toBeInTheDocument();
  });
});

describe('error and not-found pages', () => {
  it('shows a helpful not-found page', async () => {
    start('/nowhere');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Today' })).toHaveAttribute('href', '/');
  });

  it('recovers from a page that fails, with a support reference', async () => {
    start('/broken', {}, {}, [
      {
        path: 'broken',
        loader: () => {
          throw new ApiRequestError(500, 'internal_error', 'Boom', [], 'req-123');
        },
        element: null,
      },
    ]);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Reference for support: req-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Today' })).toHaveAttribute('href', '/');
  });

  it('shows the not-found page for missing data', async () => {
    start('/missing', {}, {}, [
      {
        path: 'missing',
        loader: () => {
          throw new Response('Not found', { status: 404 });
        },
        element: null,
      },
    ]);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
