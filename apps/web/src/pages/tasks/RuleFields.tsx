import { NAMING_TOKENS, type NamingToken, SUBMISSION_CHANNELS } from '@sabaq/shared';
import { Check, Plus } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Field, Input, RadioGroup, Select } from '../../components/ui';
import { cn } from '../../lib/cn';
import { COMMON_TYPES, previewName, type RuleDraft, type RuleField } from './rule-draft';

/**
 * The controls for a task's submission rules: a file-name pattern built from details with a
 * live example, accepted types, a size limit, where to submit and what happens to late work.
 * Used in the announcement composer and on the task page.
 */
export function RuleFields({
  draft,
  onChange,
  errorFor,
  idPrefix = 'rule',
}: {
  draft: RuleDraft;
  onChange: (change: Partial<RuleDraft>) => void;
  errorFor: (field: RuleField) => string | undefined;
  /** Keeps ids unique when the fields appear inside another form. */
  idPrefix?: string;
}) {
  const { t } = useTranslation();
  const patternRef = useRef<HTMLInputElement>(null);
  const typesLabel = useId();
  const id = (field: string) => `${idPrefix}-${field}`;
  const preview = draft.namingPattern.trim() && !errorFor('pattern') ? previewName(draft) : null;

  /** Inserts a detail where the cursor is, then puts the cursor after it. */
  const insert = (token: NamingToken) => {
    const input = patternRef.current;
    const text = `{${token}}`;
    const start = input?.selectionStart ?? draft.namingPattern.length;
    const end = input?.selectionEnd ?? start;
    const next = draft.namingPattern.slice(0, start) + text + draft.namingPattern.slice(end);
    onChange({ namingPattern: next });
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const toggleType = (type: string) =>
    onChange({
      types: draft.types.includes(type)
        ? draft.types.filter((item) => item !== type)
        : [...draft.types, type],
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Field
          id={id('pattern')}
          label={t('submission.editor.pattern')}
          hint={t('submission.editor.patternHint')}
          error={errorFor('pattern')}
          optional
        >
          <Input
            ref={patternRef}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            className="font-mono"
            value={draft.namingPattern}
            onChange={(event) => onChange({ namingPattern: event.target.value })}
          />
        </Field>
        <div
          role="group"
          aria-label={t('submission.editor.insert')}
          className="flex flex-wrap gap-2"
        >
          {NAMING_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => insert(token)}
              aria-label={t('submission.editor.insertToken', {
                token: t(`submission.tokenLabels.${token}`),
              })}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border-default border-border-strong bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-sunken"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t(`submission.tokenLabels.${token}`)}
            </button>
          ))}
        </div>
        {preview && (
          <p className="rounded-md bg-surface-sunken p-3 text-sm text-text" aria-live="polite">
            {t('submission.editor.preview')}{' '}
            <code dir="ltr" className="font-mono font-semibold [overflow-wrap:anywhere]">
              {preview}
            </code>
            <span className="block text-muted">{t('submission.editor.previewNote')}</span>
          </p>
        )}
        {draft.namingPattern.trim() && (
          <Checkbox
            id={id('case')}
            checked={draft.caseSensitive}
            onCheckedChange={(caseSensitive) => onChange({ caseSensitive })}
            label={t('submission.editor.caseSensitive')}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span id={typesLabel} className="font-semibold text-text">
          {t('submission.editor.types')}
        </span>
        <p className="text-sm text-muted">{t('submission.editor.typesHint')}</p>
        <div role="group" aria-labelledby={typesLabel} className="flex flex-wrap gap-2">
          {COMMON_TYPES.map((type) => {
            const on = draft.types.includes(type);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(type)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1 rounded-full border-default px-3 text-sm font-semibold uppercase',
                  on
                    ? 'border-primary bg-primary text-primary-fg'
                    : 'border-border-strong bg-surface text-text hover:bg-surface-sunken',
                )}
              >
                {on && <Check aria-hidden="true" className="size-4" />}
                {type}
              </button>
            );
          })}
        </div>
        <Field
          id={id('other-types')}
          label={t('submission.editor.otherTypes')}
          hint={t('submission.editor.otherTypesHint')}
          error={errorFor('other-types')}
          optional
        >
          <Input
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={draft.otherTypes}
            onChange={(event) => onChange({ otherTypes: event.target.value })}
          />
        </Field>
      </div>

      <Field
        id={id('size')}
        label={t('submission.editor.maxSize')}
        hint={t('submission.editor.maxSizeHint')}
        error={errorFor('size')}
        optional
      >
        <Input
          inputMode="decimal"
          autoComplete="off"
          className="max-w-40"
          value={draft.maxSizeMB}
          onChange={(event) => onChange({ maxSizeMB: event.target.value })}
        />
      </Field>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-semibold text-text">{t('submission.editor.channel')}</legend>
        <Field id={id('channel')} label={t('submission.summary.where')}>
          <Select
            value={draft.channelKind}
            onChange={(event) =>
              onChange({ channelKind: event.target.value as RuleDraft['channelKind'] })
            }
          >
            {SUBMISSION_CHANNELS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`submission.channels.${kind}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={id('channel-label')}
          label={t('submission.editor.channelLabel')}
          hint={t('submission.editor.channelLabelHint')}
          optional
        >
          <Input
            autoComplete="off"
            maxLength={120}
            value={draft.channelLabel}
            onChange={(event) => onChange({ channelLabel: event.target.value })}
          />
        </Field>
        <Field
          id={id('channel-url')}
          label={t('submission.editor.channelUrl')}
          hint={t('submission.editor.channelUrlHint')}
          error={errorFor('channel-url')}
          optional
        >
          <Input
            type="url"
            dir="ltr"
            inputMode="url"
            autoComplete="url"
            value={draft.channelUrl}
            onChange={(event) => onChange({ channelUrl: event.target.value })}
          />
        </Field>
      </fieldset>

      <div className="flex flex-col gap-4">
        <RadioGroup
          legend={t('submission.editor.latePolicy')}
          value={draft.lateKind}
          onValueChange={(lateKind) => onChange({ lateKind })}
          options={(['not_accepted', 'penalty', 'accepted'] as const).map((value) => ({
            value,
            label: t(`submission.editor.lateOptions.${value}`),
          }))}
        />
        <div className="flex flex-wrap gap-4">
          {draft.lateKind === 'penalty' && (
            <Field
              id={id('penalty')}
              label={t('submission.editor.penalty')}
              error={errorFor('penalty')}
              className="w-40"
            >
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={draft.penaltyPercent}
                onChange={(event) => onChange({ penaltyPercent: event.target.value })}
              />
            </Field>
          )}
          <Field
            id={id('grace')}
            label={t('submission.editor.grace')}
            hint={t('submission.editor.graceHint')}
            error={errorFor('grace')}
            className="min-w-40 flex-1"
          >
            <Input
              inputMode="numeric"
              autoComplete="off"
              className="max-w-40"
              value={draft.graceMinutes}
              onChange={(event) => onChange({ graceMinutes: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
