import { Download, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { downloadAccountData, useDeleteAccount } from '../../api/account';
import { ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Field,
  PasswordInput,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { linkClass } from '../auth/parts';

/** Classes the person must hand over before deleting, from the API's `last_manager` refusal. */
const blockingClasses = (error: ApiRequestError) =>
  error.issues
    .filter((issue) => issue.path.startsWith('classes.'))
    .map((issue) => ({ id: issue.path.slice('classes.'.length), name: issue.message }));

function DeleteAccountDialog() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState(false);
  const failure = remove.error instanceof ApiRequestError ? remove.error : null;
  const wrongPassword = failure?.code === 'validation_failed';
  const fieldError = missing
    ? t('account.delete.passwordRequired')
    : wrongPassword
      ? t('account.delete.wrongPassword')
      : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setMissing(true);
      return;
    }
    remove.mutate(password, { onSuccess: () => toast(t('account.delete.done')) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPassword('');
          setMissing(false);
          remove.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="danger" className="self-start">
          <Trash2 aria-hidden="true" />
          {t('account.delete.button')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('account.delete.title')}
        description={t('account.delete.body')}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              type="submit"
              form="delete-account"
              variant="danger"
              loading={remove.isPending}
              loadingText={t('account.delete.deleting')}
            >
              {t('account.delete.confirm')}
            </Button>
          </>
        }
      >
        <form id="delete-account" noValidate onSubmit={submit} className="flex flex-col gap-4">
          {failure?.code === 'last_manager' && (
            <Alert tone="warning" live="assertive" title={t('account.delete.blocked')}>
              <ul className="list-disc ps-5">
                {blockingClasses(failure).map((cls) => (
                  <li key={cls.id}>
                    <Link to={`/classes/${cls.id}?tab=members`} className={linkClass}>
                      {cls.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {failure && !wrongPassword && failure.code !== 'last_manager' && (
            <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />
          )}
          {/* Lets password managers know which account this password belongs to. */}
          <input type="hidden" name="username" autoComplete="username" value={user.email} />
          <Field
            id="delete-account-password"
            label={t('account.delete.password')}
            error={fieldError}
            required
          >
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setMissing(false);
              }}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A copy of everything Sabaq stores about the person, and deleting the account. */
export function AccountDataCard() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const download = async () => {
    setExporting(true);
    try {
      await downloadAccountData();
      toast.success(t('account.data.exported'));
    } catch (error) {
      toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <h2 id="settings-data" className="text-xl font-bold text-text">
          {t('account.data.title')}
        </h2>
        <p className="text-muted">{t('account.data.body')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          className="self-start"
          loading={exporting}
          loadingText={t('account.data.exporting')}
          onClick={() => void download()}
        >
          <Download aria-hidden="true" />
          {t('account.data.export')}
        </Button>
        <p className="text-sm text-muted">{t('account.data.exportHint')}</p>
      </div>
      <div className="flex flex-col gap-2 border-t-default border-border pt-6">
        <h3 className="font-bold text-text">{t('account.delete.heading')}</h3>
        <p className="text-sm text-muted">{t('account.delete.intro')}</p>
        <DeleteAccountDialog />
      </div>
    </Card>
  );
}
