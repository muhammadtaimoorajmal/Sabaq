import { addDays, dayKeyOf, dayOfWeekOf, eachDay, toTimestamp, zonedDateTime } from './time.js';

/** A course and its weekly timetable, in its class's time zone. */
export interface AgendaCourseInput {
  id: string;
  classId: string;
  /** The class's time zone: timetable times are wall-clock times there. */
  timeZone: string;
  schedule: readonly {
    kind: 'lecture' | 'lab' | 'tutorial' | 'other';
    dayOfWeek: number;
    start: string;
    end: string;
    venue: string | null;
  }[];
}

/** An announced cancellation or room change. */
export interface SessionChange {
  id: string;
  classId: string;
  /** `null` for the whole class (every course that day). */
  courseId: string | null;
  type: 'cancellation' | 'venue_change';
  startsAt: string;
  venue: string | null;
}

export interface PlannedSession {
  courseId: string;
  classId: string;
  kind: AgendaCourseInput['schedule'][number]['kind'];
  /** The day in the viewer's time zone. */
  day: string;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  originalVenue: string | null;
  status: 'scheduled' | 'cancelled' | 'moved';
  changeId: string | null;
}

/**
 * Every class meeting from `from` to `to` (calendar days in the viewer's time zone), with
 * announcements applied: a cancellation cancels the meeting it names, and a venue change moves
 * it. A change applies to the meeting of its course on the same day in the class's time zone,
 * closest to the announced time; a cancellation for the whole class cancels every meeting that
 * day. Sessions are ordered by start time.
 */
export function plannedSessions(
  courses: readonly AgendaCourseInput[],
  changes: readonly SessionChange[],
  from: string,
  to: string,
  viewerTimeZone: string,
): PlannedSession[] {
  const sessions: PlannedSession[] = [];
  // Class time zones can differ from the viewer's, so look one day beyond each edge.
  const days = eachDay(addDays(from, -1), addDays(to, 1));
  for (const course of courses) {
    for (const classDay of days) {
      const weekday = dayOfWeekOf(classDay);
      for (const meeting of course.schedule) {
        if (meeting.dayOfWeek !== weekday) continue;
        const startsAt = zonedDateTime(classDay, meeting.start, course.timeZone).toISOString();
        const day = dayKeyOf(startsAt, viewerTimeZone);
        if (day < from || day > to) continue;
        sessions.push({
          courseId: course.id,
          classId: course.classId,
          kind: meeting.kind,
          day,
          startsAt,
          endsAt: zonedDateTime(classDay, meeting.end, course.timeZone).toISOString(),
          venue: meeting.venue,
          originalVenue: null,
          status: 'scheduled',
          changeId: null,
        });
      }
    }
  }

  const timeZoneOf = new Map(courses.map((course) => [course.classId, course.timeZone]));
  // Later announcements win, so apply them in order.
  const ordered = [...changes].sort((a, b) => toTimestamp(a.startsAt) - toTimestamp(b.startsAt));
  for (const change of ordered) {
    const timeZone = timeZoneOf.get(change.classId);
    if (!timeZone) continue;
    const changeDay = dayKeyOf(change.startsAt, timeZone);
    const candidates = sessions.filter(
      (session) =>
        session.classId === change.classId &&
        (change.courseId === null || session.courseId === change.courseId) &&
        dayKeyOf(session.startsAt, timeZone) === changeDay,
    );
    if (change.type === 'cancellation' && change.courseId === null) {
      for (const session of candidates) {
        session.status = 'cancelled';
        session.changeId = change.id;
      }
      continue;
    }
    const target = candidates.sort(
      (a, b) =>
        Math.abs(toTimestamp(a.startsAt) - toTimestamp(change.startsAt)) -
        Math.abs(toTimestamp(b.startsAt) - toTimestamp(change.startsAt)),
    )[0];
    if (!target) continue;
    target.changeId = change.id;
    if (change.type === 'cancellation') {
      target.status = 'cancelled';
    } else {
      target.originalVenue = target.originalVenue ?? target.venue;
      target.venue = change.venue;
      target.status = 'moved';
    }
  }
  return sessions.sort((a, b) => toTimestamp(a.startsAt) - toTimestamp(b.startsAt));
}
