import {
  ANNOUNCEMENT_TYPES,
  type AnnouncementForUser,
  type AnnouncementType,
  type ClassForMember,
  type Course,
} from '@sabaq/shared';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Megaphone, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  announcementKeys,
  type FeedFilters,
  SEEN_BATCH_MS,
  useAnnouncementFeed,
  useDeleteAnnouncement,
  useMarkSeen,
} from '../../api/announcements';
import { classKeys, useClasses } from '../../api/classes';
import { api, ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { allowed } from '../classes/helpers';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementComposer } from './AnnouncementComposer';
import { ReceiptsSheet } from './ReceiptsSheet';

/** Typing in the search box waits this long before searching. */
const SEARCH_DELAY_MS = 350;

/**
 * Reports announcements as seen in batches: everything that came into view within a short
 * pause is sent in one request.
 */
function useSeenBatcher() {
  const markSeen = useMarkSeen();
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { mutate } = markSeen;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(
    (id: string) => {
      pending.current.add(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const ids = [...pending.current];
        pending.current.clear();
        if (ids.length > 0) mutate(ids);
      }, SEEN_BATCH_MS);
    },
    [mutate],
  );
}

/**
 * The announcement feed: for one class (`classId`) or across every class (the inbox).
 * Pinned announcements come first; unread ones are marked and count as seen once they have
 * been on screen for a moment.
 */
