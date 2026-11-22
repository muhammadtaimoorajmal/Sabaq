import { type AuthResponse, loginInputSchema } from '@sabaq/shared';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router';
import { api, ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import {
  Alert,
  Button,
  ErrorSummary,
  Field,
  type FormError,
  Input,
  PasswordInput,
} from '../components/ui';
import { errorKey } from '../i18n';

/** Only same-site paths are allowed as a destination after signing in. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Sign in with e-mail and password, then continue where the person was going. */
export function SignInPage() {
  const { t } = useTranslation();
  const { state, signIn } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const reason = params.get('reason');
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FormError[]>([]);

  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false }),
    onSuccess: signIn,
  });

  if (state.status === 'authenticated') return <Navigate to={next} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: FormError[] = [];
    if (!values.email.trim())
      found.push({ field: 'sign-in-email', message: t('signIn.emailRequired') });
    if (!values.password)
      found.push({ field: 'sign-in-password', message: t('signIn.passwordRequired') });
    setErrors(found);
    if (found.length > 0) return;
    const parsed = loginInputSchema.safeParse(values);
    login.mutate(parsed.success ? parsed.data : values);
  };

  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message;
  const failure = login.error instanceof ApiRequestError ? login.error : null;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text">{t('signIn.title')}</h1>
        <p className="text-muted">{t('signIn.intro')}</p>
      </div>
      {reason === 'expired' && <Alert tone="info" title={t('signIn.expired')} />}
      {reason === 'signed-out' && <Alert tone="success" title={t('signIn.signedOut')} />}
      <ErrorSummary errors={errors} />
      {failure && <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />}
      <Field
        id="sign-in-email"
        label={t('signIn.email')}
        error={errorFor('sign-in-email')}
        required
      >
        <Input
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          dir="ltr"
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </Field>
      <Field
        id="sign-in-password"
        label={t('signIn.password')}
        error={errorFor('sign-in-password')}
        required
      >
        <PasswordInput
          name="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
      </Field>
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
  );
}
