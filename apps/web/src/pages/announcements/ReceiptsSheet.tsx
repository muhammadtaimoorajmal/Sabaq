import type { AnnouncementForUser } from '@sabaq/shared';
import { useTranslation } from 'react-i18next';
import { useReceipts } from '../../api/announcements';
import { ApiRequestError, apiAsset } from '../../api/client';
import {
  Alert,
  Avatar,
  Button,
  Sheet,
  SheetContent,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { relativeTime } from '../../lib/dates';

/**
 * Who has seen an announcement. "Not seen" comes first: that is who the sender may want to
 * remind. The list refreshes every few seconds while open, so receipts arrive live.
 */
export function ReceiptsSheet({
  announcement,
  onOpenChange,
}: {
  announcement: AnnouncementForUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const open = announcement !== null;
  const receipts = useReceipts(announcement?.classId ?? '', announcement?.id ?? '', open);
  const data = receipts.data;
  const percent =
    data && data.memberCount > 0 ? Math.round((data.seenCount / data.memberCount) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t('announcements.receipts.title')}
        description={
          announcement
            ? t('announcements.receipts.intro', { title: announcement.title })
            : undefined
        }
      >
        {receipts.isPending && (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {receipts.isError && (
          <Alert
            tone="danger"
            title={t(
              errorKey(receipts.error instanceof ApiRequestError ? receipts.error.code : undefined),
            )}
            action={
              <Button size="sm" variant="secondary" onClick={() => void receipts.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {data && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p aria-live="polite" className="text-lg font-bold text-text">
                {t('announcements.seenBy', { seen: data.seenCount, members: data.memberCount })}
              </p>
              <div
                role="progressbar"
                aria-label={t('announcements.receipts.progress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={t('announcements.receipts.percent', { percent })}
                className="h-2.5 overflow-hidden rounded-full bg-surface-sunken"
              >
                <div
                  className="h-full rounded-full bg-success-text"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <Tabs defaultValue="not-seen">
              <TabList label={t('announcements.receipts.title')}>
                <Tab value="not-seen">
                  {t('announcements.receipts.notSeen', { count: data.notSeen.length })}
                </Tab>
                <Tab value="seen">
                  {t('announcements.receipts.seen', { count: data.seen.length })}
                </Tab>
              </TabList>
              <TabPanel value="not-seen">
                {data.notSeen.length === 0 ? (
                  <p className="py-4 text-muted">{t('announcements.receipts.everyone')}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {data.notSeen.map((user) => (
                      <li key={user.id} className="flex items-center gap-3 py-2.5">
                        <Avatar
                          name={user.name}
                          src={apiAsset(user.avatarUrl)}
                          size="sm"
                          decorative
                        />
                        <span className="font-medium text-text">{user.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabPanel>
              <TabPanel value="seen">
                {data.seen.length === 0 ? (
                  <p className="py-4 text-muted">{t('announcements.receipts.nobody')}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {data.seen.map(({ user, seenAt }) => (
                      <li key={user.id} className="flex items-center gap-3 py-2.5">
                        <Avatar
                          name={user.name}
                          src={apiAsset(user.avatarUrl)}
                          size="sm"
                          decorative
                        />
                        <span className="min-w-0 flex-1 font-medium text-text">{user.name}</span>
                        <span className="text-sm text-muted">
                          {t('announcements.receipts.seenAt', {
                            when: relativeTime(seenAt, i18n.language),
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabPanel>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
