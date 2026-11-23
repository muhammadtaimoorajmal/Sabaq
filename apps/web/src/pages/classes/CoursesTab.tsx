import {
  type ClassForMember,
  COLOR_TOKENS,
  type ColorToken,
  type Course,
  type CourseSession,
  SESSION_KINDS,
} from '@sabaq/shared';
import { BookOpen, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCourses, useDeleteCourse, useSaveCourse } from '../../api/classes';
import { ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  CourseTag,
  EmptyState,
  ErrorSummary,
  Field,
  type FormError,
  IconButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  Sheet,
  SheetContent,
  Skeleton,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { allowed, formatTime } from './helpers';

const SWATCH: Record<ColorToken, string> = {
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

type Draft = Omit<Course, 'id' | 'classId' | 'createdAt' | 'instructorName'> & {
  instructorName: string;
};

const emptySession = (): CourseSession => ({
  kind: 'lecture',
  dayOfWeek: 1,
  start: '09:00',
  end: '10:30',
  venue: null,
});

/** Adds or edits one course with its weekly timetable. */
function CourseSheet({
  classId,
  course,
  open,
  onOpenChange,
}: {
  classId: string;
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const save = useSaveCourse(classId);
  const [draft, setDraft] = useState<Draft>(() => ({
    code: course?.code ?? '',
    title: course?.title ?? '',
    instructorName: course?.instructorName ?? '',
    color: course?.color ?? 'blue',
    schedule: course?.schedule ?? [],
  }));
  const [attempt, setAttempt] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors: FormError[] = [];
  if (!draft.code.trim())
    errors.push({ field: 'course-code', message: t('classes.form.required') });
  if (serverError) errors.push({ field: 'course-code', message: serverError });
  if (!draft.title.trim())
    errors.push({ field: 'course-title', message: t('classes.form.required') });
  draft.schedule.forEach((session, index) => {
    if (session.end <= session.start) {
      errors.push({
        field: `course-session-${index}-end`,
        message: t('classes.courses.form.endBeforeStart'),
      });
    }
  });
  const shown = attempt > 0 ? errors : [];
  const errorFor = (field: string) => shown.find((error) => error.field === field)?.message;
  const failure =
    save.error instanceof ApiRequestError && save.error.code !== 'validation_failed'
      ? save.error
      : null;

  const updateSession = (index: number, change: Partial<CourseSession>) =>
    setDraft((current) => ({
      ...current,
      schedule: current.schedule.map((session, position) =>
        position === index ? { ...session, ...change } : session,
      ),
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempt((current) => current + 1);
    if (errors.length > 0) return;
    const input = {
      ...draft,
      code: draft.code.trim(),
      title: draft.title.trim(),
      instructorName: draft.instructorName.trim() || null,
      schedule: draft.schedule.map((session) => ({
        ...session,
        venue: session.venue?.trim() || null,
      })),
    };
    save.mutate(
      { courseId: course?.id, input },
      {
        onSuccess: (saved) => {
          toast.success(t('classes.courses.saved', { code: saved.code }));
          onOpenChange(false);
        },
        onError: (error) => {
          if (
            error instanceof ApiRequestError &&
            error.issues.some((issue) => issue.code === 'duplicate')
          ) {
            setServerError(t('classes.courses.form.duplicate'));
          }
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={
          course
            ? t('classes.courses.form.editTitle', { code: course.code })
            : t('classes.courses.form.addTitle')
        }
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <ErrorSummary errors={shown} attempt={attempt} />
          {failure && <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />}
          <Field
            id="course-code"
            label={t('classes.courses.form.code')}
            hint={t('classes.courses.form.codeHint')}
            error={errorFor('course-code')}
            required
          >
            <Input
              dir="ltr"
              autoComplete="off"
              value={draft.code}
              onChange={(event) => {
                setServerError(null);
                setDraft({ ...draft, code: event.target.value });
              }}
            />
          </Field>
          <Field
            id="course-title"
            label={t('classes.courses.form.title')}
            error={errorFor('course-title')}
            required
          >
            <Input
              autoComplete="off"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </Field>
          <Field id="course-instructor" label={t('classes.courses.form.instructorName')} optional>
            <Input
              autoComplete="off"
              value={draft.instructorName}
              onChange={(event) => setDraft({ ...draft, instructorName: event.target.value })}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold text-text">{t('classes.courses.form.color')}</legend>
            <p className="text-sm text-muted">{t('classes.courses.form.colorHint')}</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_TOKENS.map((color) => (
                <label
                  key={color}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-full border-default px-3 py-1.5 text-sm has-focus-visible:outline-3 has-focus-visible:outline-focus',
                    draft.color === color
                      ? 'border-primary bg-primary-soft font-semibold text-text'
                      : 'border-border text-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="course-color"
                    value={color}
                    checked={draft.color === color}
                    onChange={() => setDraft({ ...draft, color })}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className={cn('size-4 rounded-full', SWATCH[color])} />
                  {t(`classes.courses.colors.${color}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="font-semibold text-text">
              {t('classes.courses.form.schedule')}
            </legend>
            {draft.schedule.map((session, index) => {
              const number = index + 1;
              return (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-lg border-default border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text">
                      {t('classes.courses.form.session', { number })}
                    </span>
                    <IconButton
                      size="sm"
                      label={t('classes.courses.form.removeSession', { number })}
                      icon={<Trash2 />}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          schedule: draft.schedule.filter((_item, position) => position !== index),
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id={`course-session-${index}-day`} label={t('classes.courses.form.day')}>
                      <Select
                        value={session.dayOfWeek}
                        onChange={(event) =>
                          updateSession(index, { dayOfWeek: Number(event.target.value) })
                        }
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                          <option key={day} value={day}>
                            {t(`days.${day}` as 'days.0')}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      id={`course-session-${index}-kind`}
                      label={t('classes.courses.form.kind')}
                    >
                      <Select
                        value={session.kind}
                        onChange={(event) =>
                          updateSession(index, {
                            kind: event.target.value as CourseSession['kind'],
                          })
                        }
                      >
                        {SESSION_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`classes.courses.kinds.${kind}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      id={`course-session-${index}-start`}
                      label={t('classes.courses.form.start')}
                    >
                      <Input
                        type="time"
                        value={session.start}
                        onChange={(event) => updateSession(index, { start: event.target.value })}
                      />
                    </Field>
                    <Field
                      id={`course-session-${index}-end`}
                      label={t('classes.courses.form.end')}
                      error={errorFor(`course-session-${index}-end`)}
                    >
                      <Input
                        type="time"
                        value={session.end}
                        onChange={(event) => updateSession(index, { end: event.target.value })}
                      />
                    </Field>
                  </div>
                  <Field
                    id={`course-session-${index}-venue`}
                    label={t('classes.courses.form.venue')}
                    optional
                  >
                    <Input
                      value={session.venue ?? ''}
                      onChange={(event) => updateSession(index, { venue: event.target.value })}
                    />
                  </Field>
                </div>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setDraft({ ...draft, schedule: [...draft.schedule, emptySession()] })}
            >
              <Plus aria-hidden="true" />
              {t('classes.courses.form.addSession')}
            </Button>
          </fieldset>

          <Button
            type="submit"
            size="lg"
            loading={save.isPending}
            loadingText={t('classes.courses.form.saving')}
          >
            {t('classes.courses.form.save')}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function CoursesTab({ cls }: { cls: ClassForMember }) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const courses = useCourses(cls.id);
  const remove = useDeleteCourse(cls.id);
  const [editing, setEditing] = useState<{ course: Course | null } | null>(null);
  const [removing, setRemoving] = useState<Course | null>(null);
  const canManage = allowed(user, cls, 'course.manage');
  const time = (value: string) => formatTime(value, i18n.language, user.preferences.timeFormat);

  return (
    <div className="flex flex-col gap-4">
      {canManage && courses.data && courses.data.length > 0 && (
        <Button className="self-start" onClick={() => setEditing({ course: null })}>
          <Plus aria-hidden="true" />
          {t('classes.courses.add')}
        </Button>
      )}
      {courses.isPending && <Skeleton className="h-28 w-full rounded-xl" />}
      {courses.isError && <Alert tone="danger" title={t('errors.unknown')} />}
      {courses.data?.length === 0 && (
        <EmptyState
          headingLevel={3}
          icon={<BookOpen />}
          title={t('classes.courses.empty')}
          action={
            canManage ? (
              <Button onClick={() => setEditing({ course: null })}>
                <Plus aria-hidden="true" />
                {t('classes.courses.add')}
              </Button>
            ) : undefined
          }
        >
          {canManage ? t('classes.courses.emptyBody') : t('classes.courses.emptyStudent')}
        </EmptyState>
      )}
      <ul className="flex flex-col gap-3">
        {courses.data?.map((course) => (
          <li key={course.id}>
            <Card className="flex items-start gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <CourseTag code={course.code} color={course.color} />
                <h3 className="text-lg font-semibold text-text">{course.title}</h3>
                {course.instructorName && <p className="text-muted">{course.instructorName}</p>}
                {course.schedule.length === 0 ? (
                  <p className="text-sm text-muted">{t('classes.courses.noSchedule')}</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm text-text">
                    {course.schedule.map((session, index) => (
                      <li key={index}>
                        <span className="font-semibold">
                          {t(`days.${session.dayOfWeek}` as 'days.0')}
                        </span>{' '}
                        <span dir="ltr">
                          {time(session.start)}–{time(session.end)}
                        </span>{' '}
                        · {t(`classes.courses.kinds.${session.kind}`)}
                        {session.venue ? ` · ${session.venue}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canManage && (
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton
                      label={t('classes.courses.actions', { code: course.code })}
                      icon={<MoreVertical />}
                    />
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Pencil />} onSelect={() => setEditing({ course })}>
                      {t('classes.courses.edit', { code: course.code })}
                    </MenuItem>
                    <MenuItem icon={<Trash2 />} danger onSelect={() => setRemoving(course)}>
                      {t('classes.courses.remove', { code: course.code })}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {editing && (
        <CourseSheet
          key={editing.course?.id ?? 'new'}
          classId={cls.id}
          course={editing.course}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('classes.courses.removeTitle', { code: removing?.code })}
        body={t('classes.courses.removeBody')}
        confirmLabel={t('classes.courses.remove', { code: removing?.code })}
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              toast.success(t('classes.courses.removed', { code: removing.code }));
              setRemoving(null);
            },
          })
        }
      />
    </div>
  );
}
