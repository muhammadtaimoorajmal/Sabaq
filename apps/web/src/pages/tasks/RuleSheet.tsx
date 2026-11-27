import type { AgendaTask } from '@sabaq/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSetRule } from '../../api/agenda';
import { ApiRequestError } from '../../api/client';
import {
  Alert,
  Button,
  ErrorSummary,
  type FormError,
  Sheet,
  SheetContent,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import {
  draftFromRule,
  EMPTY_RULE_DRAFT,
  parseRuleDraft,
  type RuleDraft,
  type RuleField,
  type RuleIssue,
} from './rule-draft';
import { RuleFields } from './RuleFields';

/** Turns rule problems into form errors, linked to the fields by id. */
export function useRuleErrors(issues: RuleIssue[], idPrefix: string) {
  const { t } = useTranslation();
  const errors: FormError[] = issues.map((issue) => ({
    field: `${idPrefix}-${issue.field}`,
    message: t(
      `submission.editor.${issue.key}` as 'submission.editor.invalidSize',
      issue.params ?? {},
    ),
  }));
  const errorFor = (field: RuleField) =>
    errors.find((error) => error.field === `${idPrefix}-${field}`)?.message;
  return { errors, errorFor };
}

/** Adds or changes how a task must be submitted. */
export function RuleSheet({
  task,
  open,
  onOpenChange,
}: {
  task: AgendaTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const setRule = useSetRule(task.id);
  const [draft, setDraft] = useState<RuleDraft>(() =>
    task.submissionRule ? draftFromRule(task.submissionRule) : EMPTY_RULE_DRAFT,
  );
  const [attempt, setAttempt] = useState(0);
  const parsed = parseRuleDraft(draft);
  const { errors, errorFor } = useRuleErrors(attempt > 0 ? parsed.issues : [], 'rule');
  const failure = setRule.error instanceof ApiRequestError ? setRule.error : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempt((current) => current + 1);
    if (!parsed.rule) return;
    setRule.mutate(parsed.rule, {
      onSuccess: () => {
        toast.success(t('submission.saved'));
        onOpenChange(false);
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t('submission.editor.title')}
        description={t('submission.editor.intro')}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="rule-form"
              loading={setRule.isPending}
              loadingText={t('submission.editor.saving')}
            >
              {t('submission.editor.save')}
            </Button>
          </>
        }
      >
        <form id="rule-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <ErrorSummary errors={errors} attempt={attempt} />
          {failure && (
            <Alert
              tone="danger"
              live="assertive"
              title={
                failure.code === 'network' ? t('agenda.offlineChange') : t(errorKey(failure.code))
              }
            />
          )}
          <RuleFields
            draft={draft}
            onChange={(change) => setDraft((current) => ({ ...current, ...change }))}
            errorFor={errorFor}
          />
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Removes a task's rules, with Undo in the confirmation. */
export function useRemoveRule(task: AgendaTask) {
  const { t } = useTranslation();
  const setRule = useSetRule(task.id);
  const failed = (error: unknown) =>
    toast.error(
      error instanceof ApiRequestError && error.code === 'network'
        ? t('agenda.offlineChange')
        : t(errorKey(error instanceof ApiRequestError ? error.code : undefined)),
    );
  return () => {
    const previous = task.submissionRule;
    setRule.mutate(null, {
      onError: failed,
      onSuccess: () =>
        toast(t('submission.removed'), {
          action: previous
            ? {
                label: t('agenda.undo'),
                onClick: () => setRule.mutate(previous, { onError: failed }),
              }
            : undefined,
        }),
    });
  };
}
