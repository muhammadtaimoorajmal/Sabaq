import {
  addDays,
  type AgendaSession,
  type AgendaTask,
  dayKeyOf,
  TASK_TYPES,
  type TaskType,
  zonedDateTime,
} from '@sabaq/shared';
import { ChevronLeft, ChevronRight, Flame, Plus, SlidersHorizontal } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useAgenda } from '../../api/agenda';
import { useClasses } from '../../api/classes';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  buttonVariants,
  EmptyState,
  Field,
  IconButton,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
} from '../../components/ui';
import { formatDay, monthGrid, todayKey, useNow, weekRange } from '../../lib/calendar';
import { cn } from '../../lib/cn';
import type { DisplaySettings } from '../announcements/meta';
import { SessionItem, TaskItem, useToggleDone } from './AgendaItems';
import { useTaskEditor } from './TaskSheet';

export const VIEWS = ['list', 'week', 'month'] as const;
type View = (typeof VIEWS)[number];
/** The list view shows this many days from the chosen day. */
export const LIST_DAYS = 30;

const isDay = (value: string | null): value is string =>
  value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);

interface DayContent {
  tasks: AgendaTask[];
  sessions: AgendaSession[];
}

/** One day's classes and tasks. */
function DayBlock({
  day,
  content,
  display,
  now,
  today,
  headingLevel,
  onToggle,
  editor,
  compact = false,
}: {
  day: string;
  content: DayContent;
  display: DisplaySettings;
  now: Date;
  today: string;
  headingLevel: 'h2' | 'h3';
  onToggle: ReturnType<typeof useToggleDone>;
  editor: ReturnType<typeof useTaskEditor>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const Heading = headingLevel;
  const empty = content.tasks.length === 0 && content.sessions.length === 0;
  return (
    <section aria-labelledby={`day-${day}`} className="flex min-w-0 flex-col gap-2">
      <Heading
        id={`day-${day}`}
        className={cn(
          'flex items-baseline gap-2 font-bold text-text',
          compact ? 'text-base' : 'text-lg',
          day === today && 'text-primary-text',
        )}
      >
        {formatDay(day, display.language)}
        {day === today && <span className="text-sm font-semibold">({t('timeline.today')})</span>}
      </Heading>
      {empty ? (
        <p className="text-sm text-muted">{t('timeline.nothing')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {content.sessions.map((session) => (
            <li key={session.id}>
              <SessionItem session={session} display={display} />
            </li>
          ))}
          {content.tasks.map((task) => (
            <li key={task.id}>
              <TaskItem
                task={task}
                now={now}
                display={display}
                onToggle={onToggle}
                onEdit={editor.edit}
                onDelete={editor.remove}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The month as a grid of days. Each day says how much is due; choosing one shows its details
 * below. Arrow keys move between days (left and right by a day, up and down by a week).
 */
function MonthGrid({
  weeks,
  month,
  selected,
  onSelect,
  contentOf,
  display,
  today,
  weekdays,
}: {
  weeks: string[][];
  month: string;
  selected: string;
  onSelect: (day: string) => void;
  contentOf: (day: string) => DayContent;
  display: DisplaySettings;
  today: string;
  weekdays: string[];
}) {
  const { t } = useTranslation();
  const grid = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);
  const days = weeks.flat();
  // After an arrow key, keep focus on the chosen day, even when the grid redraws for a new month.
  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${selected}"]`)?.focus();
  }, [selected, weeks]);
  const move = (event: KeyboardEvent, day: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const rtl = document.documentElement.dir === 'rtl';
    const target = addDays(day, rtl && Math.abs(step) === 1 ? -step : step);
    if (!days.includes(target)) return;
    focusAfterMove.current = true;
    onSelect(target);
  };

  return (
    <div ref={grid} className="flex flex-col gap-1">
      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-muted"
      >
        {weekdays.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 gap-1">
          {week.map((day) => {
            const { tasks, sessions } = contentOf(day);
            const open = tasks.filter((task) => task.completedAt === null).length;
            const cancelled = sessions.some((session) => session.status !== 'scheduled');
            const outside = !day.startsWith(month);
            const label = [
              formatDay(day, display.language),
              t('timeline.dueCount', { count: open }),
              cancelled ? t('timeline.classChanges') : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={day}
                type="button"
                data-day={day}
                aria-pressed={day === selected}
                tabIndex={day === selected ? 0 : -1}
                onClick={() => onSelect(day)}
                onKeyDown={(event) => move(event, day)}
                className={cn(
                  'flex min-h-14 flex-col items-center gap-1 rounded-md border-default p-1 text-sm sm:min-h-20 sm:items-start sm:p-2',
                  day === selected
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface hover:bg-surface-sunken',
                  outside && 'text-muted',
                )}
              >
                {/* The name is the content itself, so it includes the visible day number. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'font-semibold tabular-nums',
                    day === today && 'rounded-full bg-primary px-1.5 text-primary-fg',
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                <span className="sr-only">{label}</span>
                {open > 0 && (
                  <span
                    aria-hidden="true"
                    className="rounded-full bg-danger-soft px-1.5 text-xs font-bold text-danger-text"
                  >
                    {open}
                  </span>
                )}
                {cancelled && (
                  <span aria-hidden="true" className="text-xs font-semibold text-warning-text">
                    !
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Every deadline and class meeting over time, as a list, a week or a month, with filters.
 * The view and the day are in the address, so Back and shared links work.
 */
export function TimelinePage() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const now = useNow();
  const classes = useClasses();
  const editor = useTaskEditor();
  const toggle = useToggleDone();
  const [params, setParams] = useSearchParams();
  // On phones the filters fold away, so the calendar comes first.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { timeZone, weekStartsOn, timeFormat } = user.preferences;
  const today = todayKey(timeZone, now);
  const view: View = (VIEWS as readonly string[]).includes(params.get('view') ?? '')
    ? (params.get('view') as View)
    : 'list';
  const day = isDay(params.get('date')) ? (params.get('date') as string) : today;
  const classFilter = params.get('class') ?? '';
  const courseFilter = params.get('course') ?? '';
  const typeFilter = (params.get('type') ?? '') as TaskType | '';
  const showDone = params.get('done') === '1';
  const display: DisplaySettings = { language: i18n.language, timeZone, timeFormat };

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const week = weekRange(day, weekStartsOn);
  const month = monthGrid(day, weekStartsOn);
  const range =
    view === 'week'
      ? { from: week.from, to: week.to }
      : view === 'month'
        ? { from: month.from, to: month.to }
        : { from: day, to: addDays(day, LIST_DAYS - 1) };
  const agenda = useAgenda(range.from, range.to);

  const matches = (item: { classId: string | null; courseId: string | null }) =>
    (!classFilter || item.classId === classFilter) &&
    (!courseFilter || item.courseId === courseFilter);
  const tasks = (agenda.data?.tasks ?? []).filter(
    (task) =>
      matches(task) &&
      (!typeFilter || task.type === typeFilter) &&
      (showDone || task.completedAt === null),
  );
  const sessions = (agenda.data?.sessions ?? []).filter(
    (session) => !typeFilter && matches({ classId: session.classId, courseId: session.course.id }),
  );
  const contentOf = (key: string): DayContent => ({
    tasks: tasks.filter((task) => dayKeyOf(task.dueAt, timeZone) === key),
    sessions: sessions.filter((session) => session.day === key),
  });
  const courses = [
    ...new Map(
      [
        ...(agenda.data?.tasks ?? []).flatMap((task) => (task.course ? [task.course] : [])),
        ...(agenda.data?.sessions ?? []).map((session) => session.course),
      ].map((course) => [course.id, course]),
    ).values(),
  ].sort((a, b) => a.code.localeCompare(b.code));

  const step = view === 'week' ? 7 : view === 'month' ? 0 : LIST_DAYS;
  const shift = (direction: 1 | -1) => {
    if (view === 'month') {
      const [year, monthIndex] = day.split('-').map(Number) as [number, number];
      const target = new Date(Date.UTC(year, monthIndex - 1 + direction, 1));
      set({ date: target.toISOString().slice(0, 10) });
    } else {
      set({ date: addDays(day, direction * step) });
    }
  };
  const label =
    view === 'month'
      ? formatDay(`${month.month}-01`, i18n.language, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? t('timeline.weekOf', {
            from: formatDay(week.from, i18n.language, { day: 'numeric', month: 'short' }),
            to: formatDay(week.to, i18n.language, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          })
        : t('timeline.listFrom', { from: formatDay(day, i18n.language) });
  const weekdays = week.days.map((key) => formatDay(key, i18n.language, { weekday: 'short' }));
  const listDays = Array.from({ length: LIST_DAYS }, (_, index) => addDays(day, index)).filter(
    (key) => {
      const content = contentOf(key);
      return content.tasks.length > 0 || content.sessions.length > 0;
    },
  );
  const filtered = Boolean(classFilter || courseFilter || typeFilter);
  const activeFilters = [classFilter, courseFilter, typeFilter, showDone ? '1' : ''].filter(
    Boolean,
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display font-bold tracking-tight text-text">{t('timeline.title')}</h1>
          <p className="text-muted">{t('timeline.intro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/workload" className={buttonVariants({ variant: 'ghost' })}>
            <Flame aria-hidden="true" />
            {t('workload.open')}
          </Link>
          <Button
            variant="secondary"
            onClick={() =>
              editor.add(
                view === 'list' && day === today
                  ? null
                  : zonedDateTime(day, '23:59', timeZone).toISOString(),
              )
            }
          >
            <Plus aria-hidden="true" />
            {t('agenda.addTask')}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border-default border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-4">
          <SegmentedControl
            legend={t('timeline.view')}
            value={view}
            onValueChange={(value) => set({ view: value === 'list' ? null : value })}
            options={VIEWS.map((item) => ({ value: item, label: t(`timeline.views.${item}`) }))}
          />
          <div className="flex items-center gap-1">
            <IconButton
              label={t(`timeline.previous.${view}`)}
              icon={<ChevronLeft className="rtl:rotate-180" />}
              variant="secondary"
              onClick={() => shift(-1)}
            />
            <Button variant="secondary" onClick={() => set({ date: null })}>
              {t('timeline.today')}
            </Button>
            <IconButton
              label={t(`timeline.next.${view}`)}
              icon={<ChevronRight className="rtl:rotate-180" />}
              variant="secondary"
              onClick={() => shift(1)}
            />
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="self-start md:hidden"
          aria-expanded={filtersOpen}
          aria-controls="timeline-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" />
          {activeFilters > 0
            ? t('timeline.filtersCount', { count: activeFilters })
            : t('timeline.filtersButton')}
        </Button>
        <div
          id="timeline-filters"
          className={cn('flex-wrap items-end gap-4 md:flex', filtersOpen ? 'flex' : 'hidden')}
        >
          <Field id="timeline-class" label={t('timeline.filters.class')} className="min-w-44">
            <Select value={classFilter} onChange={(event) => set({ class: event.target.value })}>
              <option value="">{t('timeline.filters.allClasses')}</option>
              {(classes.data ?? []).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="timeline-course" label={t('timeline.filters.course')} className="min-w-44">
            <Select value={courseFilter} onChange={(event) => set({ course: event.target.value })}>
              <option value="">{t('timeline.filters.allCourses')}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="timeline-type" label={t('timeline.filters.type')} className="min-w-40">
            <Select value={typeFilter} onChange={(event) => set({ type: event.target.value })}>
              <option value="">{t('timeline.filters.allTypes')}</option>
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`announcements.taskTypes.${type}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Switch
            label={t('timeline.filters.showDone')}
            checked={showDone}
            onCheckedChange={(checked) => set({ done: checked ? '1' : null })}
            className="pb-2"
          />
        </div>
      </div>

      <h2 aria-live="polite" className="text-xl font-bold text-text">
        {label}
      </h2>

      {agenda.isPending && (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
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

      {agenda.data &&
        view === 'list' &&
        (listDays.length === 0 ? (
          <EmptyState
            title={filtered ? t('timeline.emptyFilteredTitle') : t('timeline.emptyTitle')}
            headingLevel={3}
            className="rounded-xl border-default border-dashed border-border-strong"
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => set({ class: null, course: null, type: null })}
                >
                  {t('timeline.clearFilters')}
                </Button>
              ) : undefined
            }
          >
            {filtered ? t('timeline.emptyFilteredBody') : t('timeline.emptyBody')}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            {listDays.map((key) => (
              <DayBlock
                key={key}
                day={key}
                content={contentOf(key)}
                display={display}
                now={now}
                today={today}
                headingLevel="h3"
                onToggle={toggle}
                editor={editor}
              />
            ))}
          </div>
        ))}

      {agenda.data && view === 'week' && (
        <div className="grid gap-6 md:grid-cols-2">
          {week.days.map((key) => (
            <DayBlock
              key={key}
              day={key}
              content={contentOf(key)}
              display={display}
              now={now}
              today={today}
              headingLevel="h3"
              onToggle={toggle}
              editor={editor}
              compact
            />
          ))}
        </div>
      )}

      {agenda.data && view === 'month' && (
        <div className="flex flex-col gap-6">
          <MonthGrid
            weeks={month.weeks}
            month={month.month}
            selected={day}
            onSelect={(key) => set({ date: key })}
            contentOf={contentOf}
            display={display}
            today={today}
            weekdays={weekdays}
          />
          <DayBlock
            day={day}
            content={contentOf(day)}
            display={display}
            now={now}
            today={today}
            headingLevel="h3"
            onToggle={toggle}
            editor={editor}
          />
        </div>
      )}
      {editor.node}
    </div>
  );
}
