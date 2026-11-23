import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useCreateClass } from '../../api/classes';
import { ApiRequestError } from '../../api/client';
import { Alert, Card } from '../../components/ui';
import { errorKey } from '../../i18n';
import { ClassDetailsForm } from './ClassDetailsForm';

export function CreateClassPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateClass();
  const failure = create.error instanceof ApiRequestError ? create.error : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-display font-bold tracking-tight text-text">
          {t('classes.form.createTitle')}
        </h1>
        <p className="text-muted">{t('classes.form.createIntro')}</p>
      </header>
      <Card className="max-w-2xl">
        {failure && (
          <Alert
            tone="danger"
            live="assertive"
            className="mb-5"
            title={t(errorKey(failure.code))}
          />
        )}
        <ClassDetailsForm
          id="create-class"
          mode="create"
          pending={create.isPending}
          submitLabel={t('classes.form.submit')}
          pendingLabel={t('classes.form.submitting')}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: (created) => {
                toast.success(t('classes.form.created'));
                void navigate(`/classes/${created.id}`, { replace: true });
              },
            })
          }
        />
      </Card>
    </div>
  );
}
