import { useTranslation } from 'react-i18next';
import { AnnouncementFeed } from './AnnouncementFeed';

/** Every announcement from every class in one place, newest first. */
export function InboxPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display font-bold tracking-tight text-text">
          {t('announcements.inboxTitle')}
        </h1>
        <p className="text-muted">{t('announcements.inboxIntro')}</p>
      </header>
      <AnnouncementFeed />
    </div>
  );
}
