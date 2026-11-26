/** "3 minutes ago", "yesterday" … in the interface language. */
export function relativeTime(iso: string, language: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

/**
 * A moment in words, in the person's time zone and clock: "Friday, 28 November, 11:59 PM".
 * The year is added only when it is not the current one.
 */
export function formatWhen(
  iso: string,
  language: string,
  timeZone: string,
  timeFormat: '12h' | '24h',
  now = new Date(),
): string {
  const instant = new Date(iso);
  const year = (date: Date) =>
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(date);
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(year(instant) !== year(now) && { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone,
  }).format(instant);
}
