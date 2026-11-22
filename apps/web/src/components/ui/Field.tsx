import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import {
  createContext,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useContext,
  useId,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Connects a control to its field's label, hint and error, if it sits inside a `Field`. */
function useFieldProps(props: { id?: string; 'aria-describedby'?: string; required?: boolean }) {
  const field = useContext(FieldContext);
  const describedBy = [field?.describedBy, props['aria-describedby']].filter(Boolean).join(' ');
  return {
    id: props.id ?? field?.id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': field?.invalid || undefined,
    required: props.required ?? field?.required,
  };
}

const controlClasses = cn(
  'block w-full rounded-md border-default border-border-strong bg-surface px-3 text-base text-text',
  'placeholder:text-muted/80 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70',
  'aria-invalid:border-danger aria-invalid:[border-width:2px]',
  'focus-visible:border-focus',
);

export interface FieldProps {
  label: ReactNode;
  /** Help shown under the label, before the person types. */
  hint?: ReactNode;
  /** The problem to fix. Its presence marks the control as invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Marks an optional field in the label; the default for forms with mostly required fields. */
  optional?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label, hint, error and control in the order people read them. The error sits above the
 * control so it is seen before the field is corrected, and it is linked to the control so
 * screen readers announce it.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  id,
  className,
  children,
}: FieldProps) {
  const { t } = useTranslation();
  const generated = useId();
  const controlId = id ?? `field-${generated}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const value = {
    id: controlId,
    describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
    invalid: Boolean(error),
    required,
  };
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="font-semibold text-text">
        {label}
        {optional && (
          <span className="ms-1.5 font-normal text-muted">({t('common.optional')})</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-danger-text">
          <AlertCircle aria-hidden="true" className="mt-[0.2em] size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(controlClasses, 'h-control', className)}
        {...props}
        {...useFieldProps(props)}
      />
    );
  },
);

/** A password input with a button that shows or hides what was typed. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const fieldProps = useFieldProps(props);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(controlClasses, 'h-control pe-12', className)}
          {...props}
          {...fieldProps}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-controls={fieldProps.id}
          aria-label={visible ? t('form.hidePassword') : t('form.showPassword')}
          className="absolute inset-y-1 inset-e-1 inline-flex w-10 items-center justify-center rounded-sm text-muted hover:bg-surface-sunken hover:text-text"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
    );
  },
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Shows how many characters remain when `maxLength` is set. */
  showCount?: boolean;
}

/**
 * Multi-line text. With `showCount`, typing past the limit is allowed (so pasted text is not
 * silently cut) and the overflow is reported instead.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, showCount = false, maxLength, value, defaultValue, onChange, ...props },
  ref,
) {
  const { t } = useTranslation();
  const fieldProps = useFieldProps(props);
  const [typedLength, setTypedLength] = useState(String(defaultValue ?? '').length);
  const countId = `${fieldProps.id ?? 'textarea'}-count`;
  const counting = showCount && maxLength !== undefined;
  const length = value === undefined ? typedLength : String(value).length;
  const left = (maxLength ?? 0) - length;
  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        rows={4}
        className={cn(controlClasses, 'min-h-24 py-2 leading-relaxed', className)}
        value={value}
        defaultValue={defaultValue}
        maxLength={counting ? undefined : maxLength}
        onChange={(event) => {
          setTypedLength(event.target.value.length);
          onChange?.(event);
        }}
        {...props}
        {...fieldProps}
        aria-describedby={
          [fieldProps['aria-describedby'], counting ? countId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-invalid={fieldProps['aria-invalid'] ?? (counting && left < 0 ? true : undefined)}
      />
      {counting && (
        <p
          id={countId}
          aria-live={left <= 20 ? 'polite' : 'off'}
          className={cn('text-sm', left < 0 ? 'font-semibold text-danger-text' : 'text-muted')}
        >
          {left >= 0
            ? t('form.charactersLeft', { count: left })
            : t('form.charactersOver', { count: -left })}
        </p>
      )}
    </div>
  );
});

/**
 * A native select: the most reliable choice for short lists on phones and with assistive
 * technology.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(controlClasses, 'h-control cursor-pointer pe-9', className)}
        {...props}
        {...useFieldProps(props)}
      >
        {children}
      </select>
    );
  },
);