export function AnnouncementFeed({ classId }: { classId?: string }) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const classes = useClasses();
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<AnnouncementType | ''>('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState<{ announcement: AnnouncementForUser | null } | null>(
    null,
  );
  const [receiptsFor, setReceiptsFor] = useState<AnnouncementForUser | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementForUser | null>(null);
  const highlightId = params.get('announcement');

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const filters: FeedFilters = {
    ...(classId && { classId }),
    ...(type && { type }),
    ...(show === 'unread' && { unread: true }),
    ...(q && { q }),
  };
  const postable = (classes.data ?? []).filter(
    (cls) => (!classId || cls.id === classId) && allowed(user, cls, 'announcement.create'),
  );
  const managesAny = postable.length > 0;
  const feed = useAnnouncementFeed(filters, { live: managesAny });
  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const onSeen = useSeenBatcher();
  const markSeen = useMarkSeen();
  const remove = useDeleteAnnouncement(deleting?.classId ?? classId ?? '');
  const queryClient = useQueryClient();
  const pin = useMutation({
    mutationFn: (announcement: AnnouncementForUser) =>
      api(`/classes/${announcement.classId}/announcements/${announcement.id}`, {
        method: 'PATCH',
        body: { pinned: !announcement.pinned },
      }),
    onSuccess: (_result, announcement) => {
      toast(announcement.pinned ? t('announcements.unpinnedDone') : t('announcements.pinnedDone'));
      void queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
    onError: (error) =>
      toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined))),
  });
  const classById = new Map((classes.data ?? []).map((cls) => [cls.id, cls]));

  // Course tags for every class in view.
  const classIds = [...new Set(items.map((item) => item.classId))];
  const courseQueries = useQueries({
    queries: classIds.map((id) => ({
      queryKey: classKeys.courses(id),
      queryFn: () => api<Course[]>(`/classes/${id}/courses`),
    })),
  });
  const courseById = new Map(
    courseQueries.flatMap((query) => query.data ?? []).map((course) => [course.id, course]),
  );

  // A link from a notification opens the feed at that announcement.
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightId || focused.current === highlightId) return;
    const element = document.getElementById(`announcement-${highlightId}`);
    if (!element) return;
    focused.current = highlightId;
    element.scrollIntoView({ block: 'center' });
    element.focus({ preventScroll: true });
  }, [highlightId, items]);

  const display = {
    language: i18n.language,
    timeZone: user.preferences.timeZone,
    timeFormat: user.preferences.timeFormat,
  };
  const unreadIds = items.filter((item) => item.seenAt === null).map((item) => item.id);
  const filtered = Boolean(type || q);

  const composerClasses: ClassForMember[] = postable;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border-default border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-4">
          <SegmentedControl
            legend={t('announcements.filters.show')}
            value={show}
            onValueChange={setShow}
            options={[
              { value: 'all', label: t('announcements.filters.all') },
              { value: 'unread', label: t('announcements.filters.unread') },
            ]}
          />
          <Field
            id={`announcement-type-filter${classId ? `-${classId}` : ''}`}
            label={t('announcements.filters.type')}
            className="min-w-44"
          >
            <Select
              value={type}
              onChange={(event) => setType(event.target.value as AnnouncementType | '')}
            >
              <option value="">{t('announcements.filters.anyType')}</option>
              {ANNOUNCEMENT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t(`announcements.types.${item}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id={`announcement-search${classId ? `-${classId}` : ''}`}
            label={t('announcements.filters.search')}
            className="min-w-52 flex-1"
          >
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted"
              />
              <Input
                type="search"
                className="ps-10"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {managesAny && (
            <Button onClick={() => setComposing({ announcement: null })}>
              <Plus aria-hidden="true" />
              {t('announcements.post')}
            </Button>
          )}
          {unreadIds.length > 0 && (
            <Button
              variant="secondary"
              loading={markSeen.isPending}
              onClick={() =>
                markSeen.mutate(unreadIds, {
                  onSuccess: () => toast(t('announcements.markedAllRead')),
                })
              }
            >
              <CheckCheck aria-hidden="true" />
              {t('announcements.markAllRead')}
            </Button>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {feed.data && t('announcements.resultCount', { count: items.length })}
      </p>

      {feed.isPending && (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}
      {feed.isError && (
        <Alert
          tone="danger"
          title={t('announcements.loadFailed')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void feed.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}

      {feed.data && items.length === 0 && (
        <EmptyState
          icon={<Megaphone />}
          headingLevel={classId ? 3 : 2}
          title={
            filtered
              ? t('announcements.empty.filteredTitle')
              : show === 'unread'
                ? t('announcements.empty.unreadTitle')
                : t('announcements.empty.title')
          }
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setType('');
                  setText('');
                }}
              >
                {t('announcements.empty.clear')}
              </Button>
            ) : undefined
          }
          className="rounded-xl border-default border-dashed border-border-strong"
        >
          {filtered
            ? t('announcements.empty.filteredBody')
            : show === 'unread'
              ? t('announcements.empty.unreadBody')
              : managesAny
                ? t('announcements.empty.managerBody')
                : t('announcements.empty.body')}
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-4">
          {items.map((announcement) => {
            const course = announcement.courseId ? courseById.get(announcement.courseId) : null;
            return (
              <li key={announcement.id}>
                <AnnouncementCard
                  announcement={announcement}
                  display={display}
                  headingLevel={classId ? 3 : 2}
                  course={course ? { code: course.code, color: course.color } : null}
                  className={classId ? undefined : classById.get(announcement.classId)?.name}
                  highlighted={announcement.id === highlightId}
                  onSeen={onSeen}
                  actions={{
                    onEdit: (item) => setComposing({ announcement: item }),
                    onTogglePin: (item) => pin.mutate(item),
                    onDelete: setDeleting,
                    onShowReceipts: setReceiptsFor,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {feed.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {t('announcements.loadMore')}
        </Button>
      )}

      {composing && (
        <AnnouncementComposer
          open
          onOpenChange={(open) => {
            if (!open) setComposing(null);
          }}
          classes={
            composing.announcement
              ? (classes.data ?? []).filter((cls) => cls.id === composing.announcement?.classId)
              : composerClasses
          }
          classId={composing.announcement?.classId ?? classId ?? composerClasses[0]?.id ?? ''}
          announcement={composing.announcement}
        />
      )}
      <ReceiptsSheet
        announcement={receiptsFor}
        onOpenChange={(open) => {
          if (!open) setReceiptsFor(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('announcements.deleteTitle', { title: deleting?.title ?? '' })}
        body={t('announcements.deleteBody')}
        confirmLabel={t('announcements.deleteConfirm')}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast(t('announcements.deleted'));
              setDeleting(null);
              if (highlightId === deleting.id) {
                params.delete('announcement');
                setParams(params, { replace: true });
              }
            },
            onError: (error) =>
              toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined))),
          });
        }}
      />
    </div>
  );
}
