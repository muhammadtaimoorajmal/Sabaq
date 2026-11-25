import type { User } from '@sabaq/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
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

const TOKEN = 'A'.repeat(40) + 'xyz';
const unverified: User = { ...TEST_USER, emailVerified: false };

function start(path: string, handlers: Handlers = {}) {
  const [pathname, hash] = path.split('#');
  window.history.replaceState(null, '', `${pathname ?? '/'}${hash ? `#${hash}` : ''}`);
  const fetchMock = mockApi(handlers);
  const router = createMemoryRouter(routes, { initialEntries: [pathname ?? '/'] });
  return { ...renderWithProviders(<App router={router} />), router, fetchMock };
}

describe('sign up', () => {
  it('shows problems only after leaving a filled-in field, and clears them as soon as they are fixed', async () => {
    const { user } = start('/sign-up');
    const name = await screen.findByLabelText(/Full name/);
    await user.click(name);
    await user.tab();
    expect(name).not.toHaveAttribute('aria-invalid');

    await user.type(name, 'Z');
    await user.tab();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter at least 2 characters.')).toBeInTheDocument();
    await user.type(name, 'ara Ahmed');
    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it('lists every problem on submit in plain language', async () => {
    const { user, fetchMock } = start('/sign-up');
    await user.click(await screen.findByRole('button', { name: 'Create account' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('There are 3 problems to fix');
    expect(
      within(summary).getByRole('link', { name: 'Enter your full name.' }),
    ).toBeInTheDocument();
    expect(
      within(summary).getByRole('link', { name: 'Enter your e-mail address.' }),
    ).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Enter a password.' })).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/auth/register')).toHaveLength(0);
  });

  it('rates the password, including personal details, and checks the student ID', async () => {
    const { user } = start('/sign-up');
    await user.type(await screen.findByLabelText(/Full name/), 'Zara Ahmed');
    const password = screen.getByLabelText(/^Password/);
    await user.type(password, 'zaraahmed1');
    expect(screen.getByText('Password strength: weak')).toBeInTheDocument();
    expect(screen.getByText('Avoid using your name or e-mail address.')).toBeInTheDocument();
    expect(password).toHaveAccessibleDescription(/Password strength: weak/);
    await user.clear(password);
    await user.type(password, 'correct horse battery staple');
    expect(screen.getByText('Password strength: strong')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Student ID/), 'NU 24');
    await user.tab();
    expect(
      screen.getByText('Use only letters, numbers, dots, dashes and underscores.'),
    ).toBeInTheDocument();
  });

  it('creates the account, signs in and asks to confirm the address', async () => {
    const { user, fetchMock } = start('/sign-up?next=/settings', {
      'POST /api/auth/register': () => json(201, session(unverified)),
      'GET /api/auth/sessions': () => json(200, []),
    });
    await user.type(await screen.findByLabelText(/Full name/), 'Zara Ahmed');
    await user.type(screen.getByLabelText(/E-mail address/), 'Zara@Example.com');
    await user.type(screen.getByLabelText(/^Password/), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Confirm your e-mail address')).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'POST', '/api/auth/register')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Zara Ahmed',
      email: 'zara@example.com',
      password: 'correct horse battery',
      // Display settings chosen on this device are kept with the new account.
      preferences: expect.objectContaining({ theme: 'system', textScale: 1 }) as unknown,
    });
  });

  it('opens the welcome steps after signing up without a destination', async () => {
    const { user } = start('/sign-up', {
      'POST /api/auth/register': () => json(201, session({ ...unverified, onboardedAt: null })),
    });
    await user.type(await screen.findByLabelText(/Full name/), 'Zara Ahmed');
    await user.type(screen.getByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome, Zara' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('offers to sign in when the address already has an account', async () => {
    const { user } = start('/sign-up', {
      'POST /api/auth/register': () => apiError(409, 'email_taken'),
    });
    await user.type(await screen.findByLabelText(/Full name/), 'Zara Ahmed');
    await user.type(screen.getByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('link', { name: 'Sign in instead' })).toHaveAttribute(
      'href',
      '/sign-in?email=zara%40example.com',
    );
  });

  it('shows errors the server finds next to their fields', async () => {
    const { user } = start('/sign-up', {
      'POST /api/auth/register': () =>
        json(400, {
          error: {
            code: 'validation_failed',
            message: 'x',
            requestId: 'r',
            issues: [{ path: 'email', code: 'invalid_format', message: 'Invalid email' }],
          },
        }),
    });
    await user.type(await screen.findByLabelText(/Full name/), 'Zara Ahmed');
    await user.type(screen.getByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/E-mail address/)).toHaveAttribute('aria-invalid', 'true'),
    );
  });
});

describe('sign in', () => {
  it('warns when Caps Lock is on', async () => {
    const { user } = start('/sign-in');
    const password = await screen.findByLabelText(/^Password/);
    await user.click(password);
    await user.keyboard('{CapsLock}a');
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();
    expect(password).toHaveAccessibleDescription('Caps Lock is on');
    await user.keyboard('{CapsLock}b');
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });

  it('says how long a locked account must wait, with a way to reset the password', async () => {
    const { user } = start('/sign-in', {
      'POST /api/auth/login': () =>
        new Response(
          JSON.stringify({ error: { code: 'account_locked', message: 'x', requestId: 'r' } }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '840' },
          },
        ),
    });
    await user.type(await screen.findByLabelText(/E-mail address/), 'zara@example.com');
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Try again in 14 minutes');
    expect(within(alert).getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password?email=zara%40example.com',
    );
  });

  it('signs in with a demo account in one tap', async () => {
    const { user, fetchMock } = start('/sign-in', {
      'POST /api/auth/login': () => json(200, session()),
    });
    await user.click(await screen.findByRole('button', { name: 'Class representative' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Zara/ })).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'POST', '/api/auth/login')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'hamza.khan@northfield.example',
      password: 'sabaq-demo',
    });
  });

  it('links to sign-up, keeping the destination', async () => {
    start('/sign-in?next=/settings');
    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up?next=%2Fsettings',
    );
  });
});

