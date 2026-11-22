import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useConnection } from '../../api/connection';
import { useAuth } from '../../auth/AuthProvider';
import { Card, Spinner } from '../../components/ui';
import { useMediaQuery, WIDE_SCREEN } from '../../lib/useMediaQuery';
import { AccountMenu, DisplaySettingsButton, Logo, PrimaryNavigation } from './ShellParts';

/** Shown while the session is being restored: honest about a slow server. */
export function FullPageStatus() {
  const { t } = useTranslation();
  const { status } = useConnection();
  return (
    <main
      id="main"
      className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      {status === 'offline' ? (
        <CloudOff aria-hidden="true" className="size-10 text-muted" />
      ) : (
        <Spinner className="size-10 text-primary-text" label={t('shell.opening')} />
      )}
      <h1 className="text-xl font-semibold text-text">
        {status === 'waking'
          ? t('connection.waking')
          : status === 'offline'
            ? t('connection.offline')
            : t('shell.opening')}
      </h1>
      {(status === 'waking' || status === 'offline') && (
        <p className="max-w-md text-muted">
          {status === 'waking' ? t('connection.wakingBody') : t('connection.offlineBody')}
        </p>
      )}
    </main>
  );
}

/** Pages for signed-in people. Others are sent to sign in and brought back afterwards. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <FullPageStatus />;
  if (state.status === 'anonymous') {
    const next = `${location.pathname}${location.search}`;
    const query = new URLSearchParams();
    if (next !== '/') query.set('next', next);
    if (state.reason !== 'initial') query.set('reason', state.reason);
    const search = query.toString();
    return <Navigate to={`/sign-in${search ? `?${search}` : ''}`} replace />;
  }
  return <AppLayout />;
}

/** The frame of every signed-in page: header, navigation and the page itself. */
export function AppLayout() {
  const wide = useMediaQuery(WIDE_SCREEN);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b-default border-border bg-surface/95 px-4 backdrop-blur">
        <Logo />
        <div className="ms-auto flex items-center gap-1">
          <DisplaySettingsButton />
          <AccountMenu />
        </div>
      </header>
      <div className="flex flex-1">
        {wide && <PrimaryNavigation />}
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 pb-24 focus:outline-none sm:px-6 lg:px-10 lg:pb-10"
        >
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>
      </div>
      {!wide && <PrimaryNavigation />}
    </div>
  );
}

/** The frame of sign-in and similar pages: a centered card, with display settings available. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-4">
        <Logo />
        <DisplaySettingsButton />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 py-8 focus:outline-none sm:items-center"
      >
        <Card className="w-full max-w-md p-6 sm:p-8">
          <Outlet />
        </Card>
      </main>
    </div>
  );
}
