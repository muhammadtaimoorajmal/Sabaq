import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Dialog, DialogClose, DialogContent } from './Overlay';

/**
 * Asks before an action that is hard to undo. The safe choice comes first and is focused by
 * default, and the confirm button names the action ("Remove class"), never just "OK".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  pending = false,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  body: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={body}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">{t('common.cancel')}</Button>
            </DialogClose>
            <Button variant={danger ? 'danger' : 'primary'} loading={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
