import { addDays, dayKeyOf, dayOfWeekOf, eachDay } from '@sabaq/shared';
import { useEffect, useState } from 'react';

/** Today's calendar day in the person's time zone. */
export const todayKey = (timeZone: string, now = new Date()) => dayKeyOf(now, timeZone);

/** The first day of the week containing `day`, given the week's first weekday (0 is Sunday). */
export function startOfWeek(day: string, weekStartsOn: number): string {
  return addDays(day, -((dayOfWeekOf(day) - weekStartsOn + 7) % 7));
}

export function weekRange(day: string, weekStartsOn: number) {
  const from = startOfWeek(day, weekStartsOn);
  return { from, to: addDays(from, 6), days: eachDay(from, addDays(from, 6)) };
}

/** The weeks shown for the month containing `day`, from the first week's start to the last's end. */
export function monthGrid(day: string, weekStartsOn: number) {
  const first = `${day.slice(0, 7)}-01`;
  const [year, month] = first.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const from = startOfWeek(first, weekStartsOn);
  const to = addDays(startOfWeek(last, weekStartsOn), 6);
  const days = eachDay(from, to);
  const weeks: string[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return { from, to, weeks, month: first.slice(0, 7) };
}

/** A calendar day in words, such as "Friday, 28 November", in the interface language. */
export function formatDay(
  day: string,
  language: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

/** A clock that ticks every minute, so countdowns stay true while the page is open. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
