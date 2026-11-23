import { resendVerificationInputSchema, type User } from '@sabaq/shared';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { validate } from '../../auth/validation';
import { Alert, Button, ErrorSummary, Field, Input, Spinner } from '../../components/ui';
import { errorKey } from '../../i18n';
import { useForm } from '../../lib/useForm';
import { EmailSent } from './PasswordRecovery';
import { AuthHeader, takeTokenFromHash } from './parts';

function ResendForm({ title, intro }: { title: string; intro: string }) {
  const { t } = useTranslation();
  const { state } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    id: 'resend',
    initial: { email: state.status === 'authenticated' ? state.user.email : '' },
    validate: (values) => validate(resendVerificationInputSchema, values),
  });
  const resend = useMutation({
    mutationFn: (email: string) =>
      api('/auth/resend-verification', { method: 'POST', body: { email }, auth: false }),
    onSuccess: (_result, email) => setSentTo(email),
  });
  const failure = resend.error instanceof ApiRequestError ? resend.error : null;

  if (sentTo) {
    return (
      <EmailSent
        title={t('auth.verify.sentTitle')}
        body={t('auth.verify.sentBody', { email: sentTo })}
        hint={t('auth.forgot.spam')}
        againLabel={t('auth.forgot.again')}
        sending={resend.isPending}
        onAgain={() => resend.mutate(sentTo)}
      />
    );
  }
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => resend.mutate(values.email))}
      className="flex flex-col gap-5"
    >
      <span
        aria-hidden="true"
        className="self-start rounded-full bg-warning-soft p-3 text-warning-text"
      >
        <MailWarning className="size-7" />
      </span>
      <AuthHeader title={title} intro={intro} />
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
      <Button type="submit" size="lg" fullWidth loading={resend.isPending}>
        {t('auth.verify.send')}
      </Button>
    </form>
  );
}

/** Opened from the e-mailed link: confirms the address straight away. */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { state, updateUser } = useAuth();
  const [token] = useState(takeTokenFromHash);
  const started = useRef(false);
  const verify = useMutation({
    mutationFn: async (value: string) => {
      await api('/auth/verify-email', { method: 'POST', body: { token: value }, auth: false });
    },
  });
  const signedIn = state.status === 'authenticated';

  useEffect(() => {
    // A single-use link must be sent exactly once, even when React re-runs effects.
    if (!token || started.current) return;
    started.current = true;
    verify.mutate(token);
  }, [token, verify]);

  useEffect(() => {
    if (!verify.isSuccess || !signedIn) return;
    void api<User>('/auth/me').then(updateUser, () => undefined);
  }, [verify.isSuccess, signedIn, updateUser]);

  if (!token)
    return (
      <ResendForm title={t('auth.verify.missingTitle')} intro={t('auth.verify.missingBody')} />
    );
  if (verify.isError) {
    if (verify.error instanceof ApiRequestError && verify.error.code === 'invalid_token') {
      return (
        <ResendForm title={t('auth.verify.failedTitle')} intro={t('auth.verify.failedBody')} />
      );
    }
    return (
      <Alert
        tone="danger"
        live="assertive"
        title={t(errorKey(verify.error instanceof ApiRequestError ? verify.error.code : undefined))}
      />
    );
  }
  if (!verify.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Spinner className="size-8 text-primary-text" label={t('auth.verify.checking')} />
        <h1 className="text-xl font-semibold text-text">{t('auth.verify.checking')}</h1>
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-col items-center gap-4 text-center">
      <span aria-hidden="true" className="rounded-full bg-success-soft p-4 text-success-text">
        <CheckCircle2 className="size-8" />
      </span>
      <h1 className="text-2xl font-bold text-text">{t('auth.verify.successTitle')}</h1>
      <p className="text-muted">{t('auth.verify.successBody')}</p>
      <Button asChild size="lg">
        <Link to={signedIn ? '/' : '/sign-in'}>
          {signedIn ? t('auth.verify.continue') : t('signIn.submit')}
        </Link>
      </Button>
    </div>
  );
}

/** Reminds signed-in people with an unconfirmed address, with a one-tap resend. */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const resend = useMutation({
    mutationFn: (email: string) =>
      api('/auth/resend-verification', { method: 'POST', body: { email }, auth: false }),
    onSuccess: () => toast.success(t('auth.verify.resent')),
    onError: (error) =>
      toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined))),
  });
  if (state.status !== 'authenticated' || state.user.emailVerified) return null;
  const { email } = state.user;
  return (
    <Alert
      tone="info"
      title={t('auth.verify.bannerTitle')}
      className="mb-6"
      action={
        <Button
          size="sm"
          variant="secondary"
          loading={resend.isPending}
          onClick={() => resend.mutate(email)}
        >
          {t('auth.verify.resend')}
        </Button>
      }
    >
      {t('auth.verify.bannerBody', { email })}
    </Alert>
  );
}
