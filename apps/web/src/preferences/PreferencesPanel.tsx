import {
  LANGUAGES,
  MOTION_PREFERENCES,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  THEMES,
} from '@sabaq/shared';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton, SegmentedControl, Slider } from '../components/ui';
import { usePreferences } from './PreferencesProvider';

const STEP = 0.125;

/**
 * Display settings that take effect instantly: theme, text size, spacing, language and motion.
 * Shared by the design system page, onboarding and account settings.
 */
export function PreferencesPanel() {
  const { t } = useTranslation();
  const { preferences, update } = usePreferences();
  const percent = Math.round(preferences.textScale * 100);
  const setScale = (value: number) =>
    update({
      textScale: Math.min(
        TEXT_SCALE_MAX,
        Math.max(TEXT_SCALE_MIN, Math.round(value / STEP) * STEP),
      ),
    });

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        legend={t('preferences.theme.label')}
        value={preferences.theme}
        onValueChange={(theme) => update({ theme })}
        options={THEMES.map((theme) => ({ value: theme, label: t(`preferences.theme.${theme}`) }))}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span id="text-size-label" className="font-semibold text-text">
            {t('preferences.textSize.label')}
          </span>
          <output aria-live="polite" className="font-semibold text-muted tabular-nums">
            {t('preferences.textSize.value', { percent })}
          </output>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            label={t('preferences.textSize.smaller')}
            icon={<Minus />}
            variant="secondary"
            size="sm"
            disabled={preferences.textScale <= TEXT_SCALE_MIN}
            onClick={() => setScale(preferences.textScale - STEP)}
          />
          <Slider
            label={t('preferences.textSize.label')}
            value={preferences.textScale}
            min={TEXT_SCALE_MIN}
            max={TEXT_SCALE_MAX}
            step={STEP}
            valueText={t('preferences.textSize.value', { percent })}
            onValueChange={setScale}
          />
          <IconButton
            label={t('preferences.textSize.larger')}
            icon={<Plus />}
            variant="secondary"
            size="sm"
            disabled={preferences.textScale >= TEXT_SCALE_MAX}
            onClick={() => setScale(preferences.textScale + STEP)}
          />
          <IconButton
            label={t('preferences.textSize.reset')}
            icon={<RotateCcw />}
            size="sm"
            disabled={preferences.textScale === 1}
            onClick={() => setScale(1)}
          />
        </div>
      </div>

      <SegmentedControl
        legend={t('preferences.density.label')}
        value={preferences.density}
        onValueChange={(density) => update({ density })}
        options={[
          { value: 'comfortable', label: t('preferences.density.comfortable') },
          { value: 'compact', label: t('preferences.density.compact') },
        ]}
      />

      <SegmentedControl
        legend={t('preferences.language.label')}
        value={preferences.language}
        onValueChange={(language) => update({ language })}
        options={LANGUAGES.map((language) => ({
          value: language,
          label: <span lang={language}>{t(`preferences.language.${language}`)}</span>,
        }))}
      />

      <SegmentedControl
        legend={t('preferences.motion.label')}
        value={preferences.motion}
        onValueChange={(motion) => update({ motion })}
        options={MOTION_PREFERENCES.map((motion) => ({
          value: motion,
          label: t(`preferences.motion.${motion}`),
        }))}
      />
    </div>
  );
}
