import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface FormError {
  /** The id of the field to jump to. */
  field: string;
  message: string;
}

/**
 * Lists every problem at the top of a form after a failed submit. It receives focus once per
 * submit attempt, so keyboard and screen-reader users learn about all problems at once, and
 * each entry moves focus to the field that needs fixing. It never takes focus while someone is
 * correcting a field, even though its list updates as they type.
 */
export function ErrorSummary({
  errors,
  title,
  attempt = 0,
}: {
  errors: FormError[];
  title?: string;
  /** Increases with every submit attempt; each new attempt with problems moves focus here. */
  attempt?: number;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const visible = errors.length > 0;

  useEffect(() => {
    if (visible) ref.current?.focus();
    // Only a new attempt (or the summary appearing) moves focus, not edits to its contents.
  }, [attempt, visible]);

  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-lg border-2 border-danger bg-danger-soft p-4 focus-visible:outline-offset-4"
    >
      <h2
        id="error-summary-title"
        className="flex items-center gap-2 text-lg font-bold text-danger-text"
      >
        <AlertTriangle aria-hidden="true" className="size-5" />
        {title ?? t('form.errorSummaryTitle', { count: errors.length })}
      </h2>
      <ul className="mt-2 list-disc space-y-1 ps-6">
        {errors.map((error) => (
          <li key={error.field}>
            <a
              href={`#${error.field}`}
              className="font-semibold text-danger-text underline underline-offset-2 hover:no-underline"
              onClick={(event) => {
                const target = document.getElementById(error.field);
                if (!target) return;
                event.preventDefault();
                target.focus();
                target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
