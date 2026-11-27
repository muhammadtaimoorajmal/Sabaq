import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../../auth/AuthProvider';
import { WorkloadView } from './WorkloadView';

/** The person's own workload across all their classes, with their personal tasks. */
export function WorkloadPage() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-display font-bold tracking-tight text-text">{t('workload.title')}</h1>
        <p className="text-muted">{t('workload.intro')}</p>
      </header>
      <WorkloadView scope={{ kind: 'mine' }} timeZone={user.preferences.timeZone} />
    </div>
  );
}
