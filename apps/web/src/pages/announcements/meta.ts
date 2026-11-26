import type { AnnouncementForUser, AnnouncementType } from '@sabaq/shared';
import {
  BookOpen,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  type LucideIcon,
  MapPin,
  Megaphone,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { formatWhen } from '../../lib/dates';

/** Each type has its own icon and accent, always shown with its name, never color alone. */
export const TYPE_META: Record<AnnouncementType, { icon: LucideIcon; accent: string }> = {
  deadline: { icon: CalendarClock, accent: 'bg-danger-soft text-danger-text' },
  assessment: { icon: ClipboardCheck, accent: 'bg-warning-soft text-warning-text' },
  venue_change: { icon: MapPin, accent: 'bg-primary-soft text-primary-text' },
  cancellation: { icon: CalendarX, accent: 'bg-surface-sunken text-text' },
  material: { icon: BookOpen, accent: 'bg-success-soft text-success-text' },
  general: { icon: Megaphone, accent: 'bg-primary-soft text-primary-text' },
};

export interface DisplaySettings {
  language: string;
  timeZone: string;
  timeFormat: '12h' | '24h';
}

/**
 * The one line a student needs: when it is due, where to go, or what is cancelled. `null`
 * for types without a date.
 */
export function keyFact(
  announcement: Pick<AnnouncementForUser, 'type' | 'dueAt' | 'startsAt' | 'venue' | 'taskType'>,
  t: TFunction,
  display: DisplaySettings,
  now = new Date(),
): string | null {
  const when = (iso: string) =>
    formatWhen(iso, display.language, display.timeZone, display.timeFormat, now);
  const { type, dueAt, startsAt, venue, taskType } = announcement;
  if (type === 'deadline' && dueAt) return t('announcements.facts.due', { when: when(dueAt) });
  if (type === 'assessment' && dueAt) {
    const fact = t('announcements.facts.assessment', {
      type: t(`announcements.taskTypes.${taskType ?? 'quiz'}`),
      when: when(dueAt),
    });
    return venue ? `${fact} · ${t('announcements.facts.venue', { venue })}` : fact;
  }
  if (type === 'venue_change' && startsAt) {
    return t('announcements.facts.moved', { when: when(startsAt), venue: venue ?? '' });
  }
  if (type === 'cancellation' && startsAt) {
    return t('announcements.facts.cancelled', { when: when(startsAt) });
  }
  return null;
}

/** Changed again after the person saw it: shown as "Updated" so it is not overlooked. */
export const isUpdatedSinceSeen = (announcement: AnnouncementForUser) =>
  announcement.seenAt === null && announcement.edits.length > 0;
