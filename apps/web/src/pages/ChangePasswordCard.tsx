import { changePasswordInputSchema } from '@sabaq/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../api/client';
import { useCurrentUser } from '../auth/AuthProvider';
import { PasswordStrengthMeter } from '../auth/PasswordStrengthMeter';
import { serverErrors, validate } from '../auth/validation';
import { Alert, Button, Card, ErrorSummary, Field, PasswordInput } from '../components/ui';
import { errorKey } from '../i18n';
import { useForm } from '../lib/useForm';

/** Change the password with the current one; other devices are signed out. */
export function ChangePasswordCard() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const form = useForm({
    id: 'change-password',
    initial: { currentPassword: '', newPassword: '' },
    validate: (values) => validate(changePasswordInputSchema, values),
  });
  const change = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      api('/auth/change-password', { method: 'POST', body: values }),
    onSuccess: () => {
      toast.success(t('auth.changePassword.done'));
      form.setValue('currentPassword', '');
      form.setValue('newPassword', '');
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === 'validation_failed') {
        form.setServerErrors(serverErrors(error.issues, form.values));
      }
    },
  });
  const failure = change.error instanceof ApiRequestError ? change.error : null;
  const strengthId = `${form.fieldId('newPassword')}-strength`;

  return (
    <Card>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => change.mutate(values))}
        className="flex max-w-md flex-col gap-5"
      >
        <div>
          <h2 className="text-xl font-bold text-text">{t('auth.changePassword.title')}</h2>
          <p className="text-muted">{t('auth.changePassword.intro')}</p>
        </div>
        <ErrorSummary errors={form.summary()} attempt={form.attempt} />
        {failure && failure.code !== 'validation_failed' && (
          <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />
        )}
        {/* Lets password managers know which account this password belongs to. */}
        <input type="hidden" name="username" autoComplete="username" value={user.email} />
        <Field
          id={form.fieldId('currentPassword')}
          label={t('auth.fields.currentPassword')}
          error={form.errorFor('currentPassword')}
          required
        >
          <PasswordInput autoComplete="current-password" {...form.field('currentPassword')} />
        </Field>
        <Field
          id={form.fieldId('newPassword')}
          label={t('auth.fields.newPassword')}
          error={form.errorFor('newPassword')}
          required
        >
          <PasswordInput
            autoComplete="new-password"
            aria-describedby={strengthId}
            {...form.field('newPassword')}
          />
        </Field>
        <PasswordStrengthMeter
          id={strengthId}
          password={form.values.newPassword}
          personal={[user.name, user.email]}
        />
        <Button
          type="submit"
          className="self-start"
          loading={change.isPending}
          loadingText={t('auth.changePassword.submitting')}
        >
          {t('auth.changePassword.submit')}
        </Button>
      </form>
    </Card>
  );
}
