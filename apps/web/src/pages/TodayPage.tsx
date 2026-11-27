import { addDays, type AgendaTask, groupByUrgency } from '@sabaq/shared';
import {
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  FileCheck,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCompleteOnboarding } from '../api/account';
import { useAgenda } from '../api/agenda';
import { useClasses } from '../api/classes';
import { useCurrentUser } from '../auth/AuthProvider';
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CourseTag,
  EmptyState,
  Skeleton,
} from '../components/ui';
import { todayKey, useNow } from '../lib/calendar';
import { formatWhen, relativeTime } from '../lib/dates';
import { SessionItem, TaskItem, useToggleDone } from './agenda/AgendaItems';
import { useTaskEditor } from './agenda/TaskSheet';
import type { DisplaySettings } from './announcements/meta';
import { ClassActions } from './classes/ClassesPage';

/** The part of the day in the person's own time zone. */
export function partOfDay(now: Date, timeZone: string): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now),
  );
  if (hour < 12) return 'morning';
  return hour < 17 ? 'afternoon' : 'evening';
}

const TITLES = /^(dr|prof|mr|mrs|ms|miss|engr|sir|madam)\.?$/i;

/** How to greet someone: the first name, keeping a title such as "Dr." in front of it. */
export function greetingName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const [first = fullName, second] = words;
  return TITLES.test(first) && second ? `${first} ${second}` : first;
}

