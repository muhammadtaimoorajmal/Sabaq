import {
  ANNOUNCEMENT_TYPES,
  type AnnouncementForUser,
  type AnnouncementType,
  type ClassForMember,
  createAnnouncementInputSchema,
  type PastedAnnouncement,
  type SubmissionChannelKind,
  type TaskType,
  type UpdateAnnouncementInput,
  webUrlSchema,
} from '@sabaq/shared';
import { Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCreateAnnouncement, useUpdateAnnouncement } from '../../api/announcements';
import { useCourses } from '../../api/classes';
import { ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  DateTimeField,
  ErrorSummary,
  type FormError,
  Field,
  IconButton,
  Input,
  Select,
  Sheet,
  SheetContent,
  Switch,
  Textarea,
} from '../../components/ui';
import { errorKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { AnnouncementCard } from './AnnouncementCard';
import { PastePanel } from './PastePanel';
import { TYPE_META } from './meta';

const DEADLINE_TASKS: TaskType[] = ['assignment', 'lab', 'project', 'reading', 'other'];
const ASSESSMENT_TASKS: TaskType[] = ['quiz', 'exam', 'presentation'];

interface Draft {
  classId: string;
  type: AnnouncementType;
  courseId: string;
  title: string;
  body: string;
  dueAt: string | null;
  startsAt: string | null;
  venue: string;
  taskType: TaskType;
  links: { label: string; url: string }[];
  pinned: boolean;
  /** File rules read from a pasted message (deadlines only). */
  submission: PastedRule | null;
}

interface PastedRule {
  namingPattern: string | null;
  allowedExtensions: string[];
  channel: SubmissionChannelKind | null;
}

const draftFrom = (classId: string, announcement: AnnouncementForUser | null): Draft => ({
  classId: announcement?.classId ?? classId,
  type: announcement?.type ?? 'deadline',
  courseId: announcement?.courseId ?? '',
  title: announcement?.title ?? '',
  body: announcement?.body ?? '',
  dueAt: announcement?.dueAt ?? null,
  startsAt: announcement?.startsAt ?? null,
  venue: announcement?.venue ?? '',
  taskType: announcement?.taskType ?? 'assignment',
  links: announcement?.links ?? [],
  pinned: announcement?.pinned ?? false,
  submission: null,
});

const needsDue = (type: AnnouncementType) => type === 'deadline' || type === 'assessment';
const needsStart = (type: AnnouncementType) => type === 'venue_change' || type === 'cancellation';
const hasVenue = (type: AnnouncementType) => type === 'assessment' || type === 'venue_change';

/** The request body for a new announcement, with only the fields its type has. */
export function createInput(draft: Draft) {
  const base = {
    type: draft.type,
    courseId: draft.courseId || null,
    title: draft.title.trim(),
    body: draft.body.trim(),
    links: draft.links.map((link) => ({ label: link.label.trim(), url: link.url.trim() })),
    pinned: draft.pinned,
  };
  const venue = draft.venue.trim() || null;
  if (draft.type === 'deadline') {
    return {
      ...base,
      dueAt: draft.dueAt,
      taskType: draft.taskType,
      ...(draft.submission && {
        submissionRule: {
          namingPattern: draft.submission.namingPattern,
          allowedExtensions: draft.submission.allowedExtensions,
          channel: { kind: draft.submission.channel ?? 'other', label: null, url: null },
        },
      }),
    };
  }
  if (draft.type === 'assessment') {
    return { ...base, dueAt: draft.dueAt, taskType: draft.taskType, venue };
  }
  if (draft.type === 'venue_change') return { ...base, startsAt: draft.startsAt, venue };
  if (draft.type === 'cancellation') return { ...base, startsAt: draft.startsAt };
  return base;
}

/** The request body for an edit: every field the type has; the API records what changed. */
export function updateInput(draft: Draft): UpdateAnnouncementInput {
  const {
    type: _type,
    submissionRule: _rule,
    ...fields
  } = createInput(draft) as Record<string, unknown> & { type: AnnouncementType };
  return fields as UpdateAnnouncementInput;
}

/**
 * Posting or editing an announcement. The type comes first, because it decides what to ask:
 * a deadline needs a due time and becomes a task for everyone, a venue change needs the new
 * room. A live preview shows exactly what students will see.
 */
export function AnnouncementComposer({
  open,
  onOpenChange,
  classes,
  classId,
  announcement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Classes the person may post to; a picker appears when there is more than one. */
  classes: ClassForMember[];
  classId: string;
  /** The announcement being edited, or `null` to post a new one. */
  announcement: AnnouncementForUser | null;
}) {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(classId, announcement));
  const [attempt, setAttempt] = useState(0);
  const cls = classes.find((item) => item.id === draft.classId) ?? classes[0];
  const courses = useCourses(draft.classId);
  const create = useCreateAnnouncement(draft.classId);
  const update = useUpdateAnnouncement(draft.classId);
  const editing = announcement !== null;
  const mutation = editing ? update : create;
  const timeZone = cls?.timeZone ?? user.preferences.timeZone;
  /** Fields filled in from a pasted message, marked until the sender changes them. */
  const [detected, setDetected] = useState<Set<string>>(new Set());
  const set = (change: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setDetected((current) => {
      const next = new Set(current);
      for (const key of Object.keys(change)) next.delete(key === 'startsAt' ? 'dueAt' : key);
      return next;
    });
  };
  const checkHint = (field: string, hint?: string) =>
    detected.has(field)
      ? [hint, t('announcements.paste.fromMessage')].filter(Boolean).join(' ')
      : hint;
  const applyPaste = (result: PastedAnnouncement) => {
    setDraft((current) => ({
      ...current,
      type: result.type,
      taskType: result.taskType ?? (result.type === 'assessment' ? 'quiz' : 'assignment'),
      courseId: result.courseId ?? current.courseId,
      title: result.title,
      body: result.body,
      dueAt: needsDue(result.type) ? result.when : current.dueAt,
      startsAt: needsStart(result.type) ? result.when : current.startsAt,
      venue: result.venue ?? '',
      submission:
        result.namingPattern || result.allowedExtensions.length > 0 || result.channel
          ? {
              namingPattern: result.namingPattern,
              allowedExtensions: result.allowedExtensions,
              channel: result.channel,
            }
          : null,
    }));
    setDetected(
      new Set(
        [
          'type',
          'title',
          'body',
          result.courseId && 'courseId',
          result.when && 'dueAt',
          result.venue && 'venue',
          result.taskType && 'taskType',
        ].filter((field): field is string => Boolean(field)),
      ),
    );
  };

  const errors: FormError[] = [];
  const required = t('announcements.composer.required');
  if (!draft.title.trim()) errors.push({ field: 'announcement-title', message: required });
  if (needsDue(draft.type) && !draft.dueAt) {
    errors.push({ field: 'announcement-due', message: required });
  }
  if (needsStart(draft.type) && !draft.startsAt) {
    errors.push({ field: 'announcement-starts', message: required });
  }
  if (draft.type === 'venue_change' && !draft.venue.trim()) {
    errors.push({ field: 'announcement-venue', message: required });
  }
  draft.links.forEach((link, index) => {
    if (!link.label.trim())
      errors.push({ field: `announcement-link-${index}-label`, message: required });
    if (!webUrlSchema.safeParse(link.url.trim()).success) {
      errors.push({
        field: `announcement-link-${index}-url`,
        message: t('announcements.composer.invalidUrl'),
      });
    }
  });
  const shown = attempt > 0 ? errors : [];
  const errorFor = (field: string) => shown.find((error) => error.field === field)?.message;
  const failure = mutation.error instanceof ApiRequestError ? mutation.error : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempt((current) => current + 1);
    if (errors.length > 0) return;
    if (editing) {
      update.mutate(
        { id: announcement.id, input: updateInput(draft) },
        {
          onSuccess: () => {
            toast.success(t('announcements.composer.saved'));
            onOpenChange(false);
          },
        },
      );
      return;
    }
    create.mutate(createAnnouncementInputSchema.parse(createInput(draft)), {
      onSuccess: () => {
        toast.success(t('announcements.composer.posted', { name: cls?.name ?? '' }));
        onOpenChange(false);
      },
    });
  };

  const course = courses.data?.find((item) => item.id === draft.courseId);
  const preview: AnnouncementForUser = {
    id: 'preview',
    classId: draft.classId,
    author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    type: draft.type,
    courseId: draft.courseId || null,
    title: draft.title.trim() || t('announcements.composer.previewTitle'),
    body: draft.body.trim(),
    links: draft.links.filter(
      (link) => link.label.trim() && webUrlSchema.safeParse(link.url).success,
    ),
    pinned: draft.pinned,
    dueAt: needsDue(draft.type) ? draft.dueAt : null,
    startsAt: needsStart(draft.type) ? draft.startsAt : null,
    venue: hasVenue(draft.type) ? draft.venue.trim() || null : null,
    taskType: needsDue(draft.type) ? draft.taskType : null,
    taskId: null,
    edits: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seenAt: new Date().toISOString(),
    canManage: false,
    receipts: null,
  };
  const taskChoices = draft.type === 'assessment' ? ASSESSMENT_TASKS : DEADLINE_TASKS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="sm:max-w-2xl"
        title={
          editing ? t('announcements.composer.editTitle') : t('announcements.composer.createTitle')
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="announcement-form"
              loading={mutation.isPending}
              loadingText={
                editing
                  ? t('announcements.composer.saving')
                  : t('announcements.composer.submitting')
              }
            >
              {editing ? t('announcements.composer.save') : t('announcements.composer.submit')}
            </Button>
          </>
        }
      >
        <form id="announcement-form" noValidate onSubmit={submit} className="flex flex-col gap-6">
          <ErrorSummary errors={shown} attempt={attempt} />
          {failure && failure.code !== 'validation_failed' && (
            <Alert tone="danger" live="assertive" title={t(errorKey(failure.code))} />
          )}
          {failure?.code === 'validation_failed' && (
            <Alert tone="danger" live="assertive" title={t('errors.validation_failed')} />
          )}

          {!editing && classes.length > 1 && (
            <Field id="announcement-class" label={t('announcements.composer.class')}>
              <Select
                value={draft.classId}
                onChange={(event) => set({ classId: event.target.value, courseId: '' })}
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {!editing && (
            <PastePanel
              courses={courses.data ?? []}
              timeZone={timeZone}
              display={{
                language: i18n.language,
                timeZone: user.preferences.timeZone,
                timeFormat: user.preferences.timeFormat,
              }}
              onFill={applyPaste}
            />
          )}

          {editing ? (
            <p className="text-muted">
              {t('announcements.composer.typeFixed', {
                type: t(`announcements.types.${draft.type}`),
              })}
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold text-text">
                {t('announcements.composer.type')}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ANNOUNCEMENT_TYPES.map((type) => {
                  const Icon = TYPE_META[type].icon;
                  const checked = draft.type === type;
                  return (
                    <label
                      key={type}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border-default p-3 has-focus-visible:outline-3 has-focus-visible:outline-focus',
                        checked
                          ? 'border-primary bg-primary-soft'
                          : 'border-border hover:bg-surface-sunken',
                      )}
                    >
                      <input
                        type="radio"
                        name="announcement-type"
                        value={type}
                        checked={checked}
                        onChange={() =>
                          set({
                            type,
                            taskType: type === 'assessment' ? 'quiz' : 'assignment',
                          })
                        }
                        aria-describedby={`announcement-type-${type}-hint`}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn('rounded-md p-1.5', TYPE_META[type].accent)}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold text-text">
                          {t(`announcements.types.${type}`)}
                        </span>
                        <span id={`announcement-type-${type}-hint`} className="text-sm text-muted">
                          {t(`announcements.typeHints.${type}`)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <Field
            id="announcement-course"
            label={t('announcements.composer.course')}
            hint={checkHint('courseId')}
          >
            <Select
              value={draft.courseId}
              onChange={(event) => set({ courseId: event.target.value })}
            >
              <option value="">{t('announcements.composer.noCourse')}</option>
              {courses.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="announcement-title"
            label={t('announcements.composer.title')}
            hint={checkHint('title', t('announcements.composer.titleHint'))}
            error={errorFor('announcement-title')}
            required
          >
            <Input
              autoComplete="off"
              maxLength={140}
              value={draft.title}
              onChange={(event) => set({ title: event.target.value })}
            />
          </Field>

          {needsDue(draft.type) && (
            <>
              <Field
                id="announcement-task-type"
                label={t('announcements.composer.taskType')}
                hint={checkHint('taskType')}
              >
                <Select
                  value={draft.taskType}
                  onChange={(event) => set({ taskType: event.target.value as TaskType })}
                >
                  {taskChoices.map((type) => (
                    <option key={type} value={type}>
                      {t(`announcements.taskTypes.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <DateTimeField
                label={
                  draft.type === 'deadline'
                    ? t('announcements.composer.dueAt')
                    : t('announcements.composer.startsAt')
                }
                hint={checkHint(
                  'dueAt',
                  t('announcements.composer.inClassTime', { zone: timeZone.replaceAll('_', ' ') }),
                )}
                error={errorFor('announcement-due')}
                value={draft.dueAt}
                onChange={(dueAt) => set({ dueAt })}
                timeZone={timeZone}
                defaultTime={draft.type === 'deadline' ? '23:59' : '09:00'}
                required
              />
              <p className="-mt-3 text-sm text-muted">{t('announcements.composer.taskNote')}</p>
            </>
          )}

          {needsStart(draft.type) && (
            <DateTimeField
              label={t('announcements.composer.startsAt')}
              hint={checkHint(
                'dueAt',
                t('announcements.composer.inClassTime', { zone: timeZone.replaceAll('_', ' ') }),
              )}
              error={errorFor('announcement-starts')}
              value={draft.startsAt}
              onChange={(startsAt) => set({ startsAt })}
              timeZone={timeZone}
              defaultTime="09:00"
              required
            />
          )}

          {hasVenue(draft.type) && (
            <Field
              id="announcement-venue"
              label={t('announcements.composer.venue')}
              hint={checkHint('venue', t('announcements.composer.venueHint'))}
              error={errorFor('announcement-venue')}
              required={draft.type === 'venue_change'}
              optional={draft.type === 'assessment'}
            >
              <Input
                autoComplete="off"
                maxLength={120}
                value={draft.venue}
                onChange={(event) => set({ venue: event.target.value })}
              />
            </Field>
          )}

          {draft.type === 'deadline' && draft.submission && (
            <section
              aria-labelledby="announcement-rule"
              className="flex flex-col gap-2 rounded-lg border-default border-border p-4"
            >
              <h3 id="announcement-rule" className="font-semibold text-text">
                {t('announcements.paste.rule.title')}
              </h3>
              <ul className="flex flex-col gap-1 text-text">
                {draft.submission.namingPattern && (
                  <li>
                    {t('announcements.paste.rule.name')}{' '}
                    <code dir="ltr" className="rounded-sm bg-surface-sunken px-1 font-mono">
                      {draft.submission.namingPattern}
                      {draft.submission.allowedExtensions[0]
                        ? `.${draft.submission.allowedExtensions[0]}`
                        : ''}
                    </code>
                  </li>
                )}
                {draft.submission.allowedExtensions.length > 0 && (
                  <li>
                    {t('announcements.paste.rule.types', {
                      types: draft.submission.allowedExtensions
                        .map((extension) => extension.toUpperCase())
                        .join(', '),
                    })}
                  </li>
                )}
                {draft.submission.channel && (
                  <li>
                    {t('announcements.paste.rule.channel', {
                      channel: t(`announcements.paste.rule.channels.${draft.submission.channel}`),
                    })}
                  </li>
                )}
              </ul>
              <p className="text-sm text-muted">{t('announcements.paste.rule.hint')}</p>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => set({ submission: null })}
              >
                {t('announcements.paste.rule.remove')}
              </Button>
            </section>
          )}

          <Field
            id="announcement-body"
            label={t('announcements.composer.body')}
            hint={checkHint('body', t('announcements.composer.bodyHint'))}
            optional
          >
            <Textarea
              rows={5}
              maxLength={5000}
              value={draft.body}
              onChange={(event) => set({ body: event.target.value })}
            />
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="font-semibold text-text">{t('announcements.composer.links')}</legend>
            {draft.links.map((link, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <Field
                  id={`announcement-link-${index}-label`}
                  label={t('announcements.composer.linkLabel')}
                  error={errorFor(`announcement-link-${index}-label`)}
                  className="min-w-40 flex-1"
                >
                  <Input
                    value={link.label}
                    onChange={(event) =>
                      set({
                        links: draft.links.map((item, position) =>
                          position === index ? { ...item, label: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  id={`announcement-link-${index}-url`}
                  label={t('announcements.composer.linkUrl')}
                  error={errorFor(`announcement-link-${index}-url`)}
                  className="min-w-48 flex-[2]"
                >
                  <Input
                    type="url"
                    dir="ltr"
                    inputMode="url"
                    value={link.url}
                    onChange={(event) =>
                      set({
                        links: draft.links.map((item, position) =>
                          position === index ? { ...item, url: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
                <IconButton
                  label={t('announcements.composer.removeLink', { number: index + 1 })}
                  icon={<Trash2 />}
                  onClick={() =>
                    set({ links: draft.links.filter((_, position) => position !== index) })
                  }
                />
              </div>
            ))}
            {draft.links.length < 10 && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => set({ links: [...draft.links, { label: '', url: '' }] })}
              >
                <Plus aria-hidden="true" />
                {t('announcements.composer.addLink')}
              </Button>
            )}
          </fieldset>

          <Switch
            label={t('announcements.composer.pin')}
            description={t('announcements.composer.pinHint')}
            checked={draft.pinned}
            onCheckedChange={(pinned) => set({ pinned })}
          />

          {editing && <Alert tone="info" title={t('announcements.composer.importantNote')} />}

          <section aria-labelledby="announcement-preview-heading" className="flex flex-col gap-2">
            <h3 id="announcement-preview-heading" className="font-semibold text-text">
              {t('announcements.composer.preview')}
            </h3>
            <AnnouncementCard
              announcement={preview}
              display={{
                language: i18n.language,
                timeZone: user.preferences.timeZone,
                timeFormat: user.preferences.timeFormat,
              }}
              course={course ? { code: course.code, color: course.color } : null}
            />
          </section>
        </form>
      </SheetContent>
    </Sheet>
  );
}
