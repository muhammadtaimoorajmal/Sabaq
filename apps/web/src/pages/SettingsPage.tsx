import type { SessionInfo } from '@sabaq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../api/client';
import { useAuth, useCurrentUser } from '../auth/AuthProvider';
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
import { relativeTime } from '../lib/dates';
import { PreferencesPanel } from '../preferences/PreferencesPanel';
import { AccountDataCard } from './account/AccountDataCard';
import { AvatarPicker } from './account/AvatarPicker';
import { NotificationSettings } from './account/NotificationSettings';
import { ProfileForm } from './account/ProfileForm';
import { RegionalSettings } from './account/RegionalSettings';
import { ChangePasswordCard } from './ChangePasswordCard';

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

const SECTIONS = ['profile', 'display', 'regional', 'notifications', 'security', 'data'] as const;
type Section = (typeof SECTIONS)[number];

/** A settings card with its heading, which the "On this page" links point to. */
function SettingsSection({
  id,
  children,
  intro = true,
}: {
  id: Section;
  children: ReactNode;
  intro?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card
      role="region"
      aria-labelledby={`settings-${id}`}
      className="flex scroll-mt-24 flex-col gap-5"
      id={`section-${id}`}
    >
      <div>
        <h2 id={`settings-${id}`} className="text-xl font-bold text-text">
          {t(`account.sections.${id}`)}
        </h2>
        {intro && <p className="text-muted">{t(`account.intros.${id}`)}</p>}
      </div>
      {children}
    </Card>
  );
}

function ProfileSection() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  return (
    <SettingsSection id="profile">
      <AvatarPicker />
      <div className="flex flex-col gap-1">
        <span className="font-semibold text-text">{t('auth.fields.email')}</span>
        <p className="flex flex-wrap items-center gap-2 text-text" dir="ltr">
          <span className="min-w-0 [overflow-wrap:anywhere]">{user.email}</span>
          <Badge tone={user.emailVerified ? 'success' : 'warning'}>
            {user.emailVerified ? t('account.profile.verified') : t('account.profile.unverified')}
          </Badge>
        </p>
      </div>
      <ProfileForm
        id="profile"
        submitLabel={t('account.profile.save')}
        onSaved={() => toast.success(t('account.profile.saved'))}
      />
    </SettingsSection>
  );
}

/**
 * Everything about the person's account on one page, in the order people look for it, with
 * links to each part. Display, time and notification settings apply as soon as they change and
 * are saved to the account, so they follow the person to every device.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display font-bold tracking-tight text-text">{t('settings.title')}</h1>
        <p className="text-muted">{t('account.syncNote')}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[12rem_1fr]">
        <nav aria-label={t('account.onThisPage')} className="lg:sticky lg:top-20">
          <h2 className="mb-2 text-sm font-semibold text-muted">{t('account.onThisPage')}</h2>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {SECTIONS.map((section) => (
              <li key={section}>
                <a
                  href={`#section-${section}`}
                  className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-text underline-offset-4 hover:bg-surface-sunken hover:underline lg:w-full"
                >
                  {t(`account.sections.${section}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          <ProfileSection />
          <SettingsSection id="display">
            <PreferencesPanel />
          </SettingsSection>
          <SettingsSection id="regional">
            <RegionalSettings />
          </SettingsSection>
          <SettingsSection id="notifications">
            <NotificationSettings />
          </SettingsSection>
          <section
            id="section-security"
            aria-labelledby="settings-security"
            className="flex scroll-mt-24 flex-col gap-6"
          >
            <h2 id="settings-security" className="sr-only">
              {t('account.sections.security')}
            </h2>
            <ChangePasswordCard />
            <Devices />
          </section>
          <div id="section-data" className="scroll-mt-24">
            <AccountDataCard />
          </div>
        </div>
      </div>
    </div>
  );
}
