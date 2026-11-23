import { forgotPasswordInputSchema, resetPasswordInputSchema } from '@sabaq/shared';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiRequestError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { PasswordStrengthMeter } from '../../auth/PasswordStrengthMeter';
import { serverErrors, validate } from '../../auth/validation';
import { Alert, Button, ErrorSummary, Field, Input, PasswordInput } from '../../components/ui';
import { errorKey } from '../../i18n';
import { useForm } from '../../lib/useForm';
import { AuthHeader, linkClass, takeTokenFromHash } from './parts';

/** Confirmation that an e-mail is on its way, with a way to send it again. */
export function EmailSent({
  title,
  body,
  hint,
  againLabel,
  onAgain,
  sending,
}: {
  title: string;
  body: string;
  hint: string;
  againLabel: string;
  onAgain: () => void;
  sending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col items-center gap-4 text-center">
      <span aria-hidden="true" className="rounded-full bg-success-soft p-4 text-success-text">
        <MailCheck className="size-8" />
      </span>
      <h1 className="text-2xl font-bold text-text">{title}</h1>
      <p className="text-muted">{body}</p>
      <p className="text-sm text-muted">{hint}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" loading={sending} onClick={onAgain}>
          {againLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/sign-in">{t('auth.forgot.backToSignIn')}</Link>
        </Button>
      </div>
    </div>
  );
}

/** Ask for a password reset link. Always answers the same way, so accounts stay private. */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const form = useForm({
    id: 'forgot',
    initial: { email: params.get('email') ?? '' },
    validate: (values) => validate(forgotPasswordInputSchema, values),
  });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (email: string) =>
      api('/auth/forgot-password', {
        method: 'POST',
        body: forgotPasswordInputSchema.parse({ email }),
        auth: false,
      }),
    onSuccess: (_result, email) => setSentTo(email),
  });
  const failure = send.error instanceof ApiRequestError ? send.error : null;

  if (sentTo) {
    return (
      <EmailSent
        title={t('auth.forgot.sentTitle')}
        body={t('auth.forgot.sentBody', { email: sentTo })}
        hint={t('auth.forgot.spam')}
        againLabel={t('auth.forgot.again')}
        sending={send.isPending}
        onAgain={() => send.mutate(sentTo)}
      />
    );
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => send.mutate(values.email))}
      className="flex flex-col gap-5"
    >
      <AuthHeader title={t('auth.forgot.title')} intro={t('auth.forgot.intro')} />
      <ErrorSummary errors={form.summary()} attempt={form.attempt} />
      {failure && <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />}
      <Field
        id={form.fieldId('email')}
        label={t('auth.fields.email')}
        error={form.errorFor('email')}
        required
      >
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          {...form.field('email')}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={send.isPending}
        loadingText={t('auth.forgot.submitting')}
      >
        {t('auth.forgot.submit')}
      </Button>
      <Link to="/sign-in" className={`${linkClass} self-center`}>
        {t('auth.forgot.backToSignIn')}
      </Link>
    </form>
  );
}

/** Choose a new password from the e-mailed link; every session ends afterwards. */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, endLocally } = useAuth();
  const [token] = useState(takeTokenFromHash);
  const form = useForm({
    id: 'reset',
    initial: { password: '' },
    validate: (values) =>
      validate(resetPasswordInputSchema, values, (input) => ({ ...input, token: token ?? '' })),
  });
  const reset = useMutation({
    mutationFn: (password: string) =>
      api('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),
    onSuccess: () => {
      if (state.status === 'authenticated') endLocally();
      void navigate('/sign-in?reason=password-reset', { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === 'validation_failed') {
        form.setServerErrors(serverErrors(error.issues, form.values));
      }
    },
  });
  const failure = reset.error instanceof ApiRequestError ? reset.error : null;

  if (!token || failure?.code === 'invalid_token') {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeader
          title={failure ? t('auth.verify.failedTitle') : t('auth.reset.missingTitle')}
          intro={failure ? t('errors.invalid_token') : t('auth.reset.missingBody')}
        />
        <Button asChild size="lg" fullWidth>
          <Link to="/forgot-password">{t('auth.reset.requestNew')}</Link>
        </Button>
      </div>
    );
  }

  const strengthId = `${form.fieldId('password')}-strength`;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => reset.mutate(values.password))}
      className="flex flex-col gap-5"
    >
      <AuthHeader title={t('auth.reset.title')} intro={t('auth.reset.intro')} />
      <ErrorSummary errors={form.summary()} attempt={form.attempt} />
      {failure && failure.code !== 'validation_failed' && (
        <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />
      )}
      <Field
        id={form.fieldId('password')}
        label={t('auth.fields.newPassword')}
        error={form.errorFor('password')}
        required
      >
        <PasswordInput
          autoComplete="new-password"
          aria-describedby={strengthId}
          {...form.field('password')}
        />
      </Field>
      <PasswordStrengthMeter id={strengthId} password={form.values.password} />
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={reset.isPending}
        loadingText={t('auth.reset.submitting')}
      >
        {t('auth.reset.submit')}
      </Button>
    </form>
  );
}