/** Invites people who left the welcome steps early to finish them, until they do or dismiss it. */
function FinishSetupCard() {
  const { t } = useTranslation();
  const dismiss = useCompleteOnboarding();
  return (
    <Card
      role="region"
      aria-labelledby="finish-setup"
      className="flex flex-wrap items-center gap-4 border-primary/40 bg-primary-soft"
    >
      <Sparkles aria-hidden="true" className="size-6 shrink-0 text-primary-text" />
      <div className="min-w-0 flex-1">
        <h2 id="finish-setup" className="font-bold text-text">
          {t('today.setup.title')}
        </h2>
        <p className="text-muted">{t('today.setup.body')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/welcome" className={buttonVariants({ size: 'sm' })}>
          {t('today.setup.action')}
        </Link>
        <Button
          size="sm"
          variant="ghost"
          loading={dismiss.isPending}
          onClick={() => dismiss.mutate()}
        >
          {t('today.setup.dismiss')}
        </Button>
      </div>
    </Card>
  );
}

/** The one thing to know first: what is due next, and how long is left. */
function NextDeadline({
  task,
  display,
  now,
}: {
  task: AgendaTask;
  display: DisplaySettings;
  now: Date;
}) {
  const { t } = useTranslation();
  return (
    <Card
      role="region"
      aria-labelledby="next-deadline"
      className="flex flex-col gap-2 border-primary/40 bg-primary-soft"
    >
      <h2 id="next-deadline" className="flex items-center gap-2 font-semibold text-primary-text">
        <CalendarClock aria-hidden="true" className="size-5" />
        {t('today.next.title')}
      </h2>
      <p className="text-2xl font-bold text-text">{task.title}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text">
        <span className="font-semibold">
          {t('agenda.due', {
            when: formatWhen(
              task.dueAt,
              display.language,
              display.timeZone,
              display.timeFormat,
              now,
            ),
            countdown: relativeTime(task.dueAt, display.language, now.getTime()),
          })}
        </span>
        {task.course && <CourseTag code={task.course.code} color={task.course.color} />}
        {task.className && <span className="text-muted">{task.className}</span>}
      </p>
      <Link
        to={`/tasks/${task.id}`}
        className={buttonVariants({
          variant: task.submissionRule ? 'primary' : 'secondary',
          size: 'sm',
          className: 'self-start',
        })}
      >
        {task.submissionRule ? <FileCheck aria-hidden="true" /> : null}
        {task.submissionRule ? t('task.checkFile') : t('task.details')}
      </Link>
    </Card>
  );
}

/** A titled list of tasks; renders nothing when empty. */
function TaskSection({
  id,
  title,
  tasks,
  danger = false,
  children,
}: {
  id: string;
  title: string;
  tasks: AgendaTask[];
  danger?: boolean;
  children: (task: AgendaTask) => ReactNode;
}) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className={`text-xl font-bold ${danger ? 'text-danger-text' : 'text-text'}`}>
        {title} <span className="font-normal text-muted">({tasks.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id}>{children(task)}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The home page: the next deadline first, then what is overdue, due today, today's classes
 * (with announced cancellations and room changes), tomorrow and the rest of the week. On
 * phones today's classes come right after what is due today; on wide screens they sit beside.
 */
export function TodayPage() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const now = useNow();
  const classes = useClasses();
  const { timeZone } = user.preferences;
  const today = todayKey(timeZone, now);
  const agenda = useAgenda(today, addDays(today, 7));
  const toggle = useToggleDone();
  const editor = useTaskEditor();
  const display: DisplaySettings = {
    language: i18n.language,
    timeZone,
    timeFormat: user.preferences.timeFormat,
  };
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeZone }).format(now);

  const tasks = agenda.data?.tasks ?? [];
  const open = tasks.filter((task) => task.completedAt === null);
  const groups = groupByUrgency(open, (task) => task.dueAt, now, timeZone);
  // Work finished today stays visible (struck through) so it can be undone.
  const doneToday = tasks.filter(
    (task) => task.completedAt !== null && todayKey(timeZone, new Date(task.dueAt)) === today,
  );
  const next = open.find((task) => new Date(task.dueAt) >= now);
  const sessions = (agenda.data?.sessions ?? []).filter((session) => session.day === today);
  const noClasses = classes.data?.length === 0;
  const nothingAhead = agenda.data && open.length === 0 && doneToday.length === 0;
  const item = (withDay: boolean) => (task: AgendaTask) => (
    <TaskItem
      task={task}
      now={now}
      display={display}
      withDay={withDay}
      onToggle={toggle}
      onEdit={editor.edit}
      onDelete={editor.remove}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-muted">{date}</p>
          <h1 className="text-display font-bold tracking-tight text-text">
            {t(`today.${partOfDay(now, timeZone)}`, { name: greetingName(user.name) })}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => editor.add()}>
            <Plus aria-hidden="true" />
            {t('agenda.addTask')}
          </Button>
          <Link to="/timeline" className={buttonVariants({ variant: 'ghost' })}>
            <CalendarRange aria-hidden="true" />
            {t('today.openTimeline')}
          </Link>
        </div>
      </header>
      {!user.onboardedAt && <FinishSetupCard />}

      {agenda.isPending && (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {agenda.isError && !agenda.data && (
        <Alert
          tone="danger"
          title={t('today.loadFailed')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void agenda.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}

      {next && <NextDeadline task={next} display={display} now={now} />}

      {nothingAhead && (
        <EmptyState
          icon={<CalendarCheck />}
          title={noClasses ? t('today.emptyTitle') : t('today.clearTitle')}
          action={
            noClasses ? (
              <ClassActions />
            ) : (
              <Link to="/timeline" className={buttonVariants({ variant: 'secondary' })}>
                {t('today.openTimeline')}
              </Link>
            )
          }
          className="rounded-xl border-default border-dashed border-border-strong"
        >
          {noClasses ? t('today.emptyBody') : t('today.clearBody')}
        </EmptyState>
      )}

      {agenda.data && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <TaskSection
              id="today-overdue"
              title={t('today.overdue')}
              tasks={groups.overdue}
              danger
            >
              {item(true)}
            </TaskSection>
            <TaskSection
              id="today-due"
              title={t('today.dueToday')}
              tasks={[...groups.today, ...doneToday]}
            >
              {item(false)}
            </TaskSection>
          </div>
          <section
            aria-labelledby="today-classes"
            className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          >
            <h2 id="today-classes" className="text-xl font-bold text-text">
              {t('today.classes')}
            </h2>
            {sessions.length === 0 ? (
              <p className="rounded-lg border-default border-dashed border-border p-4 text-muted">
                {noClasses ? t('today.noClassesJoined') : t('today.noClassesToday')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <SessionItem session={session} display={display} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex min-w-0 flex-col gap-6">
            <TaskSection id="today-tomorrow" title={t('today.tomorrow')} tasks={groups.tomorrow}>
              {item(false)}
            </TaskSection>
            <TaskSection id="today-week" title={t('today.thisWeek')} tasks={groups.next_7_days}>
              {item(true)}
            </TaskSection>
          </div>
        </div>
      )}
      {editor.node}
    </div>
  );
}
