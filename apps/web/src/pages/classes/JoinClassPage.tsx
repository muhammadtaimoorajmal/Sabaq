import {
  type ClassForMember,
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from '@sabaq/shared';
import type { ChangeEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useClasses, useJoinClass } from '../../api/classes';
import { ApiRequestError } from '../../api/client';
import { Alert, Button, Card, ErrorSummary, Field, Input } from '../../components/ui';
import { errorKey } from '../../i18n';
import { useForm } from '../../lib/useForm';
import { linkClass } from '../auth/parts';

/** Shows the code the way it is printed (K7MQ-3XRA), whatever was typed or pasted. */
const display = (value: string) => {
  const normalized = normalizeJoinCode(value).slice(0, 8);
  return normalized.length > 4 ? formatJoinCode(normalized) : normalized;
};

/**
 * The join-code form: one field, forgiving about case, spaces and dashes. Used on the join
 * page and in the welcome steps.
 */
export function JoinCodeForm({
  id,
  initialCode = '',
  onJoined,
  footer,
}: {
  id: string;
  initialCode?: string;
  onJoined: (joined: ClassForMember) => void;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const classes = useClasses();
  const join = useJoinClass();
  const form = useForm({
    id,
    initial: { code: display(initialCode) },
    validate: (values) =>
      isValidJoinCode(values.code) ? {} : { code: 'classes.joinPage.codeInvalid' },
  });
  const failure = join.error instanceof ApiRequestError ? join.error : null;
  const field = form.field('code');

  const submit = form.handleSubmit(({ code }) => {
    const alreadyIn = new Set(classes.data?.map((cls) => cls.id));
    join.mutate(normalizeJoinCode(code), {
      onSuccess: (joined) => {
        toast.success(
          alreadyIn.has(joined.id)
            ? t('classes.joinPage.already', { name: joined.name })
            : t('classes.joinPage.joined', { name: joined.name }),
        );
        onJoined(joined);
      },
    });
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <ErrorSummary errors={form.summary()} attempt={form.attempt} />
      {failure && <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />}
      <Field
        id={form.fieldId('code')}
        label={t('classes.joinPage.code')}
        hint={t('classes.joinPage.codeHint')}
        error={form.errorFor('code')}
        required
      >
        <Input
          {...field}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            event.target.value = display(event.target.value);
            field.onChange(event);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          dir="ltr"
          className="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase"
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={join.isPending}
        loadingText={t('classes.joinPage.submitting')}
      >
        {t('classes.joinPage.submit')}
      </Button>
      {footer}
    </form>
  );
}

/**
 * Join with a code, or from a link (`/join?code=…`), which fills it in: one tap to join.
 */
export function JoinClassPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (
    <Card className="mx-auto flex w-full max-w-md flex-col gap-5 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-text">{t('classes.joinPage.title')}</h1>
        <p className="text-muted">{t('classes.joinPage.intro')}</p>
      </div>
      <JoinCodeForm
        id="join"
        initialCode={params.get('code') ?? ''}
        onJoined={(joined) => void navigate(`/classes/${joined.id}`, { replace: true })}
        footer={
          <p className="text-center text-muted">
            {t('classes.joinPage.createInstead')}{' '}
            <Link to="/classes/new" className={linkClass}>
              {t('classes.create')}
            </Link>
          </p>
        }
      />
    </Card>
  );
}
