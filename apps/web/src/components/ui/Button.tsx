import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  [
    // Labels wrap instead of overflowing, so buttons still fit at 320 px with large text (WCAG 1.4.10).
    'inline-flex max-w-full shrink-0 select-none items-center justify-center gap-2 rounded-md text-center font-semibold break-words',
    'transition-colors duration-150 ease-out',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
    '[&_svg]:size-[1.15em] [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
        secondary:
          'border-default border-border-strong bg-surface text-text hover:bg-surface-sunken',
        ghost: 'text-primary-text hover:bg-primary-soft',
        danger: 'bg-danger text-danger-fg hover:brightness-95',
      },
      size: {
        sm: 'min-h-9 px-3 py-1 text-sm',
        md: 'min-h-control px-4 py-1.5 text-base',
        lg: 'min-h-12 px-6 py-2 text-lg',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, announces "busy" and prevents repeated clicks. */
  loading?: boolean;
  /** Text shown while loading, for example "Submitting…". */
  loadingText?: ReactNode;
  /** Renders the child element (such as a link) with button styling. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    loading = false,
    loadingText,
    asChild = false,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className);
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner decorative />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});
