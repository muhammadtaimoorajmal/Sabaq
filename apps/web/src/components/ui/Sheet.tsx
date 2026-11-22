import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/**
 * A panel for secondary tasks (filters, details, navigation on phones). It slides up from the
 * bottom on small screens, where thumbs reach it, and in from the reading-end side on larger
 * ones. Focus handling matches the dialog.
 */
export function SheetContent({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto bg-surface p-6 shadow-lg',
          'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl',
          'sm:inset-y-0 sm:inset-e-0 sm:start-auto sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none',
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-2 h-1.5 w-12 rounded-full bg-border sm:hidden"
        />
        <div className="flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="text-xl font-bold text-text">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={t('common.close')}
            className="-m-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-text"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <DialogPrimitive.Description className={description ? 'text-muted' : 'sr-only'}>
          {description ?? title}
        </DialogPrimitive.Description>
        <div className="flex-1">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
