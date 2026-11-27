import {
  type AgendaTask,
  checkSubmission,
  type FileKind,
  fillNamingPattern,
  type NamingToken,
  type NamingValues,
  normalizeExtension,
  parseNamingPattern,
  type SubmissionCheck,
  type SubmissionRule,
} from '@sabaq/shared';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileUp,
  Info,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Alert, Button, Spinner } from '../../components/ui';
import { copyText } from '../../lib/clipboard';
import { cn } from '../../lib/cn';
import { relativeTime } from '../../lib/dates';
import { formatMegabytes, formatSize, readFileKind } from '../../lib/files';

/** Checks without a rule still catch empty files, renamed files and lateness. */
const NO_RULE: SubmissionRule = {
  namingPattern: null,
  caseSensitive: false,
  allowedExtensions: [],
  maxSizeMB: null,
  channel: { kind: 'other', label: null, url: null },
  latePolicy: { kind: 'accepted', graceMinutes: 0 },
};

const upper = (extensions: readonly string[]) =>
  extensions.map((extension) => normalizeExtension(extension).toUpperCase());

/** Details that come from the student's own profile; the rest belong to the class or task. */
const PERSONAL: readonly string[] = ['STUDENT_ID', 'STUDENT_NAME'];
const isPersonal = (token: string) => PERSONAL.includes(token);

/** "student ID and section", in the interface language. */
function useTokenList() {
  const { t, i18n } = useTranslation();
  return (tokens: readonly string[]) =>
    new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
      tokens.map((token) => t(`submission.tokens.${token as NamingToken}`)),
    );
}

/** The exact file name for this student, or the details still missing to work it out. */
export function expectedName(rule: SubmissionRule, values: NamingValues) {
  if (!rule.namingPattern) return null;
  const parsed = parseNamingPattern(rule.namingPattern);
  if (!parsed.ok) return null;
  const { name, missing } = fillNamingPattern(parsed.segments, values);
  const extension = rule.allowedExtensions[0];
  return { name: extension ? `${name}.${extension}` : name, missing };
}

/** Copies a file name, saying so; the name stays selectable if copying is blocked. */
export function CopyNameButton({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={t('submission.summary.copyName', { name })}
      onClick={async () => {
        if (await copyText(name)) toast.success(t('submission.summary.copied'));
        else toast.error(t('submission.summary.copyFailed'));
      }}
    >
      <Copy aria-hidden="true" />
      {t('submission.summary.copy')}
    </Button>
  );
}

function FileName({ name }: { name: string }) {
  return (
    <code
      dir="ltr"
      className="rounded-sm bg-surface-sunken px-1.5 py-0.5 font-mono font-semibold text-text [overflow-wrap:anywhere]"
    >
      {name}
    </code>
  );
}

