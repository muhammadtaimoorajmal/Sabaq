import { type AuthResponse, loginInputSchema } from '@sabaq/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router';
import { api, ApiRequestError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { serverErrors, validate } from '../../auth/validation';
import { Alert, Button, ErrorSummary, Field, Input, PasswordInput } from '../../components/ui';
import { errorKey } from '../../i18n';
import { useForm } from '../../lib/useForm';
import { AuthHeader, AuthSwitch, linkClass, withNext } from './parts';

/** Only same-site paths are allowed as a destination after signing in. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Demo accounts from the API's demo data; offered in development and on demo installations. */
export const DEMO_ACCOUNTS = [
  { role: 'demoStudent', email: 'zara.ahmed@northfield.example' },
  { role: 'demoClassRep', email: 'hamza.khan@northfield.example' },
  { role: 'demoInstructor', email: 'ayesha.siddiqui@northfield.example' },
] as const;
export const DEMO_PASSWORD = 'sabaq-demo';

export const showDemoAccounts = () =>
  import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCOUNTS === 'true';

/** Sign in with e-mail and password, then continue where the person was going. */
export function SignInPage({ demo = showDemoAccounts() }: { demo?: boolean }) {
  const { t } = useTranslation();
  const { state, signIn } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const reason = params.get('reason');
  const form = useForm({
    id: 'sign-in',
    initial: { email: params.get('email') ?? '', password: '' },
    validate: (values) => validate(loginInputSchema, values),
  });

  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false }),
    onSuccess: signIn,
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === 'validation_failed') {
        form.setServerErrors(serverErrors(error.issues, form.values));
      }
    },
  });

  if (state.status === 'authenticated') return <Navigate to={next} replace />;

  const failure = login.error instanceof ApiRequestError ? login.error : null;
  const failureMessage =
    failure?.code === 'account_locked'
      ? t('auth.signInExtra.locked', {
          count: Math.max(1, Math.ceil((failure.retryAfterSeconds ?? 60) / 60)),
        })
      : failure && failure.code !== 'validation_failed'
        ? t(errorKey(failure.code))
        : null;
  const submit = form.handleSubmit((values) => {
    const parsed = loginInputSchema.safeParse(values);
    login.mutate(parsed.success ? parsed.data : values);
  });

  return (
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <AuthHeader title={t('signIn.title')} intro={t('signIn.intro')} />
        {reason === 'expired' && <Alert tone="info" title={t('signIn.expired')} />}
        {reason === 'signed-out' && <Alert tone="success" title={t('signIn.signedOut')} />}
        {reason === 'password-reset' && (
          <Alert tone="success" title={t('auth.signInExtra.passwordReset')} />
        )}
        <ErrorSummary errors={form.summary()} attempt={form.attempt} />
        {failureMessage && (
          <Alert
            tone="danger"
            live="assertive"
            title={failureMessage}
            action={
              failure?.code === 'account_locked' || failure?.code === 'invalid_credentials' ? (
                <Link
                  to={`/forgot-password?email=${encodeURIComponent(form.values.email)}`}
                  className={linkClass}
                >
                  {t('auth.signInExtra.forgot')}
                </Link>
              ) : undefined
            }
          />
        )}
        <Field
          id={form.fieldId('email')}
          label={t('auth.fields.email')}
          error={form.errorFor('email')}
          required
        >
          <Input
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            {...form.field('email')}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <Field
            id={form.fieldId('password')}
            label={t('auth.fields.password')}
            error={form.errorFor('password')}
            required
          >
            <PasswordInput autoComplete="current-password" {...form.field('password')} />
          </Field>
          <Link
            to={`/forgot-password${form.values.email ? `?email=${encodeURIComponent(form.values.email)}` : ''}`}
            className={`${linkClass} self-start text-sm`}
          >
            {t('auth.signInExtra.forgot')}
          </Link>
        </div>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={login.isPending}
          loadingText={t('signIn.submitting')}
        >
          {t('signIn.submit')}
        </Button>
      </form>

      <AuthSwitch
        question={t('auth.signInExtra.noAccount')}
        to={withNext('/sign-up', next)}
        action={t('auth.signInExtra.createAccount')}
      />

      {demo && (
        <section
          aria-labelledby="demo-title"
          className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-4"
        >
          <div>
            <h2 id="demo-title" className="font-semibold text-text">
              {t('auth.signInExtra.demoTitle')}
            </h2>
            <p className="text-sm text-muted">{t('auth.signInExtra.demoBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map(({ role, email }) => (
              <Button
                key={role}
                size="sm"
                variant="secondary"
                disabled={login.isPending}
                onClick={() => login.mutate({ email, password: DEMO_PASSWORD })}
              >
                {t(`auth.signInExtra.${role}`)}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
