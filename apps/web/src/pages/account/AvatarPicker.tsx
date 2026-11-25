import { AVATAR_TYPES } from '@sabaq/shared';
import { Camera, Trash2 } from 'lucide-react';
import { type ChangeEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRemoveAvatar, useSetAvatar } from '../../api/account';
import { ApiRequestError, apiAsset } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import { Alert, Avatar, Button } from '../../components/ui';
import { errorKey } from '../../i18n';
import { ImageError, type ImageProblem, squareImage } from '../../lib/image';

/**
 * The profile photo: shows the current one (or initials), lets the person choose a new one,
 * which is cropped and shrunk on their device, and remove it. Saved immediately.
 */
export function AvatarPicker({
  prepare = squareImage,
}: {
  prepare?: (file: File) => Promise<string>;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [problem, setProblem] = useState<ImageProblem | 'server' | null>(null);
  const [preparing, setPreparing] = useState(false);
  const upload = useSetAvatar();
  const remove = useRemoveAvatar();

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProblem(null);
    setPreparing(true);
    try {
      const image = await prepare(file);
      await upload.mutateAsync(image);
      toast.success(t('account.photo.saved'));
    } catch (error) {
      setProblem(error instanceof ImageError ? error.problem : 'server');
    } finally {
      setPreparing(false);
    }
  };

  const busy = preparing || upload.isPending;
  const serverError = upload.error instanceof ApiRequestError ? upload.error : null;

  return (
    <div className="flex flex-col gap-3">
      <span className="font-semibold text-text">{t('account.photo.label')}</span>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={user.name} src={apiAsset(user.avatarUrl)} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            aria-describedby={hintId}
            loading={busy}
            loadingText={t('account.photo.uploading')}
            onClick={() => input.current?.click()}
          >
            <Camera aria-hidden="true" />
            {user.avatarUrl ? t('account.photo.change') : t('account.photo.choose')}
          </Button>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              loading={remove.isPending}
              disabled={busy}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast(t('account.photo.removed')),
                  onError: (error) =>
                    toast.error(
                      t(errorKey(error instanceof ApiRequestError ? error.code : undefined)),
                    ),
                })
              }
            >
              <Trash2 aria-hidden="true" />
              {t('account.photo.remove')}
            </Button>
          )}
        </div>
      </div>
      <p id={hintId} className="text-sm text-muted">
        {t('account.photo.hint')}
      </p>
      <input
        ref={input}
        type="file"
        accept={AVATAR_TYPES.join(',')}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => void choose(event)}
      />
      {problem && (
        <Alert
          tone="danger"
          live="assertive"
          title={
            problem !== 'server'
              ? t(`account.photo.${problem}`)
              : serverError?.code === 'validation_failed'
                ? t('account.photo.unreadable')
                : t(errorKey(serverError?.code))
          }
        />
      )}
    </div>
  );
}
