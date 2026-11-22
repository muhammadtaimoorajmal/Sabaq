import { CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../auth/AuthProvider';
import { EmptyState } from '../components/ui';

/** The part of the day in the person's own time zone. */
export function partOfDay(now: Date, timeZone: string): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now),
  );
  if (hour < 12) return 'morning';
  return hour < 17 ? 'afternoon' : 'evening';
}

/** The home page. Deadlines and announcements fill it once classes exist. */
export function TodayPage({ now = new Date() }: { now?: Date }) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const { timeZone } = user.preferences;
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeZone }).format(now);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-muted">{date}</p>
        <h1 className="text-display font-bold tracking-tight text-text">
          {t(`today.${partOfDay(now, timeZone)}`, { name: firstName })}
        </h1>
      </header>
      <EmptyState
        icon={<CalendarCheck />}
        title={t('today.emptyTitle')}
        className="rounded-xl border-default border-dashed border-border-strong"
      >
        {t('today.emptyBody')}
      </EmptyState>
    </div>
  );
}
