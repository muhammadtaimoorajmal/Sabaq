import {
  type AuthResponse,
  type Preferences,
  type PreferencesUpdate,
  registerInputSchema,
} from '@sabaq/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { api, ApiRequestError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { PasswordStrengthMeter } from '../../auth/PasswordStrengthMeter';
import { serverErrors, validate } from '../../auth/validation';
import { Alert, Button, ErrorSummary, Field, Input, PasswordInput } from '../../components/ui';
import { errorKey } from '../../i18n';
import { useForm } from '../../lib/useForm';
import { usePreferences } from '../../preferences/PreferencesProvider';
import { browserTimeZone } from '../classes/helpers';
import { AuthHeader, AuthSwitch, linkClass, withNext } from './parts';
import { safeNext } from './SignInPage';

interface Values {
  name: string;
  email: string;
  password: string;
  studentId: string;
}

/** The register input: an empty student ID means "not given". */
const toInput = (values: Values) => ({
  ...values,
  studentId: values.studentId.trim() || undefined,
});

/** The display settings chosen on this device, kept with the new account. */
const devicePreferences = (preferences: Preferences): PreferencesUpdate => ({
  theme: preferences.theme,
  textScale: preferences.textScale,
  density: preferences.density,
  language: preferences.language,
  motion: preferences.motion,
  timeZone: browserTimeZone(),
});

/** Create an account in one step; the person is signed in straight away. */
export function SignUpPage() {
  const { t } = useTranslation();
  const { state, signIn } = useAuth();
  const { preferences } = usePreferences();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const form = useForm<keyof Values>({
    id: 'sign-up',
    initial: { name: '', email: '', password: '', studentId: '' },
    validate: (values) => validate(registerInputSchema, values, toInput),
  });

  const register = useMutation({
    mutationFn: (values: Values) =>
      api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: registerInputSchema.parse({
          ...toInput(values),
          preferences: devicePreferences(preferences),
        }),
        auth: false,
      }),
    onSuccess: (session) => {
      signIn(session);
      // Straight into the welcome steps, unless the person was on their way somewhere, such
      // as a class invitation link; Today then offers to finish setting up later.
      void navigate(next === '/' ? '/welcome' : next, { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === 'validation_failed') {
        form.setServerErrors(serverErrors(error.issues, form.values));
      }
    },
  });

  if (state.status === 'authenticated' && !register.isSuccess)
    return <Navigate to={next} replace />;

  const failure = register.error instanceof ApiRequestError ? register.error : null;
  const strengthId = `${form.fieldId('password')}-strength`;

  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => register.mutate(values))}
        className="flex flex-col gap-5"
      >
        <AuthHeader title={t('auth.signUp.title')} intro={t('auth.signUp.intro')} />
        <ErrorSummary errors={form.summary()} attempt={form.attempt} />
        {failure && failure.code !== 'validation_failed' && (
          <Alert
            tone="danger"
            live="assertive"
            title={t(errorKey(failure.code))}
            action={
              failure.code === 'email_taken' ? (
                <Link
                  to={`/sign-in?email=${encodeURIComponent(form.values.email)}${next === '/' ? '' : `&next=${encodeURIComponent(next)}`}`}
                  className={linkClass}
                >
                  {t('auth.signUp.emailTakenAction')}
                </Link>
              ) : undefined
            }
          />
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
        <Field
          id={form.fieldId('password')}
          label={t('auth.fields.password')}
          hint={t('designSystem.sample.passwordHint')}
          error={form.errorFor('password')}
          required
        >
          <PasswordInput
            autoComplete="new-password"
            aria-describedby={strengthId}
            {...form.field('password')}
          />
        </Field>
        <PasswordStrengthMeter
          id={strengthId}
          password={form.values.password}
          personal={[form.values.name, form.values.email]}
        />
        <Field
          id={form.fieldId('studentId')}
          label={t('auth.fields.studentId')}
          hint={t('auth.fields.studentIdHint')}
          error={form.errorFor('studentId')}
          optional
        >
          <Input autoComplete="off" dir="ltr" {...form.field('studentId')} />
        </Field>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={register.isPending}
          loadingText={t('auth.signUp.submitting')}
        >
          {t('auth.signUp.submit')}
        </Button>
      </form>
      <AuthSwitch
        question={t('auth.signUp.haveAccount')}
        to={withNext('/sign-in', next)}
        action={t('auth.signUp.signIn')}
      />
    </div>
  );
}
