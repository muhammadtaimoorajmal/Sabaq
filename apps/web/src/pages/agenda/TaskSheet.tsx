import { type AgendaTask, type Course, TASK_TYPES, type TaskType } from '@sabaq/shared';
import { useQueries } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDeleteTask, useSaveTask } from '../../api/agenda';
import { classKeys, useClasses } from '../../api/classes';
import { api, ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  ConfirmDialog,
  DateTimeField,
  ErrorSummary,
  type FormError,
  Field,
  Input,
  Select,
  Sheet,
  SheetContent,
  Textarea,
} from '../../components/ui';
import { errorKey } from '../../i18n';

/** Courses from every class the person belongs to, for linking a personal task to one. */
export function useMyCourses() {
  const classes = useClasses();
  const queries = useQueries({
    queries: (classes.data ?? []).map((cls) => ({
      queryKey: classKeys.courses(cls.id),
      queryFn: () => api<Course[]>(`/classes/${cls.id}/courses`),
    })),
  });
  return queries.flatMap((query) => query.data ?? []);
}

/**
 * Adds or edits a personal task: something only the person sees, such as revising a chapter.
 * The due time is in their own time zone.
 */
export function TaskSheet({
  task,
  open,
  onOpenChange,
  initialDue,
}: {
  task: AgendaTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A suggested due moment for new tasks (for example, the day being viewed). */
  initialDue?: string | null;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const courses = useMyCourses();
  const save = useSaveTask();
  const [title, setTitle] = useState(task?.title ?? '');
  const [type, setType] = useState<TaskType>(task?.type ?? 'assignment');
  const [dueAt, setDueAt] = useState<string | null>(task?.dueAt ?? initialDue ?? null);
  const [courseId, setCourseId] = useState(task?.courseId ?? '');
  const [notes, setNotes] = useState(task?.description ?? '');
  const [attempt, setAttempt] = useState(0);

  const errors: FormError[] = [];
  if (!title.trim()) errors.push({ field: 'task-title', message: t('agenda.form.required') });
  if (!dueAt) errors.push({ field: 'task-due', message: t('agenda.form.required') });
  const shown = attempt > 0 ? errors : [];
  const errorFor = (field: string) => shown.find((error) => error.field === field)?.message;
  const failure = save.error instanceof ApiRequestError ? save.error : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempt((current) => current + 1);
    if (errors.length > 0 || !dueAt) return;
    const input = {
      title: title.trim(),
      type,
      dueAt,
      courseId: courseId || null,
      description: notes.trim(),
    };
    save.mutate(
      task ? { id: task.id, input } : { input: { ...input, effort: null, submissionRule: null } },
      {
        onSuccess: () => {
          toast.success(task ? t('agenda.form.saved') : t('agenda.form.added'));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={task ? t('agenda.form.editTitle') : t('agenda.form.addTitle')}
        description={t('agenda.form.intro')}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="task-form"
              loading={save.isPending}
              loadingText={t('agenda.form.saving')}
            >
              {task ? t('agenda.form.save') : t('agenda.form.add')}
            </Button>
          </>
        }
      >
        <form id="task-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <ErrorSummary errors={shown} attempt={attempt} />
          {failure && failure.code !== 'validation_failed' && (
            <Alert
              tone="danger"
              live="assertive"
              title={
                failure.code === 'network' ? t('agenda.offlineChange') : t(errorKey(failure.code))
              }
            />
          )}
          <Field
            id="task-title"
            label={t('agenda.form.title')}
            hint={t('agenda.form.titleHint')}
            error={errorFor('task-title')}
            required
          >
            <Input
              autoComplete="off"
              maxLength={140}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field id="task-type" label={t('agenda.form.type')}>
            <Select value={type} onChange={(event) => setType(event.target.value as TaskType)}>
              {TASK_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t(`announcements.taskTypes.${item}`)}
                </option>
              ))}
            </Select>
          </Field>
          <DateTimeField
            label={t('agenda.form.due')}
            hint={t('agenda.form.dueHint', {
              zone: user.preferences.timeZone.replaceAll('_', ' '),
            })}
            error={errorFor('task-due')}
            value={dueAt}
            onChange={setDueAt}
            timeZone={user.preferences.timeZone}
            required
          />
          <Field id="task-course" label={t('agenda.form.course')} optional>
            <Select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">{t('agenda.form.noCourse')}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="task-notes" label={t('agenda.form.notes')} optional>
            <Textarea
              rows={3}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Adding, editing and deleting personal tasks from any screen: returns the actions and the
 * sheet and confirmation to render.
 */
export function useTaskEditor() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{
    task: AgendaTask | null;
    initialDue?: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<AgendaTask | null>(null);
  const remove = useDeleteTask();
  const node = (
    <>
      {editing && (
        <TaskSheet
          open
          task={editing.task}
          initialDue={editing.initialDue}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('agenda.deleteTitle', { title: deleting?.title ?? '' })}
        body={t('agenda.deleteBody')}
        confirmLabel={t('agenda.deleteConfirm')}
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast(t('agenda.deleted'));
              setDeleting(null);
            },
            onError: (error) =>
              toast.error(t(errorKey(error instanceof ApiRequestError ? error.code : undefined))),
          });
        }}
      />
    </>
  );
  return {
    add: (initialDue?: string | null) => setEditing({ task: null, initialDue }),
    edit: (task: AgendaTask) => setEditing({ task }),
    remove: setDeleting,
    node,
  };
}
