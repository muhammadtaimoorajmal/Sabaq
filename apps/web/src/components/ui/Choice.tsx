import { Check } from 'lucide-react';
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioPrimitive,
  Slider as SliderPrimitive,
  Switch as SwitchPrimitive,
} from 'radix-ui';
import { type ReactNode, useId } from 'react';
import { cn } from '../../lib/cn';

interface ChoiceProps {
  label: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

function ChoiceLabel({
  id,
  label,
  description,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <span className="flex flex-col">
      <label htmlFor={id} className="cursor-pointer font-medium text-text">
        {label}
      </label>
      {description && (
        <span id={`${id}-description`} className="text-sm text-muted">
          {description}
        </span>
      )}
    </span>
  );
}

/** A checkbox with its label; the whole label is clickable. */
export function Checkbox({
  label,
  description,
  onCheckedChange,
  id,
  className,
  ...props
}: ChoiceProps) {
  const generated = useId();
  const controlId = id ?? `checkbox-${generated}`;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <CheckboxPrimitive.Root
        id={controlId}
        aria-describedby={description ? `${controlId}-description` : undefined}
        onCheckedChange={(state) => onCheckedChange?.(state === true)}
        className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-border-strong bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-fg disabled:opacity-55"
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Check aria-hidden="true" strokeWidth={3} className="size-4" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <ChoiceLabel id={controlId} label={label} description={description} />
    </div>
  );
}

/** An on/off setting that takes effect immediately (no save button needed). */
export function Switch({ label, description, id, className, ...props }: ChoiceProps) {
  const generated = useId();
  const controlId = id ?? `switch-${generated}`;
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <ChoiceLabel id={controlId} label={label} description={description} />
      <SwitchPrimitive.Root
        id={controlId}
        aria-describedby={description ? `${controlId}-description` : undefined}
        className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-border-strong bg-surface-sunken transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-55"
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-border-strong shadow-sm transition-transform data-[state=checked]:translate-x-[1.375rem] data-[state=checked]:bg-primary-fg rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.375rem]" />
      </SwitchPrimitive.Root>
    </div>
  );
}

export interface Option<Value extends string> {
  value: Value;
  label: ReactNode;
  description?: ReactNode;
}

interface GroupProps<Value extends string> {
  legend: ReactNode;
  options: Option<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  className?: string;
}

/** A list of exclusive choices with descriptions. Arrow keys move between options. */
export function RadioGroup<Value extends string>({
  legend,
  options,
  value,
  onValueChange,
  className,
}: GroupProps<Value>) {
  const legendId = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id={legendId} className="font-semibold text-text">
        {legend}
      </span>
      <RadioPrimitive.Root
        aria-labelledby={legendId}
        value={value}
        onValueChange={(next) => onValueChange(next as Value)}
        className="flex flex-col gap-2"
      >
        {options.map((option) => {
          const id = `${legendId}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-3">
              <RadioPrimitive.Item
                id={id}
                value={option.value}
                aria-describedby={option.description ? `${id}-description` : undefined}
                className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface data-[state=checked]:border-primary"
              >
                <RadioPrimitive.Indicator className="size-3 rounded-full bg-primary" />
              </RadioPrimitive.Item>
              <ChoiceLabel id={id} label={option.label} description={option.description} />
            </div>
          );
        })}
      </RadioPrimitive.Root>
    </div>
  );
}

/**
 * Two to five exclusive choices shown side by side, such as Light / Dark. Behaves like a
 * radio group: one tab stop, arrow keys to change.
 */
export function SegmentedControl<Value extends string>({
  legend,
  options,
  value,
  onValueChange,
  className,
}: GroupProps<Value>) {
  const legendId = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id={legendId} className="font-semibold text-text">
        {legend}
      </span>
      <RadioPrimitive.Root
        aria-labelledby={legendId}
        value={value}
        onValueChange={(next) => onValueChange(next as Value)}
        orientation="horizontal"
        className="flex flex-wrap gap-1 rounded-lg bg-surface-sunken p-1"
      >
        {options.map((option) => (
          <RadioPrimitive.Item
            key={option.value}
            value={option.value}
            className="min-h-10 flex-1 cursor-pointer rounded-md px-3 text-sm font-semibold whitespace-nowrap text-muted hover:text-text data-[state=checked]:bg-surface data-[state=checked]:text-text data-[state=checked]:shadow-sm data-[state=checked]:ring-1 data-[state=checked]:ring-border"
          >
            {option.label}
          </RadioPrimitive.Item>
        ))}
      </RadioPrimitive.Root>
    </div>
  );
}

/** A labelled slider that announces a readable value, such as "125%". */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onValueChange,
  valueText,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  valueText: string;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([next]) => {
        if (next !== undefined) onValueChange(next);
      }}
      className={cn('relative flex h-10 w-full touch-none items-center select-none', className)}
    >
      <SliderPrimitive.Track className="relative h-2 grow rounded-full bg-surface-sunken ring-1 ring-border">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-6 cursor-grab rounded-full border-2 border-primary bg-surface shadow-md active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
}
