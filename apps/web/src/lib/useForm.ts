import type { ParseKeys } from 'i18next';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormError } from '../components/ui';

type Errors<Field extends string> = Partial<Record<Field, ParseKeys>>;

/**
 * Form state with errors shown at the right moment:
 * - not while someone is still typing a field for the first time;
 * - after they leave a field they filled in, or after they try to submit;
 * - and cleared the moment the problem is fixed.
 * Empty required fields are only reported on submit, so tabbing through a form never nags.
 */
export function useForm<Field extends string>({
  id,
  initial,
  validate,
}: {
  id: string;
  initial: Record<Field, string>;
  validate: (values: Record<Field, string>) => Errors<Field>;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [attempt, setAttempt] = useState(0);
  const submitted = attempt > 0;
  const [server, setServer] = useState<Errors<Field>>({});

  const fields = Object.keys(initial) as Field[];
  const local = validate(values);
  const errorKeyFor = (field: Field): ParseKeys | undefined => {
    const problem = server[field] ?? local[field];
    if (!problem) return undefined;
    return submitted || (touched[field] && values[field] !== '') ? problem : undefined;
  };

  const fieldId = (field: Field) => `${id}-${field}`;
  const errorFor = (field: Field) => {
    const key = errorKeyFor(field);
    return key ? String(t(key)) : undefined;
  };

  return {
    values,
    fieldId,
    errorFor,
    /** Props for an input: value, change and blur handling. */
    field: (field: Field) => ({
      name: field,
      value: values[field],
      onChange: (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
      ) => {
        const value = event.target.value;
        setValues((current) => ({ ...current, [field]: value }));
        setServer((current) => ({ ...current, [field]: undefined }));
      },
      onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
    }),
    /** Increases with every submit; pass it to `ErrorSummary` so focus moves on each attempt. */
    attempt,
    /** Problems for the error summary, after a submit attempt. */
    summary: (): FormError[] =>
      submitted
        ? fields.flatMap((field) => {
            const message = errorFor(field);
            return message ? [{ field: fieldId(field), message }] : [];
          })
        : [],
    /** Shows errors returned by the server next to their fields. */
    setServerErrors: (errors: Errors<Field>) => setServer(errors),
    setValue: (field: Field, value: string) =>
      setValues((current) => ({ ...current, [field]: value })),
    handleSubmit: (onValid: (values: Record<Field, string>) => void) => (event: FormEvent) => {
      event.preventDefault();
      setAttempt((current) => current + 1);
      setServer({});
      if (Object.keys(validate(values)).length === 0) onValid(values);
    },
  };
}
