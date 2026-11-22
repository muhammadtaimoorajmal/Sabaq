import { addDays, dayKeyOf, zonedDateTime } from '@sabaq/shared';
import { AlertCircle } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Button } from './Button';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const inputClasses =
  'h-control rounded-md border-default border-border-strong bg-surface px-3 text-base text-text aria-invalid:border-danger aria-invalid:[border-width:2px]';

/** Splits an instant into the class's calendar day and wall-clock time. */
function partsOf(value: string | null, timeZone: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' };
  const instant = new Date(value);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return { date: dayKeyOf(instant, timeZone), time };
}

export interface DateTimeFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** The chosen instant as an ISO string, or `null` when nothing is chosen yet. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The class's time zone: the date and time are read and written there. */
  timeZone: string;
  /** Time used when a quick choice sets only the day. */
  defaultTime?: string;
  now?: Date;
  required?: boolean;
  className?: string;
}

/**
 * A date and time in the class's time zone. Native inputs give each platform its best picker
 * (and work with screen readers and keyboards); quick choices cover the common cases, and the
 * chosen moment is confirmed in words, so nobody has to decode a date format.
 */
export function DateTimeField({
  label,
  hint,
  error,
  value,
  onChange,
  timeZone,
  defaultTime = '23:59',
  now = new Date(),
  required = false,
  className,
}: DateTimeFieldProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(() => partsOf(value, timeZone));
  const today = dayKeyOf(now, timeZone);

  const commit = (next: { date: string; time: string }) => {
    setDraft(next);
    onChange(
      next.date && TIME.test(next.time)
        ? zonedDateTime(next.date, next.time, timeZone).toISOString()
        : null,
    );
  };
  const pick = (days: number) =>
    commit({ date: addDays(today, days), time: draft.time || defaultTime });

  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : '', `${id}-confirmation`]
    .filter(Boolean)
    .join(' ');
  const confirmation = value
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone,
      }).format(new Date(value))
    : null;

  return (
    <fieldset className={cn('flex flex-col gap-2', className)} aria-describedby={describedBy}>
      <legend className="mb-1.5 font-semibold text-text">{label}</legend>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-sm font-semibold text-danger-text"
        >
          <AlertCircle aria-hidden="true" className="mt-[0.2em] size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => pick(0)}>
          {t('dateField.today')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => pick(1)}>
          {t('dateField.tomorrow')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => pick(7)}>
          {t('dateField.nextWeek')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-date`} className="text-sm font-medium text-muted">
            {t('dateField.date')}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            className={inputClasses}
            value={draft.date}
            required={required}
            aria-invalid={error ? true : undefined}
            onChange={(event) =>
              commit({ ...draft, date: event.target.value, time: draft.time || defaultTime })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-time`} className="text-sm font-medium text-muted">
            {t('dateField.time')}
          </label>
          <input
            id={`${id}-time`}
            type="time"
            className={inputClasses}
            value={draft.time}
            required={required}
            aria-invalid={error ? true : undefined}
            onChange={(event) => commit({ ...draft, time: event.target.value })}
          />
        </div>
      </div>
      <p id={`${id}-confirmation`} aria-live="polite" className="text-sm text-muted">
        {confirmation
          ? t('dateField.selected', { when: confirmation })
          : t('dateField.timeZone', { zone: timeZone })}
      </p>
    </fieldset>
  );
}
