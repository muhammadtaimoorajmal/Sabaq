import {
  addDays,
  dayKeyOf,
  type DailyLoad,
  LOAD_LEVELS,
  type LoadLevel,
  type WorkloadItem,
} from '@sabaq/shared';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useWorkload, type WorkloadScope } from '../../api/workload';
import { useCurrentUser } from '../../auth/AuthProvider';
import { Alert, Card, CourseTag, SegmentedControl, Skeleton } from '../../components/ui';
import { formatDay, startOfWeek, todayKey, useNow } from '../../lib/calendar';
import { cn } from '../../lib/cn';
import { clockTime } from '../agenda/AgendaItems';

/** Each level has its own colour and its own number of dots, so colour is never needed. */
export const LEVEL_STYLE: Record<LoadLevel, string> = {
  none: 'border-border bg-surface text-text',
  light: 'border-success/40 bg-success-soft text-success-text',
  moderate: 'border-warning/50 bg-warning-soft text-warning-text',
  heavy: 'border-danger/50 bg-danger-soft text-danger-text',
  extreme: 'border-danger bg-danger text-danger-fg',
};
const LEVEL_DOTS: Record<LoadLevel, number> = {
  none: 0,
  light: 1,
  moderate: 2,
  heavy: 3,
  extreme: 4,
};
const HEAVY: readonly LoadLevel[] = ['heavy', 'extreme'];

export function LevelDots({ level, className }: { level: LoadLevel; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex min-h-1.5 gap-0.5', className)}>
      {Array.from({ length: LEVEL_DOTS[level] }, (_, index) => (
        <span key={index} className="size-1.5 rounded-full bg-current" />
      ))}
    </span>
  );
}

