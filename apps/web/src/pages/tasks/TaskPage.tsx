import { type AgendaTask, namingValues } from '@sabaq/shared';
import { ArrowLeft, FileQuestion, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useTask } from '../../api/agenda';
import { ApiRequestError } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  CourseTag,
  EmptyState,
  Skeleton,
} from '../../components/ui';
import { useNow } from '../../lib/calendar';
import { formatWhen, relativeTime } from '../../lib/dates';
import { useToggleDone } from '../agenda/AgendaItems';
import { RuleSheet, useRemoveRule } from './RuleSheet';
import { RuleSummary, SubmissionChecker } from './SubmissionPanel';

/** Back to wherever the person came from, or to Today when the page was opened directly. */
function BackButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fromApp = (window.history.state as { idx?: number } | null)?.idx;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      onClick={() => (fromApp ? navigate(-1) : navigate('/'))}
    >
      <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
      {t('task.back')}
    </Button>
  );
}

/**
 * One task: when it is due, what to do, and how to submit it, with a checker that tells the
 * student, before submitting, whether their file follows the rules.
 */
export function TaskPage() {
  const { taskId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const now = useNow();
  const task = useTask(taskId);
  const toggle = useToggleDone();
  const [editing, setEditing] = useState(false);

  if (!task.data) {
    if (task.isPending) {
      return (
        <div className="flex flex-col gap-4" aria-busy="true">
          <h1 className="sr-only">{t('task.pageTitle')}</h1>
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }
    const missing = task.error instanceof ApiRequestError && task.error.code === 'not_found';
    return (
      <div className="flex flex-col gap-4">
        <BackButton />
        {missing ? (
          <Card>
            <h1 className="sr-only">{t('task.pageTitle')}</h1>
            <EmptyState
              icon={<FileQuestion />}
              title={t('task.notFoundTitle')}
              headingLevel={2}
              action={
                <Link to="/timeline" className="font-semibold text-primary-text underline">
                  {t('today.openTimeline')}
                </Link>
              }
            >
              {t('task.notFoundBody')}
            </EmptyState>
          </Card>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-text">{t('task.pageTitle')}</h1>
            <Alert tone="danger" title={t('task.loadFailed')} />
          </>
        )}
      </div>
    );
  }

  const item = task.data;
  const done = item.completedAt !== null;
  const overdue = !done && new Date(item.dueAt) < now;
  const { timeZone, timeFormat } = user.preferences;
  const when = formatWhen(item.dueAt, i18n.language, timeZone, timeFormat, now);
  const countdown = relativeTime(item.dueAt, i18n.language, now.getTime());
  const values = namingValues({
    studentId: user.studentId,
    name: user.name,
    section: item.classSection,
    courseCode: item.course?.code ?? null,
    title: item.title,
  });

  return (
    <div className="flex flex-col gap-6">
      <BackButton />
      <header className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          {item.course && <CourseTag code={item.course.code} color={item.course.color} />}
          <span>{t(`announcements.taskTypes.${item.type}`)}</span>
          <span>{item.className ?? t('task.personal')}</span>
        </p>
        <h1 className="text-3xl font-bold text-text [overflow-wrap:anywhere]">{item.title}</h1>
        <p className="flex flex-wrap items-center gap-2">
          <span className={overdue ? 'font-semibold text-danger-text' : 'font-semibold text-text'}>
            {overdue
              ? t('agenda.wasDue', { when, countdown })
              : t('agenda.due', { when, countdown })}
          </span>
          {overdue && <Badge tone="danger">{t('agenda.overdue')}</Badge>}
        </p>
        <Checkbox
          checked={done}
          onCheckedChange={(checked) => toggle(item, checked)}
          label={t('task.markDone')}
        />
      </header>

      {(item.description || item.announcementId) && (
        <section aria-labelledby="task-details" className="flex flex-col gap-2">
          <h2 id="task-details" className="text-xl font-bold text-text">
            {t('task.details')}
          </h2>
          {item.description && (
            <p className="whitespace-pre-line text-text [overflow-wrap:anywhere]">
              {item.description}
            </p>
          )}
          {item.announcementId && item.classId && (
            <Link
              to={`/classes/${item.classId}?tab=announcements&announcement=${item.announcementId}`}
              className="self-start font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
            >
              {t('agenda.seeAnnouncement')}
            </Link>
          )}
        </section>
      )}

      <section aria-labelledby="task-submit" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="task-submit" className="text-xl font-bold text-text">
            {t('submission.title')}
          </h2>
          {item.canEditRule && item.submissionRule && (
            <RuleActions task={item} onEdit={() => setEditing(true)} />
          )}
        </div>

        <Card className="flex flex-col gap-2">
          <h3 className="font-semibold text-text">{t('submission.rulesTitle')}</h3>
          {item.submissionRule ? (
            <RuleSummary rule={item.submissionRule} values={values} />
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-text">{t('submission.noRules')}</p>
              <p className="text-muted">
                {item.canEditRule ? t('submission.noRulesManager') : t('submission.noRulesStudent')}
              </p>
              {item.canEditRule && (
                <Button onClick={() => setEditing(true)}>
                  <Plus aria-hidden="true" />
                  {t('submission.addRules')}
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="font-semibold text-text">{t('submission.checker.title')}</h3>
          <SubmissionChecker task={item} values={values} now={now} />
        </Card>
      </section>

      {editing && <RuleSheet task={item} open onOpenChange={setEditing} />}
    </div>
  );
}

function RuleActions({ task, onEdit }: { task: AgendaTask; onEdit: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveRule(task);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={onEdit}>
        <Pencil aria-hidden="true" />
        {t('submission.editRules')}
      </Button>
      <Button variant="ghost" size="sm" onClick={remove}>
        <Trash2 aria-hidden="true" />
        {t('submission.removeRules')}
      </Button>
    </div>
  );
}
