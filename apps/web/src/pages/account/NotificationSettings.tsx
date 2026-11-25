import { DIGEST_FREQUENCIES, timeOfDaySchema } from '@sabaq/shared';
import { useTranslation } from 'react-i18next';
import { Field, Input, RadioGroup, Switch } from '../../components/ui';
import { usePreferences } from '../../preferences/PreferencesProvider';
import { formatTime } from '../classes/helpers';

/** E-mail updates, how often they arrive and quiet hours; each change applies at once. */
export function NotificationSettings() {
  const { t, i18n } = useTranslation();
  const { preferences, update } = usePreferences();
  const { notifications } = preferences;
  const { quietHours } = notifications;
  const time = (value: string) => formatTime(value, i18n.language, preferences.timeFormat);
  const setTime = (field: 'start' | 'end', value: string) => {
    if (timeOfDaySchema.safeParse(value).success) {
      update({ notifications: { quietHours: { [field]: value } } });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Switch
        label={t('account.notifications.email')}
        description={t('account.notifications.emailHint')}
        checked={notifications.email}
        onCheckedChange={(email) => update({ notifications: { email } })}
      />
      <RadioGroup
        legend={t('account.notifications.digest')}
        value={notifications.digest}
        onValueChange={(digest) => update({ notifications: { digest } })}
        options={DIGEST_FREQUENCIES.map((digest) => ({
          value: digest,
          label: t(`account.notifications.${digest}`),
        }))}
      />
      <div className="flex flex-col gap-4">
        <Switch
          label={t('account.notifications.quietHours')}
          description={t('account.notifications.quietHoursHint')}
          checked={quietHours.enabled}
          onCheckedChange={(enabled) => update({ notifications: { quietHours: { enabled } } })}
        />
        {quietHours.enabled && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4">
              <Field id="quiet-start" label={t('account.notifications.from')} className="w-40">
                <Input
                  type="time"
                  dir="ltr"
                  defaultValue={quietHours.start}
                  onChange={(event) => setTime('start', event.target.value)}
                />
              </Field>
              <Field id="quiet-end" label={t('account.notifications.until')} className="w-40">
                <Input
                  type="time"
                  dir="ltr"
                  defaultValue={quietHours.end}
                  onChange={(event) => setTime('end', event.target.value)}
                />
              </Field>
            </div>
            <p aria-live="polite" className="text-sm text-muted">
              {t('account.notifications.summary', {
                start: time(quietHours.start),
                end: time(quietHours.end),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
