import {
  type Course,
  parsePastedMessage,
  type PastedAnnouncement,
  type PasteMatch,
} from '@sabaq/shared';
import { ClipboardPaste, Sparkles } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Textarea } from '../../components/ui';
import { formatWhen } from '../../lib/dates';
import type { DisplaySettings } from './meta';

/** The message with each detected detail marked, and labelled for screen readers. */
export function HighlightedMessage({ text, matches }: { text: string; matches: PasteMatch[] }) {
  const { t } = useTranslation();
  const parts: ReactNode[] = [];
  let position = 0;
  for (const match of matches) {
    if (match.start < position) continue; // Overlapping details: keep the first.
    if (match.start > position) parts.push(text.slice(position, match.start));
    parts.push(
      <mark
        key={`${match.field}-${match.start}`}
        className="rounded-sm bg-surface px-0.5 text-text underline decoration-warning-text decoration-2 underline-offset-2"
      >
        {match.text}
        <span className="sr-only"> ({t(`announcements.paste.fields.${match.field}`)})</span>
      </mark>,
    );
    position = match.end;
  }
  parts.push(text.slice(position));
  return <p className="whitespace-pre-line text-text [overflow-wrap:anywhere]">{parts}</p>;
}

/**
 * Paste a message from a class chat and Sabaq fills in the announcement form. What it found is
 * highlighted in the message and listed, including what it had to assume, so the sender can
 * check everything; nothing is posted until they press Post.
 */
export function PastePanel({
  courses,
  timeZone,
  display,
  onFill,
  now,
}: {
  courses: Course[];
  timeZone: string;
  display: DisplaySettings;
  onFill: (result: PastedAnnouncement) => void;
  now?: Date;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<PastedAnnouncement | null>(null);
  const [empty, setEmpty] = useState(false);

  const fill = () => {
    if (!message.trim()) {
      setEmpty(true);
      return;
    }
    const parsed = parsePastedMessage(message, {
      now: now ?? new Date(),
      timeZone,
      courses: courses.map(({ id, code, title, schedule }) => ({ id, code, title, schedule })),
    });
    setResult(parsed);
    onFill(parsed);
  };

  const course = courses.find((item) => item.id === result?.courseId);
  const when = result?.when
    ? formatWhen(result.when, display.language, display.timeZone, display.timeFormat)
    : null;
  const dated =
    result && ['deadline', 'assessment', 'venue_change', 'cancellation'].includes(result.type);

  return (
    <section
      aria-labelledby="paste-title"
      className="flex flex-col gap-3 rounded-lg border-default border-dashed border-border-strong p-4"
    >
      <div className="flex items-start gap-3">
        <ClipboardPaste aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-text" />
        <div>
          <h3 id="paste-title" className="font-semibold text-text">
            {t('announcements.paste.title')}
          </h3>
          <p className="text-sm text-muted">{t('announcements.paste.intro')}</p>
        </div>
      </div>
      <Field
        id="paste-message"
        label={t('announcements.paste.label')}
        error={empty ? t('announcements.paste.empty') : undefined}
      >
        <Textarea
          rows={3}
          maxLength={5000}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setEmpty(false);
          }}
        />
      </Field>
      <Button variant="secondary" className="self-start" onClick={fill}>
        <Sparkles aria-hidden="true" />
        {result ? t('announcements.paste.refill') : t('announcements.paste.fill')}
      </Button>

      {result && (
        <div role="status" className="flex flex-col gap-3">
          <Alert tone="warning" title={t('announcements.paste.review')}>
            <HighlightedMessage text={result.body} matches={result.matches} />
          </Alert>
          <div>
            <h4 className="font-semibold text-text">{t('announcements.paste.understood')}</h4>
            <ul className="mt-1 flex list-disc flex-col gap-1 ps-5 text-text">
              <li>
                {t('announcements.paste.summary.type', {
                  type: t(`announcements.types.${result.type}`),
                })}
              </li>
              {course && (
                <li>
                  {t('announcements.paste.summary.course', {
                    course: `${course.code} · ${course.title}`,
                  })}
                </li>
              )}
              {when && <li>{t('announcements.paste.summary.when', { when })}</li>}
              {result.timeAssumed && (
                <li className="font-semibold text-warning-text">
                  {t('announcements.paste.timeAssumed')}
                </li>
              )}
              {dated && !when && (
                <li className="font-semibold text-warning-text">
                  {t('announcements.paste.missingDate')}
                </li>
              )}
              {result.venue && (
                <li>{t('announcements.paste.summary.venue', { venue: result.venue })}</li>
              )}
              {result.namingPattern && (
                <li>
                  {t('announcements.paste.summary.naming', { pattern: result.namingPattern })}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