const weeksOf = (days: DailyLoad[]) => {
  const weeks: DailyLoad[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
};

/**
 * How heavy each day is, as a calendar of days (with dots as well as colour) or as a table, with
 * a summary in words. Arrow keys move between days; choosing a day lists what is due.
 */
export function WorkloadView({
  scope,
  timeZone,
  headingLevel = 2,
}: {
  scope: WorkloadScope;
  timeZone: string;
  /** Keeps the page outline intact where the view is embedded. */
  headingLevel?: 2 | 3;
}) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const now = useNow();
  const today = todayKey(timeZone, now);
  const [params, setParams] = useSearchParams();
  const range = params.get('range') === 'term' ? 'term' : 'weeks';
  const display = params.get('show') === 'table' ? 'table' : 'calendar';
  const from = startOfWeek(today, user.preferences.weekStartsOn);
  const to = addDays(from, (range === 'term' ? 16 : 4) * 7 - 1);
  const workload = useWorkload(scope, from, to);
  const [selected, setSelected] = useState(today);
  const grid = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);
  const Heading = `h${headingLevel}` as const;
  const SubHeading = `h${headingLevel + 1}` as 'h3' | 'h4';
  const lang = i18n.language;

  useEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${selected}"]`)?.focus();
  }, [selected]);

  const update = (key: string, value: string, fallback: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const controls = (
    <div className="flex flex-wrap items-end gap-4">
      <SegmentedControl
        legend={t('workload.range')}
        value={range}
        onValueChange={(value) => update('range', value, 'weeks')}
        options={(['weeks', 'term'] as const).map((value) => ({
          value,
          label: t(`workload.ranges.${value}`),
        }))}
      />
      <SegmentedControl
        legend={t('workload.display')}
        value={display}
        onValueChange={(value) => update('show', value, 'calendar')}
        options={(['calendar', 'table'] as const).map((value) => ({
          value,
          label: t(`workload.displays.${value}`),
        }))}
      />
    </div>
  );

  if (!workload.data) {
    return (
      <div className="flex flex-col gap-4">
        {controls}
        {workload.isError ? (
          <Alert tone="danger" title={t('workload.loadFailed')} />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </div>
    );
  }

  const { days, items } = workload.data;
  const dayOf = (item: WorkloadItem) => dayKeyOf(item.dueAt, timeZone);
  const itemsOn = (day: string) => items.filter((item) => dayOf(item) === day);
  const loadOf = new Map(days.map((day) => [day.date, day]));
  const weeks = weeksOf(days);
  const upcoming = days.filter((day) => day.date >= today);
  const heavyDays = upcoming.filter((day) => HEAVY.includes(day.level)).length;
  const busiest = weeks
    .map((week) => ({
      week,
      load: week.reduce((total, day) => total + day.load, 0),
      count: week.reduce((total, day) => total + day.taskCount, 0),
    }))
    .sort((a, b) => b.load - a.load)[0];
  const shortDay = (day: string) => formatDay(day, lang, { day: 'numeric', month: 'short' });
  const weekdays = (weeks[0] ?? []).map((day) => formatDay(day.date, lang, { weekday: 'short' }));
  const levelOf = (day: string) => loadOf.get(day)?.level ?? 'none';

  const move = (event: KeyboardEvent, day: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const rtl = document.documentElement.dir === 'rtl';
    const target = addDays(day, rtl && Math.abs(step) === 1 ? -step : step);
    if (!loadOf.has(target)) return;
    focusAfterMove.current = true;
    setSelected(target);
  };

  const selectedItems = itemsOn(selected);

  return (
    <div className="flex flex-col gap-5">
      {controls}

      <Card className="flex flex-col gap-1" aria-live="polite">
        <Heading className="text-lg font-bold text-text">
          {heavyDays > 0
            ? t('workload.heavyDays', { count: heavyDays })
            : t('workload.noHeavyDays')}
        </Heading>
        {busiest && busiest.count > 0 ? (
          <p className="text-muted">
            {t('workload.busiestWeek', {
              count: busiest.count,
              week: `${shortDay(busiest.week[0]?.date ?? from)} – ${shortDay(
                busiest.week.at(-1)?.date ?? to,
              )}`,
            })}
          </p>
        ) : (
          <p className="text-muted">{t('workload.nothingDue')}</p>
        )}
      </Card>

      {display === 'calendar' ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div ref={grid} className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              aria-hidden="true"
              className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-muted"
            >
              {weekdays.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]?.date} className="grid grid-cols-7 gap-1">
                {week.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    data-day={day.date}
                    aria-pressed={day.date === selected}
                    tabIndex={day.date === selected ? 0 : -1}
                    onClick={() => setSelected(day.date)}
                    onKeyDown={(event) => move(event, day.date)}
                    className={cn(
                      'flex min-h-12 flex-col items-center justify-between gap-1 rounded-md border-default p-1 text-sm sm:min-h-14',
                      LEVEL_STYLE[day.level],
                      day.date === selected && 'ring-2 ring-focus ring-offset-2 ring-offset-canvas',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'font-semibold tabular-nums',
                        day.date === today && 'underline decoration-2 underline-offset-4',
                      )}
                    >
                      {day.date.endsWith('-01') ? shortDay(day.date) : Number(day.date.slice(8))}
                    </span>
                    <span className="sr-only">
                      {t('workload.dayLabel', {
                        day: formatDay(day.date, lang),
                        level: t(`workload.levelWords.${day.level}`),
                        count: day.taskCount,
                      })}
                    </span>
                    <LevelDots level={day.level} />
                  </button>
                ))}
              </div>
            ))}
            <Legend />
          </div>

          <section
            aria-labelledby="workload-day"
            className="flex flex-col gap-3 rounded-xl border-default border-border bg-surface p-4 lg:w-80"
          >
            <SubHeading id="workload-day" className="font-bold text-text">
              {t('workload.dayTitle', {
                day: formatDay(selected, lang),
                level: t(`workload.levels.${levelOf(selected)}`),
              })}
            </SubHeading>
            {selectedItems.length === 0 ? (
              <p className="text-muted">{t('workload.dayEmpty')}</p>
            ) : (
              <ItemList
                items={selectedItems}
                timeZone={timeZone}
                showClass={scope.kind === 'mine'}
              />
            )}
          </section>
        </div>
      ) : (
        <WorkloadTable
          days={days.filter((day) => day.taskCount > 0)}
          itemsOn={itemsOn}
          timeZone={timeZone}
        />
      )}

      <p className="text-sm text-muted">{t('workload.effortNote')}</p>
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-sm text-muted">{t('workload.legend')}</p>
      <ul className="flex flex-wrap gap-2">
        {LOAD_LEVELS.map((level) => (
          <li
            key={level}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border-default px-3 py-1 text-sm font-semibold',
              LEVEL_STYLE[level],
            )}
          >
            <LevelDots level={level} />
            {t(`workload.levels.${level}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemList({
  items,
  timeZone,
  showClass,
}: {
  items: WorkloadItem[];
  timeZone: string;
  showClass: boolean;
}) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const display = { language: i18n.language, timeZone, timeFormat: user.preferences.timeFormat };
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1">
          <Link
            to={`/tasks/${item.id}`}
            className="font-semibold text-primary-text underline underline-offset-2 hover:no-underline [overflow-wrap:anywhere]"
          >
            {item.title}
          </Link>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {item.course && <CourseTag code={item.course.code} color={item.course.color} />}
            <span>{t(`announcements.taskTypes.${item.type}`)}</span>
            <span className="tabular-nums">{clockTime(item.dueAt, display)}</span>
            {showClass && <span>{item.className ?? t('agenda.personal')}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The same information as the calendar, as a table: nothing depends on colour or position. */
function WorkloadTable({
  days,
  itemsOn,
  timeZone,
}: {
  days: DailyLoad[];
  itemsOn: (day: string) => WorkloadItem[];
  timeZone: string;
}) {
  const { t, i18n } = useTranslation();
  if (days.length === 0) return <p className="text-muted">{t('workload.nothingDue')}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border-default border-border bg-surface">
      <table className="w-full text-start">
        <caption className="p-3 text-start text-sm text-muted">
          {t('workload.table.caption')}
        </caption>
        <thead>
          <tr className="border-b border-border text-sm text-muted">
            <th scope="col" className="p-3 text-start font-semibold">
              {t('workload.table.day')}
            </th>
            <th scope="col" className="p-3 text-start font-semibold">
              {t('workload.table.level')}
            </th>
            <th scope="col" className="p-3 text-start font-semibold">
              {t('workload.table.tasks')}
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date} className="border-b border-border align-top last:border-b-0">
              <th scope="row" className="p-3 text-start font-semibold text-text">
                {formatDay(day.date, i18n.language)}
              </th>
              <td className="p-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border-default px-2.5 py-0.5 text-sm font-semibold',
                    LEVEL_STYLE[day.level],
                  )}
                >
                  <LevelDots level={day.level} />
                  {t(`workload.levels.${day.level}`)}
                </span>
              </td>
              <td className="p-3">
                <ItemList items={itemsOn(day.date)} timeZone={timeZone} showClass={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
