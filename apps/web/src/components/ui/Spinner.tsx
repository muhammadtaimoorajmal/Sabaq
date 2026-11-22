import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

/**
 * A loading indicator. Standalone spinners announce "Loading…" to screen readers; decorative
 * ones (inside a button that already says what is happening) are hidden from them.
 */
export function Spinner({
  decorative = false,
  label,
  className,
}: {
  decorative?: boolean;
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const icon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn(
        'size-5 animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]',
        className,
      )}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (decorative) return icon;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {icon}
      <span className="sr-only">{label ?? t('common.loading')}</span>
    </span>
  );
}
