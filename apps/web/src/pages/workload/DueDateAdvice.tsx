import { addDays, assessDueDate, dayKeyOf, type TaskType, zonedDateTime } from '@sabaq/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkload } from '../../api/workload';
import { Alert, Button } from '../../components/ui';
import { formatDay } from '../../lib/calendar';
import { cn } from '../../lib/cn';
import { LEVEL_STYLE, LevelDots } from './WorkloadView';

const WINDOW_DAYS = 3;

/** The clock time of an instant in a time zone, as "HH:mm". */
const timeOfDay = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));

/**
 * While a due date is chosen: how busy the class already is that day, across all its courses,
 * and lighter days nearby when it would become heavy. Advice only; it never blocks posting.
 */
export function DueDateAdvice({
  classId,
  timeZone,
  dueAt,
  type,
  ignoreTaskId,
  onPick,
}: {
  classId: string;
  /** The class's time zone, in which days are counted. */
  timeZone: string;
  dueAt: string;
  type: TaskType;
  /** The task being edited, so it is not counted twice. */
  ignoreTaskId?: string | null;
  onPick: (dueAt: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const day = dayKeyOf(dueAt, timeZone);
  const from = addDays(day, -WINDOW_DAYS);
  const workload = useWorkload({ kind: 'class', classId }, from, addDays(day, WINDOW_DAYS));
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const lang = i18n.language;

  // Without a connection the advice is simply left out: it is never required.
  if (workload.isError || workload.failureCount > 0) return null;

  let content;
  if (!workload.data || workload.isPlaceholderData) {
    content = <p className="text-sm text-muted">{t('workload.advice.loading')}</p>;
  } else {
    const items = workload.data.items.filter((item) => item.id !== ignoreTaskId);
    const assessment = assessDueDate(
      items,
      { dueAt, type },
      { timeZone, now: new Date(), ignoreTaskId: ignoreTaskId ?? undefined },
    );
    const others = items.filter((item) => dayKeyOf(item.dueAt, timeZone) === day);
    const titles = new Intl.ListFormat(lang, { type: 'conjunction' }).format(
      others.map((item) => (item.course ? `${item.course.code} ${item.title}` : item.title)),
    );
    const body = (
      <>
        <p>
          {t('workload.advice.existing', { count: others.length, titles })}{' '}
          {t('workload.advice.projected', {
            level: t(`workload.levelWords.${assessment.projectedLevel}`),
          })}
        </p>
        {assessment.isClash && (
          <div className="mt-2 flex flex-col gap-2">
            {assessment.suggestions.length > 0 ? (
              <>
                <p className="font-semibold">{t('workload.advice.suggest')}</p>
                <div className="flex flex-wrap gap-2">
                  {assessment.suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.date}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMovedTo(suggestion.date);
                        onPick(
                          zonedDateTime(
                            suggestion.date,
                            timeOfDay(dueAt, timeZone),
                            timeZone,
                          ).toISOString(),
                        );
                      }}
                    >
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border-default px-1.5 py-1',
                          LEVEL_STYLE[suggestion.level],
                        )}
                      >
                        <LevelDots level={suggestion.level} />
                      </span>
                      {t('workload.advice.pick', {
                        day: formatDay(suggestion.date, lang),
                        level: t(`workload.levelWords.${suggestion.level}`),
                      })}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p>{t('workload.advice.noSuggestions')}</p>
            )}
            <p className="text-sm text-muted">{t('workload.advice.advisory')}</p>
          </div>
        )}
      </>
    );
    content = assessment.isClash ? (
      <Alert tone="warning" title={t('workload.advice.clashTitle', { day: formatDay(day, lang) })}>
        {body}
      </Alert>
    ) : (
      <div className="flex flex-col gap-1 rounded-lg border-default border-border bg-surface-sunken p-3 text-sm text-text">
        <p className="flex items-center gap-2 font-semibold">
          <span
            className={cn(
              'inline-flex min-h-5 items-center rounded-full border-default px-1.5',
              LEVEL_STYLE[assessment.projectedLevel],
            )}
          >
            <LevelDots level={assessment.projectedLevel} />
          </span>
          {t('workload.advice.title', { day: formatDay(day, lang) })}
        </p>
        {body}
      </div>
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {content}
      {movedTo === day && (
        <p className="text-sm font-semibold text-success-text">
          {t('workload.advice.moved', { day: formatDay(day, lang) })}
        </p>
      )}
    </div>
  );
}
