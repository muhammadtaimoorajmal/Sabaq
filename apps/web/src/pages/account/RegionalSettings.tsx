import { TIME_FORMATS } from '@sabaq/shared';
import { useTranslation } from 'react-i18next';
import { Button, Field, SegmentedControl, Select } from '../../components/ui';
import { usePreferences } from '../../preferences/PreferencesProvider';
import { browserTimeZone, formatTime, timeZones } from '../classes/helpers';

const WEEK_STARTS = ['1', '6', '0'] as const;

/** Time format, first day of the week and time zone; each change applies at once. */
export function RegionalSettings({ id = 'regional' }: { id?: string }) {
  const { t, i18n } = useTranslation();
  const { preferences, update } = usePreferences();
  const device = browserTimeZone();
  const days = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', timeZone: 'UTC' });
  // 4 January 2026 was a Sunday, so adding the day number gives that weekday.
  const dayName = (day: number) => days.format(new Date(Date.UTC(2026, 0, 4 + day)));

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        legend={t('account.regional.timeFormat')}
        value={preferences.timeFormat}
        onValueChange={(timeFormat) => update({ timeFormat })}
        options={TIME_FORMATS.map((format) => ({
          value: format,
          label: formatTime('14:30', i18n.language, format),
        }))}
      />
      <SegmentedControl
        legend={t('account.regional.weekStartsOn')}
        value={String(preferences.weekStartsOn) as (typeof WEEK_STARTS)[number]}
        onValueChange={(day) => update({ weekStartsOn: Number(day) as 0 | 1 | 6 })}
        options={WEEK_STARTS.map((day) => ({ value: day, label: dayName(Number(day)) }))}
      />
      <div className="flex flex-col gap-3">
        <Field
          id={`${id}-time-zone`}
          label={t('account.regional.timeZone')}
          hint={t('account.regional.timeZoneHint')}
        >
          <Select
            value={preferences.timeZone}
            onChange={(event) => update({ timeZone: event.target.value })}
          >
            {timeZones(preferences.timeZone, device).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        {preferences.timeZone !== device && (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => update({ timeZone: device })}
          >
            {t('account.regional.useDevice', { zone: device.replaceAll('_', ' ') })}
          </Button>
        )}
      </div>
    </div>
  );
}
