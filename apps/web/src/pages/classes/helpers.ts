import { can, type ClassAction, type ClassForMember, type User } from '@sabaq/shared';

/** "09:00" as "9:00 AM" or "09:00", following the person's 12- or 24-hour preference. */
export function formatTime(time: string, language: string, timeFormat: '12h' | '24h'): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, 0, 5, hours, minutes)));
}

/** Every IANA time zone the browser knows, with the given ones always included. */
export function timeZones(...include: string[]): string[] {
  const known =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set([...include, ...known, 'UTC'])].sort((a, b) => a.localeCompare(b));
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Whether the signed-in person may take an action in this class (the API checks again). */
export const allowed = (user: User, cls: Pick<ClassForMember, 'role'>, action: ClassAction) =>
  can({ platformRole: user.platformRole, membershipRole: cls.role }, action);

/**
 * The class's subtitle: section, program, term and institution, leaving out empty parts and
 * anything the class name already says (so "BS Computer Science · 5A" is not followed by
 * "5A · BS Computer Science").
 */
export function classSubtitle(
  cls: Pick<ClassForMember, 'name' | 'section' | 'program' | 'term' | 'institution'>,
) {
  const name = cls.name.toLocaleLowerCase();
  return [cls.section, cls.program, cls.term, cls.institution]
    .filter(
      (part): part is string => Boolean(part) && !name.includes(String(part).toLocaleLowerCase()),
    )
    .join(' · ');
}