/** How to submit the task, with this student's exact file name ready to copy. */
export function RuleSummary({ rule, values }: { rule: SubmissionRule; values: NamingValues }) {
  const { t, i18n } = useTranslation();
  const list = useTokenList();
  const expected = expectedName(rule, values);
  const late = rule.latePolicy;
  const row =
    'flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:gap-4';
  const term = 'font-semibold text-text sm:w-40 sm:shrink-0';

  return (
    <dl className="flex flex-col">
      {expected && (
        <div className={row}>
          <dt className={term}>{t('submission.summary.yourName')}</dt>
          <dd className="flex min-w-0 flex-col gap-2">
            {expected.missing.length === 0 ? (
              <span className="flex flex-wrap items-center gap-2">
                <FileName name={expected.name} />
                <CopyNameButton name={expected.name} />
              </span>
            ) : (
              <>
                {expected.missing.some(isPersonal) && (
                  <Alert
                    tone="warning"
                    title={t('submission.summary.missing', {
                      fields: list(expected.missing.filter(isPersonal)),
                    })}
                  >
                    <Link
                      to="/settings#section-profile"
                      className="font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
                    >
                      {t('submission.summary.addDetails')}
                    </Link>
                  </Alert>
                )}
                {expected.missing.some((token) => !isPersonal(token)) && (
                  <Alert
                    tone="warning"
                    title={t('submission.summary.missingClass', {
                      fields: list(expected.missing.filter((token) => !isPersonal(token))),
                    })}
                  />
                )}
              </>
            )}
            <span className="text-sm text-muted">
              {t('submission.summary.pattern')}{' '}
              <code dir="ltr" className="font-mono [overflow-wrap:anywhere]">
                {rule.namingPattern}
              </code>
              {rule.caseSensitive && <> · {t('submission.summary.caseSensitive')}</>}
            </span>
          </dd>
        </div>
      )}
      <div className={row}>
        <dt className={term}>{t('submission.summary.types')}</dt>
        <dd className="text-text">
          {rule.allowedExtensions.length > 0
            ? new Intl.ListFormat(i18n.language, { type: 'disjunction' }).format(
                upper(rule.allowedExtensions),
              )
            : t('submission.summary.anyType')}
        </dd>
      </div>
      {rule.maxSizeMB !== null && (
        <div className={row}>
          <dt className={term}>{t('submission.summary.size')}</dt>
          <dd className="text-text">{formatMegabytes(rule.maxSizeMB, i18n.language)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className={term}>{t('submission.summary.where')}</dt>
        <dd className="flex min-w-0 flex-col gap-1 text-text">
          <span>
            {t(`submission.channels.${rule.channel.kind}`)}
            {rule.channel.label && <> · {rule.channel.label}</>}
          </span>
          {rule.channel.url && (
            <a
              href={rule.channel.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 self-start font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
            >
              {t('submission.checks.openLink')}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}
        </dd>
      </div>
      <div className={row}>
        <dt className={term}>{t('submission.summary.late')}</dt>
        <dd className="text-text">
          {late.kind === 'penalty'
            ? t('submission.late.penalty', { percent: late.penaltyPercent })
            : t(`submission.late.${late.kind}`)}
          {late.graceMinutes > 0 && (
            <> {t('submission.late.grace', { count: late.graceMinutes })}</>
          )}
        </dd>
      </div>
    </dl>
  );
}

const STATUS_ORDER = { fail: 0, warn: 1, info: 2, pass: 3, skipped: 4 } as const;
const STATUS_ICON = {
  pass: { Icon: CheckCircle2, className: 'text-success-text' },
  info: { Icon: Info, className: 'text-primary-text' },
  warn: { Icon: AlertTriangle, className: 'text-warning-text' },
  fail: { Icon: XCircle, className: 'text-danger-text' },
} as const;

interface CheckedFile {
  name: string;
  size: number;
  kind: FileKind | undefined;
}

/** One result in words: what was found, and how to fix it. */
function useDescribe(task: AgendaTask, now: Date) {
  const { t, i18n } = useTranslation();
  const list = useTokenList();
  const rule = task.submissionRule;
  const countdown = relativeTime(task.dueAt, i18n.language, now.getTime());

  return (
    check: SubmissionCheck,
    file: CheckedFile,
  ): { text: string; fix?: string; profile?: boolean } => {
    const p = check.params;
    const str = (key: string) => String(p[key] ?? '');
    switch (check.code) {
      case 'name.ok':
        return { text: t('submission.checks.name.ok') };
      case 'name.case_mismatch':
        return check.status === 'info'
          ? { text: t('submission.checks.name.case_mismatch_info', { expected: str('expected') }) }
          : { text: t('submission.checks.name.case_mismatch', { expected: str('expected') }) };
      case 'name.mismatch':
        return {
          text: t('submission.checks.name.mismatch'),
          fix: [
            t('submission.checks.name.mismatchDetail', {
              expected: str('expected'),
              actual: str('actual'),
            }),
            p.hint ? t(`submission.checks.name.hints.${p.hint as 'whitespace'}`) : null,
          ]
            .filter(Boolean)
            .join(' '),
        };
      case 'name.unverified':
      case 'name.pattern_mismatch': {
        const tokens = str('missing').split(',').filter(Boolean);
        const missing = list(tokens);
        const personal = tokens.every(isPersonal);
        return {
          text:
            check.code === 'name.unverified'
              ? t('submission.checks.name.unverified', { missing })
              : t('submission.checks.name.pattern_mismatch', { pattern: str('pattern') }),
          fix: personal
            ? t('submission.checks.name.missingFix', { missing })
            : t('submission.checks.name.missingClassFix', {
                missing: list(tokens.filter((token) => !isPersonal(token))),
              }),
          profile: personal,
        };
      }
      case 'extension.ok':
        return {
          text: t('submission.checks.extension.ok', { extension: str('extension').toUpperCase() }),
        };
      case 'extension.missing':
      case 'extension.not_allowed': {
        const allowed = upper(rule?.allowedExtensions ?? []);
        const params = {
          actual: str('actual').toUpperCase(),
          allowed: new Intl.ListFormat(i18n.language, { type: 'disjunction' }).format(allowed),
        };
        return {
          text:
            check.code === 'extension.missing'
              ? t('submission.checks.extension.missing', params)
              : t('submission.checks.extension.not_allowed', params),
          fix: t('submission.checks.extension.convertFix', { first: allowed[0] ?? '' }),
        };
      }
      case 'content.ok':
        return {
          text: t('submission.checks.content.ok', { extension: str('extension').toUpperCase() }),
        };
      case 'content.mismatch':
        return {
          text: t('submission.checks.content.mismatch', {
            extension: str('extension').toUpperCase(),
            actual: t(`submission.checks.kinds.${str('actual') as FileKind}`),
          }),
          fix: t('submission.checks.content.mismatchFix', {
            extension: str('extension').toUpperCase(),
          }),
        };
      case 'content.not_text':
        return {
          text: t('submission.checks.content.not_text'),
          fix: t('submission.checks.content.notTextFix'),
        };
      case 'size.ok': {
        const size = formatSize(file.size, i18n.language);
        return {
          text:
            rule && rule.maxSizeMB !== null
              ? t('submission.checks.size.okLimit', {
                  size,
                  max: formatMegabytes(rule.maxSizeMB, i18n.language),
                })
              : t('submission.checks.size.ok', { size }),
        };
      }
      case 'size.too_large':
        return {
          text: t('submission.checks.size.too_large', {
            size: formatSize(file.size, i18n.language),
            max: formatMegabytes(Number(p.maxMB), i18n.language),
          }),
          fix: t('submission.checks.size.tooLargeFix'),
        };
      case 'size.empty':
        return {
          text: t('submission.checks.size.empty'),
          fix: t('submission.checks.size.emptyFix'),
        };
      case 'deadline.on_time':
        return { text: t('submission.checks.deadline.on_time', { countdown }) };
      case 'deadline.closed':
        return {
          text: t('submission.checks.deadline.closed', { countdown }),
          fix: t('submission.checks.deadline.closedFix'),
        };
      case 'deadline.late_penalty':
        return {
          text: t('submission.checks.deadline.late_penalty', {
            countdown,
            percent: Number(p.penaltyPercent),
          }),
        };
      case 'deadline.grace_period':
      case 'deadline.late_accepted':
        return {
          text: rule
            ? t(
                `submission.checks.deadline.${check.code === 'deadline.grace_period' ? 'grace_period' : 'late_accepted'}`,
                {
                  countdown,
                },
              )
            : t('submission.checks.deadline.late_unknown', { countdown }),
        };
      default:
        // Channels: where to submit.
        return {
          text: t('submission.checks.channel', {
            where: t(`submission.checks.channelWhere.${(rule ?? NO_RULE).channel.kind}`),
          }),
        };
    }
  };
}

/**
 * Drop a file (or choose one) and see, before submitting, whether it follows the task's rules.
 * Everything happens on this device: only the file's name, size and first bytes are read.
 */
export function SubmissionChecker({
  task,
  values,
  now,
}: {
  task: AgendaTask;
  values: NamingValues;
  now: Date;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [file, setFile] = useState<CheckedFile | null>(null);
  const describe = useDescribe(task, now);
  const rule = task.submissionRule;

  const check = async (chosen: File | undefined) => {
    if (!chosen) return;
    setChecking(chosen.name);
    const kind = await readFileKind(chosen);
    setFile({ name: chosen.name, size: chosen.size, kind });
    setChecking(null);
  };

  useEffect(() => {
    if (file) resultRef.current?.focus();
  }, [file]);

  const result = file
    ? checkSubmission({ file, rule: rule ?? NO_RULE, dueAt: task.dueAt, now, values })
    : null;
  const shown = (result?.checks ?? [])
    .filter((item) => item.status !== 'skipped' && (rule || item.id !== 'channel'))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const problems = shown.filter((item) => item.status === 'fail').length;
  const warnings = shown.filter((item) => item.status === 'warn').length;
  const nameCheck = result?.checks.find((item) => item.id === 'name');
  const showRename =
    result?.expectedFileName &&
    (nameCheck?.status === 'fail' ||
      result.checks.some((item) => item.code === 'extension.not_allowed'));

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void check(event.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Dropping is a shortcut for mouse users; the button inside is the accessible way in. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-sunken',
        )}
      >
        <FileUp aria-hidden="true" className="size-8 text-primary-text" />
        <p className="font-semibold text-text pointer-coarse:hidden">
          {dragging ? t('submission.checker.dropNow') : t('submission.checker.drop')}
        </p>
        <p className="text-sm text-muted pointer-coarse:hidden">{t('submission.checker.or')}</p>
        <Button
          variant={file ? 'secondary' : 'primary'}
          onClick={() => inputRef.current?.click()}
          disabled={checking !== null}
        >
          {file ? t('submission.checker.another') : t('submission.checker.choose')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => {
            void check(event.target.files?.[0]);
            // Choosing the same file again (after fixing it) checks it again.
            event.target.value = '';
          }}
        />
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          {t('submission.checker.privacy')}
        </p>
      </div>
      {checking && (
        <p role="status" className="flex items-center gap-2 text-muted">
          <Spinner />
          {t('submission.checker.checking', { name: checking })}
        </p>
      )}

      {file && result && (
        <section aria-labelledby="check-verdict" className="flex flex-col gap-3">
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border-default p-4',
              result.verdict === 'ready'
                ? 'border-success/50 bg-success-soft'
                : result.verdict === 'review'
                  ? 'border-warning/50 bg-warning-soft'
                  : 'border-danger/50 bg-danger-soft',
            )}
          >
            {(() => {
              const { Icon, className } =
                STATUS_ICON[
                  result.verdict === 'ready'
                    ? 'pass'
                    : result.verdict === 'review'
                      ? 'warn'
                      : 'fail'
                ];
              return (
                <Icon aria-hidden="true" className={cn('mt-0.5 size-6 shrink-0', className)} />
              );
            })()}
            <div className="flex min-w-0 flex-col gap-1">
              <h3
                id="check-verdict"
                ref={resultRef}
                tabIndex={-1}
                className="text-lg font-bold text-text"
              >
                {result.verdict === 'ready'
                  ? t('submission.checker.verdict.ready')
                  : result.verdict === 'review'
                    ? t('submission.checker.verdict.review', { count: warnings })
                    : t('submission.checker.verdict.fix', { count: problems })}
              </h3>
              <p className="text-text">
                {t('submission.checker.resultsFor')} <FileName name={file.name} />
              </p>
              {result.verdict === 'ready' && rule && (
                <p className="text-text">{t('submission.checker.readyBody')}</p>
              )}
            </div>
          </div>

          {showRename && result.expectedFileName && (
            <div className="flex flex-col gap-2 rounded-lg border-default border-primary/40 bg-primary-soft p-4">
              <p className="font-semibold text-text">{t('submission.checker.useName')}</p>
              <span className="flex flex-wrap items-center gap-2">
                <FileName name={result.expectedFileName} />
                <CopyNameButton name={result.expectedFileName} />
              </span>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {shown.map((item) => {
              const { Icon, className } = STATUS_ICON[item.status as keyof typeof STATUS_ICON];
              const { text, fix, profile } = describe(item, file);
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border-default border-border bg-surface p-3"
                >
                  <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', className)} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-text [overflow-wrap:anywhere]">
                      <span className="sr-only">
                        {t(`submission.checker.status.${item.status as 'pass'}`)}:{' '}
                      </span>
                      {text}
                    </p>
                    {fix && <p className="text-sm text-muted [overflow-wrap:anywhere]">{fix}</p>}
                    {profile && (
                      <Link
                        to="/settings#section-profile"
                        className="self-start text-sm font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
                      >
                        {t('submission.summary.addDetails')}
                      </Link>
                    )}
                    {item.id === 'channel' && rule?.channel.url && (
                      <a
                        href={rule.channel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-primary-text underline underline-offset-2 hover:no-underline"
                      >
                        {t('submission.checks.openLink')}
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
