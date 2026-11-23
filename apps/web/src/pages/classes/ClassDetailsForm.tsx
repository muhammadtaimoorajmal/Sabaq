import { type ClassForMember, createClassInputSchema, type CreateClassInput } from '@sabaq/shared';
import { useTranslation } from 'react-i18next';
import { generalIssueKey, validate } from '../../auth/validation';
import { Button, ErrorSummary, Field, Input, RadioGroup, Select } from '../../components/ui';
import { useForm } from '../../lib/useForm';
import { browserTimeZone, timeZones } from './helpers';

type Values = Record<
  'name' | 'section' | 'program' | 'term' | 'institution' | 'timeZone' | 'myRole',
  string
>;

const toInput = (values: Values) => ({
  ...values,
  section: values.section.trim() || undefined,
  institution: values.institution.trim() || undefined,
});

/** The class's details, for creating a class or editing one (without the creator's role). */
export function ClassDetailsForm({
  id,
  initial,
  mode,
  pending,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  id: string;
  initial?: ClassForMember;
  mode: 'create' | 'edit';
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (input: CreateClassInput) => void;
}) {
  const { t } = useTranslation();
  const zone = initial?.timeZone ?? browserTimeZone();
  const form = useForm<keyof Values>({
    id,
    initial: {
      name: initial?.name ?? '',
      section: initial?.section ?? '',
      program: initial?.program ?? '',
      term: initial?.term ?? '',
      institution: initial?.institution ?? '',
      timeZone: zone,
      myRole: 'class_rep',
    },
    validate: (values) => validate(createClassInputSchema, values, toInput, generalIssueKey),
  });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        onSubmit(createClassInputSchema.parse(toInput(values))),
      )}
      className="flex flex-col gap-5"
    >
      <ErrorSummary errors={form.summary()} attempt={form.attempt} />
      <Field
        id={form.fieldId('name')}
        label={t('classes.form.name')}
        hint={t('classes.form.nameHint')}
        error={form.errorFor('name')}
        required
      >
        <Input autoComplete="off" {...form.field('name')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={form.fieldId('section')}
          label={t('classes.form.section')}
          hint={t('classes.form.sectionHint')}
          error={form.errorFor('section')}
          optional
        >
          <Input autoComplete="off" dir="ltr" {...form.field('section')} />
        </Field>
        <Field
          id={form.fieldId('term')}
          label={t('classes.form.term')}
          hint={t('classes.form.termHint')}
          error={form.errorFor('term')}
          required
        >
          <Input autoComplete="off" {...form.field('term')} />
        </Field>
      </div>
      <Field
        id={form.fieldId('program')}
        label={t('classes.form.program')}
        error={form.errorFor('program')}
        required
      >
        <Input autoComplete="off" {...form.field('program')} />
      </Field>
      <Field
        id={form.fieldId('institution')}
        label={t('classes.form.institution')}
        error={form.errorFor('institution')}
        optional
      >
        <Input autoComplete="organization" {...form.field('institution')} />
      </Field>
      <Field
        id={form.fieldId('timeZone')}
        label={t('classes.form.timeZone')}
        hint={t('classes.form.timeZoneHint')}
        error={form.errorFor('timeZone')}
        required
      >
        <Select dir="ltr" {...form.field('timeZone')}>
          {timeZones(zone).map((name) => (
            <option key={name} value={name}>
              {name.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
      </Field>
      {mode === 'create' && (
        <RadioGroup
          legend={t('classes.form.myRole')}
          value={form.values.myRole as 'class_rep' | 'instructor'}
          onValueChange={(role) => form.setValue('myRole', role)}
          options={[
            { value: 'class_rep', label: t('classes.form.myRoleClassRep') },
            { value: 'instructor', label: t('classes.form.myRoleInstructor') },
          ]}
        />
      )}
      <Button
        type="submit"
        size="lg"
        className="self-start"
        loading={pending}
        loadingText={pendingLabel}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
