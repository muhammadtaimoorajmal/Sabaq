import type { ParseKeys } from 'i18next';
import { WifiOff, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router';
import { useConnection } from '../../api/connection';
import { Button, SkipLink } from '../../components/ui';

/** Route metadata: each route names its page for the document title. */
export interface RouteHandle {
  title: ParseKeys;
}

/**
 * After each navigation: set the document title and move focus to the new page's heading, so
 * screen-reader and keyboard users know the page changed (single-page apps do not do this by
 * themselves). The first load keeps the browser's default focus.
 */
function RouteEffects() {
  const { t } = useTranslation();
  const matches = useMatches();
  const location = useLocation();
  const firstRender = useRef(true);
  const handle = [...matches]
    .reverse()
    .find((match) => (match.handle as RouteHandle | undefined)?.title)?.handle as
    RouteHandle | undefined;
  const page = handle ? t(handle.title) : t('common.appName');

  useEffect(() => {
    document.title = handle ? t('shell.pageTitle', { page }) : t('common.appName');
  }, [handle, page, t]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return null;
}

/** Explains slow and lost connections instead of leaving people with a spinner. */
export function ConnectionBanner() {
  const { t } = useTranslation();
  const { status, retry } = useConnection();
  if (status !== 'waking' && status !== 'offline') return null;
  const offline = status === 'offline';
  return (
    <div role="status" className="border-b-default border-border bg-warning-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {offline ? (
          <WifiOff aria-hidden="true" className="size-5 shrink-0 text-warning-text" />
        ) : (
          <Zap aria-hidden="true" className="size-5 shrink-0 animate-pulse text-warning-text" />
        )}
        <p className="min-w-0 flex-1">
          <strong className="font-semibold text-warning-text">
            {offline ? t('connection.offline') : t('connection.waking')}
          </strong>{' '}
          <span className="text-text">
            {offline ? t('connection.offlineBody') : t('connection.wakingBody')}
          </span>
        </p>
        <Button size="sm" variant="secondary" onClick={retry}>
          {t('connection.retry')}
        </Button>
      </div>
    </div>
  );
}

/** Wraps every page: skip link, connection status, titles, focus and scroll handling. */
export function RootLayout() {
  return (
    <>
      <SkipLink />
      <ConnectionBanner />
      <RouteEffects />
      <ScrollRestoration />
      <Outlet />
    </>
  );
}
