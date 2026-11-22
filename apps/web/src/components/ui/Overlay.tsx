import { X } from 'lucide-react';
import {
  Dialog as DialogPrimitive,
  DropdownMenu as MenuPrimitive,
  Tabs as TabsPrimitive,
} from 'radix-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * A modal dialog. Focus moves inside and stays there, Escape closes it, focus returns to the
 * button that opened it, and the title and description are announced.
 */
export function DialogContent({
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
          'fixed inset-x-4 bottom-4 z-50 mx-auto flex max-h-[85dvh] max-w-lg flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-6 shadow-lg',
          'sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2',
          className,
        )}
      >
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
        {description ? (
          <DialogPrimitive.Description className="text-muted">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {children}
        {footer && (
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

/** A menu of actions. Arrow keys move, Enter selects, typing a letter jumps to an item. */
export function MenuContent({
  children,
  align = 'end',
}: {
  children: ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-48 rounded-lg border-default border-border bg-surface p-1 shadow-lg"
      >
        {children}
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  danger = false,
  onSelect,
}: {
  children: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  onSelect?: () => void;
}) {
  return (
    <MenuPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 text-base outline-none select-none',
        'data-highlighted:bg-surface-sunken',
        danger ? 'text-danger-text' : 'text-text',
      )}
    >
      {icon && (
        <span aria-hidden="true" className="contents [&_svg]:size-4">
          {icon}
        </span>
      )}
      {children}
    </MenuPrimitive.Item>
  );
}

export const MenuSeparator = () => <MenuPrimitive.Separator className="my-1 h-px bg-border" />;

export const Tabs = TabsPrimitive.Root;

/** Tab buttons. Arrow keys switch tabs; the selected tab is the only tab stop. */
export function TabList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <TabsPrimitive.List aria-label={label} className="flex gap-1 border-b-default border-border">
      {children}
    </TabsPrimitive.List>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="-mb-px min-h-control border-b-[3px] border-transparent px-4 font-semibold text-muted hover:text-text data-[state=active]:border-primary data-[state=active]:text-text"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className="py-4">
      {children}
    </TabsPrimitive.Content>
  );
}
