import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { type ButtonProps, buttonVariants } from './Button';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: what the button does. Read by screen readers and shown as a tooltip. */
  label: string;
  icon: ReactNode;
  variant?: ButtonProps['variant'];
  size?: 'sm' | 'md';
  /** Hide the tooltip when a visible label already sits next to the button. */
  tooltip?: boolean;
}

/** A square button that shows only an icon, always with an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = 'ghost',
    size = 'md',
    tooltip = true,
    className,
    type = 'button',
    ...props
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        buttonVariants({ variant }),
        size === 'sm' ? 'size-9 p-0' : 'size-control p-0',
        'text-muted hover:text-text',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});
