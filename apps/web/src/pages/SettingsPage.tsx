import type { SessionInfo } from '@sabaq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Skeleton,
} from '../components/ui';
import { errorKey } from '../i18n';
import { PreferencesPanel } from '../preferences/PreferencesPanel';

/** "3 minutes ago", "yesterday" … in the interface language. */
export function relativeTime(iso: string, language: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

function Devices() {
  const { t, i18n } = useTranslation();
  const { endLocally } = useAuth();
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<SessionInfo[]>('/auth/sessions'),
  });

  const revoke = useMutation({
    mutationFn: (session: SessionInfo) => api(`/auth/sessions/${session.id}`, { method: 'DELETE' }),
    onSuccess: (_result, session) => {
      toast(t('settings.deviceSignedOut', { device: session.device }));
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) =>
      toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined))),
  });

  const everywhere = useMutation({
    mutationFn: () => api('/auth/logout-all', { method: 'POST' }),
    onSuccess: endLocally,
    onError: (error) =>
      toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined))),
  });

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-text">{t('settings.devices')}</h2>
        <p className="text-muted">{t('settings.devicesBody')}</p>
      </div>

      {sessions.isPending && (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
      {sessions.isError && (
        <Alert
          tone="danger"
          title={t('settings.loadFailed')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void sessions.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {sessions.data && (
        <ul className="flex flex-col divide-y divide-border">
          {sessions.data.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
              <Laptop aria-hidden="true" className="size-6 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-text">
                  {session.device}
                  {session.current && <Badge tone="success">{t('settings.thisDevice')}</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {t('settings.lastActive', {
                    when: relativeTime(session.lastUsedAt, i18n.language),
                  })}
                </p>
              </div>
              {!session.current && (
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={t('settings.signOutDeviceLabel', { device: session.device })}
                  loading={revoke.isPending && revoke.variables.id === session.id}
                  onClick={() => revoke.mutate(session)}
                >
                  {t('settings.signOutDevice')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" className="self-start">
            <LogOut aria-hidden="true" />
            {t('settings.signOutEverywhere')}
          </Button>
        </DialogTrigger>
        <DialogContent
          title={t('settings.confirmTitle')}
          description={t('settings.confirmBody')}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">{t('common.cancel')}</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={everywhere.isPending}
                onClick={() => everywhere.mutate()}
              >
                {t('settings.signOutEverywhere')}
              </Button>
            </>
          }
        />
      </Dialog>
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display font-bold tracking-tight text-text">{t('settings.title')}</h1>
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">{t('settings.display')}</h2>
          <p className="text-muted">{t('settings.displayBody')}</p>
        </div>
        <PreferencesPanel />
      </Card>
      <Devices />
    </div>
  );
}
