import { CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClasses } from '../api/classes';
import { useCurrentUser } from '../auth/AuthProvider';
import { EmptyState } from '../components/ui';
import { ClassActions, ClassCard } from './classes/ClassesPage';

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

/** The home page. Deadlines and announcements fill it once classes exist. */
export function TodayPage({ now = new Date() }: { now?: Date }) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const classes = useClasses();
  const { timeZone } = user.preferences;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeZone }).format(now);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-semibold text-muted">{date}</p>
        <h1 className="text-display font-bold tracking-tight text-text">
          {t(`today.${partOfDay(now, timeZone)}`, { name: greetingName(user.name) })}
        </h1>
      </header>
      {classes.data && classes.data.length > 0 ? (
        <section aria-labelledby="today-classes" className="flex flex-col gap-3">
          <h2 id="today-classes" className="text-xl font-bold text-text">
            {t('classes.title')}
          </h2>
          <ul className="flex flex-col gap-3">
            {classes.data.map((cls) => (
              <ClassCard key={cls.id} cls={cls} />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={<CalendarCheck />}
          title={t('today.emptyTitle')}
          action={classes.data ? <ClassActions /> : undefined}
          className="rounded-xl border-default border-dashed border-border-strong"
        >
          {t('today.emptyBody')}
        </EmptyState>
      )}
    </div>
  );
}
