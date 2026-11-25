import { profileUpdateSchema } from '@sabaq/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateProfile } from '../../api/account';
import { ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import { serverErrors, validate } from '../../auth/validation';
import { Alert, Button, ErrorSummary, Field, Input } from '../../components/ui';
import { errorKey } from '../../i18n';
import { useForm } from '../../lib/useForm';

interface Values {
  name: string;
  studentId: string;
}

/** The update to send: an empty student ID clears it. */
const toUpdate = (values: Values) => ({
  name: values.name,
  studentId: values.studentId.trim() || null,
});

/** Name and student ID; used in settings and in the welcome steps. */
export function ProfileForm({
  id,
  submitLabel,
  onSaved,
  actions,
}: {
  id: string;
  submitLabel: string;
  onSaved?: () => void;
  /** Extra buttons shown beside the submit button, such as "Back". */
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const save = useUpdateProfile();
  const form = useForm<keyof Values>({
    id,
    initial: { name: user.name, studentId: user.studentId ?? '' },
    validate: (values) => validate(profileUpdateSchema, values, toUpdate),
  });
  const failure = save.error instanceof ApiRequestError ? save.error : null;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(toUpdate(values), {
          onSuccess: () => onSaved?.(),
          onError: (error) => {
            if (error instanceof ApiRequestError && error.code === 'validation_failed') {
              form.setServerErrors(serverErrors(error.issues, form.values));
            }
          },
        }),
      )}
    >
      <ErrorSummary errors={form.summary()} attempt={form.attempt} />
      {failure && failure.code !== 'validation_failed' && (
        <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />
      )}
      <Field
        id={form.fieldId('name')}
        label={t('auth.fields.name')}
        hint={t('auth.fields.nameHint')}
        error={form.errorFor('name')}
        required
      >
        <Input autoComplete="name" {...form.field('name')} />
      </Field>
      <Field
        id={form.fieldId('studentId')}
        label={t('auth.fields.studentId')}
        hint={t('auth.fields.studentIdHint')}
        error={form.errorFor('studentId')}
        optional
      >
        <Input autoComplete="off" dir="ltr" {...form.field('studentId')} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={save.isPending} loadingText={t('account.profile.saving')}>
          {submitLabel}
        </Button>
        {actions}
      </div>
    </form>
  );
}
