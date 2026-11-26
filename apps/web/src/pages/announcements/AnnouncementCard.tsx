import type { AnnouncementForUser, ColorToken } from '@sabaq/shared';
import { ExternalLink, MoreVertical, Pencil, Pin, PinOff, Trash2, Users } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiAsset } from '../../api/client';
import {
  Avatar,
  Badge,
  CourseTag,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '../../components/ui';
import { cn } from '../../lib/cn';
import { relativeTime } from '../../lib/dates';
import { type DisplaySettings, isUpdatedSinceSeen, keyFact, TYPE_META } from './meta';
import { useSeenOnView } from './useSeenOnView';

/** Long details are folded after this many characters, with "Show more". */
const FOLD_AT = 280;

export interface CardActions {
  onEdit: (announcement: AnnouncementForUser) => void;
  onTogglePin: (announcement: AnnouncementForUser) => void;
  onDelete: (announcement: AnnouncementForUser) => void;
  onShowReceipts: (announcement: AnnouncementForUser) => void;
}

/**
 * One announcement: what it is, the one fact that matters (when or where), the details, who
 * posted it and what changed since. Managers also see how many members have seen it.
 */
export function AnnouncementCard({
  announcement,
  display,
  course,
  className: classLabel,
  headingLevel = 3,
  highlighted = false,
  actions,
  onSeen,
  now = new Date(),
}: {
  announcement: AnnouncementForUser;
  display: DisplaySettings;
  course?: { code: string; color: ColorToken } | null;
  /** The class's name, shown when the feed mixes classes. */
  className?: string;
  headingLevel?: 2 | 3;
  highlighted?: boolean;
  /** Absent in previews, which are not interactive. */
  actions?: CardActions;
  onSeen?: (id: string) => void;
  now?: Date;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[announcement.type];
  const Icon = meta.icon;
  const unread = announcement.seenAt === null;
  const updated = isUpdatedSinceSeen(announcement);
  const fact = keyFact(announcement, t, display, now);
  const long = announcement.body.length > FOLD_AT;
  const body =
    long && !expanded ? `${announcement.body.slice(0, FOLD_AT).trimEnd()}…` : announcement.body;
  const lastEdit = announcement.edits.at(-1);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const { id } = announcement;

  const seen = useCallback(() => onSeen?.(id), [onSeen, id]);
  useSeenOnView(ref, unread && Boolean(onSeen), seen);

  const ago = (iso: string) => relativeTime(iso, display.language, now.getTime());
  const fieldList = (fields: string[]) =>
    new Intl.ListFormat(display.language, { type: 'conjunction' }).format(
      fields.map((field) => t(`announcements.fields.${field}` as 'announcements.fields.title')),
    );

  return (
    <article
      ref={ref}
      id={`announcement-${id}`}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border-default bg-surface p-5 shadow-sm',
        unread ? 'border-primary/50' : 'border-border',
        highlighted && 'ring-3 ring-focus',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold',
            meta.accent,
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
          {t(`announcements.types.${announcement.type}`)}
        </span>
        {course && <CourseTag code={course.code} color={course.color} />}
        {classLabel && <span className="text-sm text-muted">{classLabel}</span>}
        {announcement.pinned && (
          <Badge tone="neutral" icon={<Pin />}>
            {t('announcements.pinned')}
          </Badge>
        )}
        {updated ? (
          <Badge tone="warning">{t('announcements.updated')}</Badge>
        ) : (
          unread && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
              {t('announcements.unread')}
            </span>
          )
        )}
        {actions && announcement.canManage && (
          <div className="ms-auto">
            <Menu>
              <MenuTrigger asChild>
                <IconButton
                  label={t('announcements.actions', { title: announcement.title })}
                  icon={<MoreVertical />}
                  size="sm"
                />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Pencil />} onSelect={() => actions.onEdit(announcement)}>
                  {t('announcements.edit')}
                </MenuItem>
                <MenuItem
                  icon={announcement.pinned ? <PinOff /> : <Pin />}
                  onSelect={() => actions.onTogglePin(announcement)}
                >
                  {announcement.pinned ? t('announcements.unpin') : t('announcements.pin')}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={() => actions.onDelete(announcement)}>
                  {t('announcements.delete')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Heading id={titleId} className="text-lg font-bold text-text">
          {announcement.title}
        </Heading>
        {fact && <p className="font-semibold text-text">{fact}</p>}
        {announcement.type === 'deadline' && announcement.dueAt && (
          <p className="text-sm text-muted">{ago(announcement.dueAt)}</p>
        )}
      </div>

      {body && (
        <div className="flex flex-col items-start gap-1">
          <p className="whitespace-pre-line text-text [overflow-wrap:anywhere]">{body}</p>
          {long && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="min-h-11 font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
            >
              {expanded ? t('announcements.showLess') : t('announcements.showMore')}
            </button>
          )}
        </div>
      )}

      {announcement.links.length > 0 && (
        <ul className="flex flex-col gap-1">
          {announcement.links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
              >
                {link.label}
                <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">{t('announcements.newTab')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t-default border-border pt-3 text-sm text-muted">
        <span className="flex items-center gap-2">
          <Avatar
            name={announcement.author?.name ?? t('announcements.formerMember')}
            src={apiAsset(announcement.author?.avatarUrl)}
            size="sm"
            decorative
          />
          {t('announcements.postedBy', {
            name: announcement.author?.name ?? t('announcements.formerMember'),
            when: ago(announcement.createdAt),
          })}
        </span>
        {lastEdit && (
          <details className="group">
            <summary className="min-h-11 cursor-pointer list-none py-2 font-semibold text-text underline underline-offset-2 hover:no-underline [&::-webkit-details-marker]:hidden">
              {t('announcements.edited', { when: ago(lastEdit.editedAt) })}
            </summary>
            <ol className="mt-1 flex flex-col gap-1">
              {[...announcement.edits].reverse().map((edit) => (
                <li key={edit.editedAt}>
                  {t('announcements.editLine', {
                    name: edit.editedBy?.name ?? t('announcements.formerMember'),
                    fields: fieldList(edit.changedFields),
                    when: ago(edit.editedAt),
                  })}
                </li>
              ))}
            </ol>
          </details>
        )}
        {announcement.receipts && actions && (
          <button
            type="button"
            onClick={() => actions.onShowReceipts(announcement)}
            className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold text-text hover:bg-surface-sunken"
          >
            <Users aria-hidden="true" className="size-4" />
            {t('announcements.seenBy', {
              seen: announcement.receipts.seen,
              members: announcement.receipts.members,
            })}
            <span
              aria-hidden="true"
              className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunken"
            >
              <span
                className="block h-full rounded-full bg-success-text"
                style={{
                  width: `${announcement.receipts.members === 0 ? 0 : Math.round((announcement.receipts.seen / announcement.receipts.members) * 100)}%`,
                }}
              />
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
