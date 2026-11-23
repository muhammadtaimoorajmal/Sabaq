import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { passwordStrength } from './password-strength';

const BAR = ['bg-border', 'bg-danger', 'bg-warning-text', 'bg-primary', 'bg-success-text'];
const TEXT = [
  'text-muted',
  'text-danger-text',
  'text-warning-text',
  'text-primary-text',
  'text-success-text',
];
/** Screen readers hear the result after a pause in typing, not on every keystroke. */
export const ANNOUNCE_AFTER_MS = 800;

/**
 * Shows how strong a new password is, with one piece of advice. Purely guidance: any password
 * that meets the minimum length is accepted.
 */
export function PasswordStrengthMeter({
  password,
  personal = [],
  id,
}: {
  password: string;
  /** The person's name and e-mail address, which make weak passwords. */
  personal?: string[];
  id?: string;
}) {
  const { t } = useTranslation();
  const personalKey = personal.join('\u0000');
  const { score, hints } = useMemo(
    () => passwordStrength(password, personalKey ? personalKey.split('\u0000') : []),
    [password, personalKey],
  );
  const summary = t('auth.strength.label', { level: t(`auth.strength.level${score}`) });
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(password ? summary : ''), ANNOUNCE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [password, summary]);

  if (!password) return null;
  const hint = hints[0];
  return (
    <div id={id} className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn('h-1.5 rounded-full', step <= score ? BAR[score] : 'bg-surface-sunken')}
          />
        ))}
      </div>
      <p className={cn('text-sm font-semibold', TEXT[score])}>{summary}</p>
      {hint && <p className="text-sm text-muted">{t(`auth.strength.${hint}`)}</p>}
      <span aria-live="polite" className="sr-only">
        {announced}
      </span>
    </div>
  );
}
