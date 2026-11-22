import { Compass, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { ApiRequestError } from '../api/client';
import { Button } from '../components/ui';

function StatusLayout({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-12 text-center focus:outline-none"
    >
      <span
        aria-hidden="true"
        className="rounded-full bg-primary-soft p-5 text-primary-text [&_svg]:size-10"
      >
        {icon}
      </span>
      <h1 className="text-display font-bold tracking-tight text-text">{title}</h1>
      <p className="max-w-md text-lg text-muted">{body}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
    </main>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <StatusLayout icon={<Compass />} title={t('notFound.title')} body={t('notFound.body')}>
      <Button asChild>
        <Link to="/">{t('notFound.home')}</Link>
      </Button>
    </StatusLayout>
  );
}

/**
 * Shown when a page fails to load or render. Offers a way forward and, for API failures, a
 * reference that support can match to the server logs.
 */
export function ErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  const reference = error instanceof ApiRequestError ? error.requestId : null;
  return (
    <StatusLayout icon={<TriangleAlert />} title={t('errorPage.title')} body={t('errorPage.body')}>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw aria-hidden="true" />
        {t('errorPage.retry')}
      </Button>
      <Button asChild variant="secondary">
        <Link to="/">{t('errorPage.home')}</Link>
      </Button>
      {reference && (
        <p className="w-full text-sm text-muted">{t('errorPage.reference', { id: reference })}</p>
      )}
    </StatusLayout>
  );
}
