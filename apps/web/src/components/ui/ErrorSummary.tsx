import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface FormError {
  /** The id of the field to jump to. */
  field: string;
  message: string;
}

/**
 * Lists every problem at the top of a form after a failed submit. It receives focus, so
 * keyboard and screen-reader users learn about all problems at once, and each entry moves
 * focus to the field that needs fixing.
 */
export function ErrorSummary({ errors, title }: { errors: FormError[]; title?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const signature = errors.map((error) => `${error.field}:${error.message}`).join('|');

  useEffect(() => {
    if (signature) ref.current?.focus();
  }, [signature]);

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
