import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster as SonnerToaster } from 'sonner';
import type { ColorToken } from '@sabaq/shared';
import { cn } from '../../lib/cn';
import { usePreferences } from '../../preferences/PreferencesProvider';
import { resolveTheme } from '../../preferences/preferences';

const alertVariants = cva('flex gap-3 rounded-lg border-default p-4', {
  variants: {
    tone: {
      info: 'border-primary/40 bg-primary-soft',
      success: 'border-success-text/40 bg-success-soft',
      warning: 'border-warning-text/40 bg-warning-soft',
      danger: 'border-danger/50 bg-danger-soft',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ALERT_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
const ALERT_TEXT = {
  info: 'text-primary-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
};

/**
 * A message within the page. Color is never the only signal: each tone has its own icon and
 * a title. Use `live` only for messages that appear in response to an action.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  live,
  action,
  className,
}: VariantProps<typeof alertVariants> & {
  title: ReactNode;
  children?: ReactNode;
  live?: 'polite' | 'assertive';
  action?: ReactNode;
  className?: string;
}) {
  const key = tone ?? 'info';
  const Icon = ALERT_ICON[key];
  return (
    <div
      role={live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', ALERT_TEXT[key])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('font-semibold', ALERT_TEXT[key])}>{title}</p>
        {children && <div className="text-text">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-sunken text-muted ring-1 ring-border',
        primary: 'bg-primary-soft text-primary-text',
        success: 'bg-success-soft text-success-text',
        warning: 'bg-warning-soft text-warning-text',
        danger: 'bg-danger-soft text-danger-text',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

/** A short status label, such as "Overdue". Pair it with an icon or text, never color alone. */
export function Badge({
  tone,
  icon,
  children,
  className,
}: VariantProps<typeof badgeVariants> & {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {icon && (
        <span aria-hidden="true" className="contents [&_svg]:size-3.5">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

const COURSE_COLOR: Record<ColorToken, string> = {
  blue: 'bg-course-blue',
  teal: 'bg-course-teal',
  green: 'bg-course-green',
  lime: 'bg-course-lime',
  amber: 'bg-course-amber',
  orange: 'bg-course-orange',
  red: 'bg-course-red',
  pink: 'bg-course-pink',
  purple: 'bg-course-purple',
  indigo: 'bg-course-indigo',
  slate: 'bg-course-slate',
};

/** A course marker: a colored dot plus the course code, so color is never the only cue. */
export function CourseTag({
  code,
  color,
  className,
}: {
  code: string;
  color: ColorToken;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm font-semibold text-muted', className)}
    >
      <span aria-hidden="true" className={cn('size-2.5 rounded-full', COURSE_COLOR[color])} />
      {code}
    </span>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border-default border-border bg-surface p-5 shadow-sm', className)}
      {...props}
    />
  );
}

/** A placeholder shaped like the content that is loading. Hidden from screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-sunken', className)}
    />
  );
}

/** What to show when there is nothing yet: what it is, why it is empty, and what to do. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      {icon && (
        <span
          aria-hidden="true"
          className="rounded-full bg-primary-soft p-4 text-primary-text [&_svg]:size-8"
        >
          {icon}
        </span>
      )}
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {children && <p className="max-w-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border-default border-border-strong bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text">
      {children}
    </kbd>
  );
}

/** The first focusable element on every page: jumps past navigation to the main content. */
export function SkipLink({ target = 'main' }: { target?: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={`#${target}`}
      className="sr-only rounded-md bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
    >
      {t('common.skipToContent')}
    </a>
  );
}

/**
 * Toast notifications for the result of an action. They pause while hovered or focused,
 * stay long enough to read, and are announced politely by screen readers.
 */
export function Toaster() {
  const { preferences, system } = usePreferences();
  const { t } = useTranslation();
  const theme = resolveTheme(preferences.theme, system);
  const rtl = preferences.language === 'ur';
  return (
    <SonnerToaster
      theme={theme === 'light' ? 'light' : 'dark'}
      dir={rtl ? 'rtl' : 'ltr'}
      position={rtl ? 'bottom-left' : 'bottom-right'}
      duration={6000}
      closeButton
      visibleToasts={3}
      containerAriaLabel={t('common.appName')}
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border-default border-border bg-surface text-text shadow-lg font-[inherit]',
          description: 'text-muted',
          actionButton: 'bg-primary text-primary-fg',
          closeButton: 'bg-surface text-text border-border',
        },
      }}
    />
  );
}