describe('forgotten password', () => {
  it('sends a link, confirms it, and can send it again', async () => {
    const { user, fetchMock } = start('/forgot-password?email=zara@example.com', {
      'POST /api/auth/forgot-password': () => json(202),
    });
    expect(await screen.findByLabelText(/E-mail address/)).toHaveValue('zara@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for zara@example.com/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send again' }));
    await waitFor(() =>
      expect(callsTo(fetchMock, 'POST', '/api/auth/forgot-password')).toHaveLength(2),
    );
  });

  it('reports a server problem', async () => {
    const { user } = start('/forgot-password', {
      'POST /api/auth/forgot-password': () => apiError(429, 'rate_limited'),
    });
    await user.type(await screen.findByLabelText(/E-mail address/), 'zara@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });
});

describe('reset password', () => {
  it('saves a new password from the e-mailed link, then asks to sign in', async () => {
    const { user, fetchMock, router } = start(`/reset-password#token=${TOKEN}`, {
      'POST /api/auth/reset-password': () => json(204),
    });
    await user.type(await screen.findByLabelText(/New password/), 'a brand new password');
    // The token is removed from the address as soon as it is read.
    expect(window.location.hash).toBe('');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findByText('Your password has been changed. Sign in with your new password.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    const [, init] = callsTo(fetchMock, 'POST', '/api/auth/reset-password')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      token: TOKEN,
      password: 'a brand new password',
    });
  });

  it('explains an expired link and a missing one', async () => {
    const { user } = start(`/reset-password#token=${TOKEN}`, {
      'POST /api/auth/reset-password': () => apiError(400, 'invalid_token'),
    });
    await user.type(await screen.findByLabelText(/New password/), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findByRole('heading', { name: 'This link did not work' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('asks for a new link when opened without one', async () => {
    start('/reset-password');
    expect(
      await screen.findByRole('heading', { name: 'This link is incomplete' }),
    ).toBeInTheDocument();
  });
});

describe('e-mail verification', () => {
  it('confirms the address once and updates the signed-in account', async () => {
    let verified = false;
    const { fetchMock } = start(`/verify-email#token=${TOKEN}`, {
      'POST /api/auth/refresh': () => json(200, session(unverified)),
      'POST /api/auth/verify-email': () => {
        verified = true;
        return json(204);
      },
      'GET /api/auth/me': () => json(200, { ...unverified, emailVerified: verified }),
    });
    expect(
      await screen.findByRole('heading', { name: 'E-mail address confirmed' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to Sabaq' })).toHaveAttribute('href', '/');
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/api/auth/me')).toHaveLength(1));
    expect(callsTo(fetchMock, 'POST', '/api/auth/verify-email')).toHaveLength(1);
  });

  it('offers a new link when the old one has expired', async () => {
    const { user } = start(`/verify-email#token=${TOKEN}`, {
      'POST /api/auth/verify-email': () => apiError(400, 'invalid_token'),
      'POST /api/auth/resend-verification': () => json(202),
    });
    expect(
      await screen.findByRole('heading', { name: 'This link did not work' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/E-mail address/), 'zara@example.com');
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(
      await screen.findByText(/If zara@example.com still needs confirming/),
    ).toBeInTheDocument();
  });

  it('explains the page when opened without a link, and points signed-out people to sign in', async () => {
    start('/verify-email');
    expect(
      await screen.findByRole('heading', { name: 'Confirm your e-mail address' }),
    ).toBeInTheDocument();
  });

  it('reports an unexpected failure', async () => {
    start(`/verify-email#token=${TOKEN}`, {
      'POST /api/auth/verify-email': () => apiError(500, 'internal_error'),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side');
  });

  it('reminds signed-in people and resends the link from the banner', async () => {
    const { user, fetchMock } = start('/', {
      'POST /api/auth/refresh': () => json(200, session(unverified)),
      'POST /api/auth/resend-verification': () => json(202),
    });
    await user.click(await screen.findByRole('button', { name: 'Send the link again' }));
    expect(
      await screen.findByText('Sent. Check your inbox, and your spam folder.'),
    ).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, 'POST', '/api/auth/resend-verification')[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ email: TEST_USER.email });
  });
});

describe('changing the password', () => {
  const signedIn: Handlers = {
    'POST /api/auth/refresh': () => json(200, session()),
    'GET /api/auth/sessions': () => json(200, []),
  };

  it('shows a wrong current password next to the field', async () => {
    const { user } = start('/settings', {
      ...signedIn,
      'POST /api/auth/change-password': () =>
        json(400, {
          error: {
            code: 'validation_failed',
            message: 'x',
            requestId: 'r',
            issues: [{ path: 'currentPassword', code: 'incorrect', message: 'wrong' }],
          },
        }),
    });
    await user.type(await screen.findByLabelText(/Current password/), 'not it');
    await user.type(screen.getByLabelText(/New password/), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Current password/)).toHaveAccessibleDescription(
        'Your current password is not correct.',
      ),
    );
  });

  it('confirms the change', async () => {
    const { user } = start('/settings', {
      ...signedIn,
      'POST /api/auth/change-password': () => json(204),
    });
    await user.type(await screen.findByLabelText(/Current password/), 'sabaq-demo');
    await user.type(screen.getByLabelText(/New password/), 'sabaq-demo');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByLabelText(/New password/)).toHaveAccessibleDescription(
      /Choose a password different from your current one\./,
    );
    await user.clear(screen.getByLabelText(/New password/));
    await user.type(screen.getByLabelText(/New password/), 'a brand new password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText('Password changed. Your other devices were signed out.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Current password/)).toHaveValue(''));
  });
});

describe('accessibility', () => {
  it.each(['/sign-up', '/sign-in', '/forgot-password', '/reset-password', '/verify-email'])(
    '%s has no detectable violations',
    async (path) => {
      start(path);
      await screen.findByRole('heading', { level: 1 });
      await act(async () => undefined);
      expect(await accessibilityViolations()).toEqual([]);
    },
  );
});
