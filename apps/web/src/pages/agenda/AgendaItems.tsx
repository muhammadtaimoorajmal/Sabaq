import type { AgendaSession, AgendaTask } from '@sabaq/shared';
import { ExternalLink, MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useSetDone } from '../../api/agenda';
import { ApiRequestError } from '../../api/client';
import {
  Badge,
  Checkbox,
  CourseTag,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { formatWhen, relativeTime } from '../../lib/dates';
import type { DisplaySettings } from '../announcements/meta';

/** Marks a task done (or not) with an Undo in the confirmation, so a slip costs nothing. */
export function useToggleDone() {
  const { t } = useTranslation();
  const setDone = useSetDone();
  return (task: AgendaTask, done: boolean) => {
    const failed = (error: unknown) =>
      toast.error(
        error instanceof ApiRequestError && error.code === 'network'
          ? t('agenda.offlineChange')
          : t(errorKey(error instanceof ApiRequestError ? error.code : undefined)),
      );
    setDone.mutate(
      { id: task.id, done },
      {
        onError: failed,
        onSuccess: () => {
          if (!done) return;
          toast(t('agenda.doneToast', { title: task.title }), {
            action: {
              label: t('agenda.undo'),
              onClick: () => setDone.mutate({ id: task.id, done: false }, { onError: failed }),
            },
          });
        },
      },
    );
  };
}

/** The clock time of an instant in the person's time zone and format. */
export const clockTime = (iso: string, display: DisplaySettings) =>
  new Intl.DateTimeFormat(display.language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: display.timeFormat === '12h',
    timeZone: display.timeZone,
  }).format(new Date(iso));

/**
 * One task: a checkbox to mark it done, when it is due with a live countdown, and its course
 * and class. Personal tasks can be edited and deleted; class tasks link to their announcement.
 */
export function TaskItem({
  task,
  now,
  display,
  withDay = false,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: AgendaTask;
  now: Date;
  display: DisplaySettings;
  /** Shows the date as well as the time (for lists that span several days). */
  withDay?: boolean;
  onToggle: (task: AgendaTask, done: boolean) => void;
  onEdit?: (task: AgendaTask) => void;
  onDelete?: (task: AgendaTask) => void;
}) {
  const { t } = useTranslation();
  const done = task.completedAt !== null;
  const overdue = !done && new Date(task.dueAt) < now;
  const when = withDay
    ? formatWhen(task.dueAt, display.language, display.timeZone, display.timeFormat, now)
    : clockTime(task.dueAt, display);
  const countdown = relativeTime(task.dueAt, display.language, now.getTime());

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-default bg-surface p-3',
        overdue ? 'border-danger/50' : 'border-border',
      )}
    >
      <Checkbox
        className="min-w-0 flex-1"
        checked={done}
        onCheckedChange={(checked) => onToggle(task, checked)}
        label={
          <span className={cn('font-semibold', done && 'text-muted line-through')}>
            {task.title}
            <span className="sr-only">
              {' '}
              ({done ? t('agenda.doneState') : t('agenda.notDoneState')})
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn(overdue && 'font-semibold text-danger-text')}>
              {overdue
                ? t('agenda.wasDue', { when, countdown })
                : t('agenda.due', { when, countdown })}
            </span>
            {task.course && <CourseTag code={task.course.code} color={task.course.color} />}
            <span>{t(`announcements.taskTypes.${task.type}`)}</span>
            {task.className ? <span>{task.className}</span> : <span>{t('agenda.personal')}</span>}
          </span>
        }
      />
      {overdue && <Badge tone="danger">{t('agenda.overdue')}</Badge>}
      {task.canManage && onEdit && onDelete ? (
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              label={t('agenda.actions', { title: task.title })}
              icon={<MoreVertical />}
              size="sm"
            />
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Pencil />} onSelect={() => onEdit(task)}>
              {t('agenda.edit')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => onDelete(task)}>
              {t('agenda.delete')}
            </MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        task.announcementId &&
        task.classId && (
          <Link
            to={`/classes/${task.classId}?tab=announcements&announcement=${task.announcementId}`}
            aria-label={t('agenda.openAnnouncement', { title: task.title })}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-text"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </Link>
        )
      )}
    </div>
  );
}

/** One class meeting, showing announced cancellations and room changes. */
export function SessionItem({
  session,
  display,
}: {
  session: AgendaSession;
  display: DisplaySettings;
}) {
  const { t } = useTranslation();
  const cancelled = session.status === 'cancelled';
  const time = `${clockTime(session.startsAt, display)}–${clockTime(session.endsAt, display)}`;
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border-default p-3',
        cancelled ? 'border-border bg-surface-sunken' : 'border-border bg-surface',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('font-semibold text-text tabular-nums', cancelled && 'line-through')}>
          {time}
        </span>
        <CourseTag code={session.course.code} color={session.course.color} />
        <span className="text-sm text-muted">{t(`classes.courses.kinds.${session.kind}`)}</span>
        {cancelled && <Badge tone="danger">{t('agenda.cancelled')}</Badge>}
        {session.status === 'moved' && <Badge tone="warning">{t('agenda.moved')}</Badge>}
      </div>
      <p className={cn('text-sm text-text', cancelled && 'text-muted line-through')}>
        {session.course.title}
      </p>
      {session.venue && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin aria-hidden="true" className="size-4" />
          {session.status === 'moved' && session.originalVenue
            ? t('agenda.movedTo', { venue: session.venue, usual: session.originalVenue })
            : session.venue}
        </p>
      )}
      {session.announcementId && (
        <Link
          to={`/classes/${session.classId}?tab=announcements&announcement=${session.announcementId}`}
          className="self-start text-sm font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
        >
          {t('agenda.seeAnnouncement')}
        </Link>
      )}
    </div>
  );
}
