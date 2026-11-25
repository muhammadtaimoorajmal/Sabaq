import { addDays, dayKeyOf, dayOfWeekOf, zonedDateTime } from '@sabaq/shared';
import mongoose, { Types } from 'mongoose';
import {
  ALL_MODELS,
  AnnouncementModel,
  type AnnouncementRecord,
  AnnouncementReceiptModel,
  ClassModel,
  CourseModel,
  JoinRequestModel,
  MembershipModel,
  NotificationModel,
  type NotificationRecord,
  StudyGroupModel,
  StudySlotModel,
  TaskCompletionModel,
  TaskModel,
  type TaskRecord,
  UserModel,
} from '../models/index.js';
import {
  DEMO_ADMIN,
  DEMO_ANNOUNCEMENTS,
  DEMO_CLASS_REP,
  DEMO_COURSES,
  DEMO_INSTRUCTOR,
  DEMO_JOIN_CODE,
  DEMO_PERSONAL_TASKS,
  DEMO_STUDENT,
  DEMO_TASKS,
  DEMO_TIME_ZONE,
  type DemoCourse,
  type DemoPerson,
  OTHER_STUDENTS,
} from './demo-data.js';

export type SeedSummary = Record<string, number>;

type Id = Types.ObjectId;
type Stamped<T> = T & { _id: Id; createdAt: Date; updatedAt: Date };

const HOUR = 3_600_000;

/** Academic term for a date, such as "Fall 2026". */
export function termOf(date: Date): string {
  const month = date.getUTCMonth();
  const season = month >= 7 ? 'Fall' : month >= 5 ? 'Summer' : 'Spring';
  return `${season} ${date.getUTCFullYear()}`;
}

/** A stable pseudo-random choice, so the same students "see" announcements on every run. */
const picked = (studentIndex: number, salt: number, share: number) =>
  (studentIndex * 37 + salt * 17) % 100 < share * 100;

/** Share of students who have seen an announcement, by how many days ago it was posted. */
function seenShare(postedDaysAgo: number): number {
  if (postedDaysAgo >= 5) return 0.95;
  if (postedDaysAgo >= 2) return 0.8;
  if (postedDaysAgo >= 1) return 0.65;
  return 0.4;
}

/**
 * Fills an empty database with the demo institution. All dates are relative to `now`, so the
 * demo always shows upcoming deadlines, one overloaded day and a few overdue items.
 */
export async function seedDemoData({
  passwordHash,
  now = new Date(),
}: {
  passwordHash: string;
  now?: Date;
}): Promise<SeedSummary> {
  const timeZone = DEMO_TIME_ZONE;
  const today = dayKeyOf(now, timeZone);
  const at = (day: number, time: string) => zonedDateTime(addDays(today, day), time, timeZone);
  /** Never in the future: posts and receipts cannot be dated after `now`. */
  const past = (date: Date) => new Date(Math.min(date.getTime(), now.getTime() - 5 * 60_000));
  const stamp = (date: Date) => ({ createdAt: date, updatedAt: date });

  // People -------------------------------------------------------------------------------
  const joined = past(at(-60, '10:00'));
  const userIds = new Map<string, Id>();
  const toUser = (person: DemoPerson, platformRole: 'user' | 'admin' = 'user') => {
    const _id = new Types.ObjectId();
    userIds.set(person.email, _id);
    return {
      _id,
      name: person.name,
      email: person.email,
      emailVerified: true,
      passwordHash,
      studentId: person.studentId,
      platformRole,
      preferences: { timeZone },
      onboardedAt: joined,
      ...stamp(joined),
    };
  };
  const students = [DEMO_CLASS_REP, DEMO_STUDENT, ...OTHER_STUDENTS];
  await UserModel.insertMany([
    toUser(DEMO_ADMIN, 'admin'),
    toUser(DEMO_INSTRUCTOR),
    ...students.map((student) => toUser(student)),
  ]);
  const idOf = (person: DemoPerson) => userIds.get(person.email) as Id;
  const instructorId = idOf(DEMO_INSTRUCTOR);
  const repId = idOf(DEMO_CLASS_REP);
  const studentId = idOf(DEMO_STUDENT);
  const authorId = (by: 'instructor' | 'class_rep') => (by === 'instructor' ? instructorId : repId);

  // Class and courses ---------------------------------------------------------------------
  const classId = new Types.ObjectId();
  await ClassModel.create({
    _id: classId,
    name: 'BS Computer Science · 5A',
    section: '5A',
    program: 'BS Computer Science',
    term: termOf(now),
    institution: 'Northfield University',
    timeZone,
    joinCode: DEMO_JOIN_CODE,
    createdBy: instructorId,
    ...stamp(joined),
  });
  await MembershipModel.insertMany([
    { classId, userId: instructorId, role: 'instructor', joinedAt: joined },
    ...students.map((student) => ({
      classId,
      userId: idOf(student),
      role: student === DEMO_CLASS_REP ? 'class_rep' : 'student',
      joinedAt: joined,
    })),
  ]);

  const courseIds = new Map<string, Id>();
  await CourseModel.insertMany(
    DEMO_COURSES.map((course) => {
      const _id = new Types.ObjectId();
      courseIds.set(course.code, _id);
      return { _id, classId, ...course, ...stamp(joined) };
    }),
  );
  const courseId = (code: string) => courseIds.get(code) as Id;
  const courseByCode = new Map(DEMO_COURSES.map((course) => [course.code, course]));

  /** The course's next timetabled session after today, with its venue. */
  const nextSession = (course: DemoCourse) => {
    for (let day = 1; day <= 7; day += 1) {
      const session = course.schedule.find(
        (entry) => entry.dayOfWeek === dayOfWeekOf(addDays(today, day)),
      );
      if (session) return { startsAt: at(day, session.start), venue: session.venue };
    }
    throw new Error(`${course.code} has no timetabled sessions`);
  };

  // Class tasks and the announcements that created them ------------------------------------
  const tasks: Stamped<TaskRecord>[] = [];
  const announcements: Stamped<AnnouncementRecord>[] = [];
  const taskIds = new Map<string, Id>();
  const announcementIdsByTask = new Map<string, Id>();

  for (const plan of DEMO_TASKS) {
    const course = courseByCode.get(plan.course) as DemoCourse;
    const dueAt = at(plan.day, plan.time);
    const postedAt = past(at(Math.max(plan.day - 10, -8), '18:30'));
    const taskId = new Types.ObjectId();
    taskIds.set(plan.key, taskId);
    const announcementId = plan.announcedBy ? new Types.ObjectId() : null;
    const createdBy = plan.announcedBy ? authorId(plan.announcedBy) : repId;

    tasks.push({
      _id: taskId,
      classId,
      ownerId: null,
      announcementId,
      courseId: courseId(plan.course),
      title: plan.title,
      type: plan.type,
      dueAt,
      description: plan.description,
      effort: null,
      submissionRule: plan.submissionRule,
      createdBy,
      ...stamp(postedAt),
    });

    if (announcementId && plan.announcedBy) {
      announcementIdsByTask.set(plan.key, announcementId);
      const isAssessment = ['quiz', 'exam', 'presentation'].includes(plan.type);
      // One deadline was extended after posting, to demonstrate the visible edit history.
      const extended = plan.key === 'hci-a2';
      const editedAt = past(new Date(postedAt.getTime() + 24 * HOUR));
      announcements.push({
        _id: announcementId,
        classId,
        authorId: createdBy,
        type: isAssessment ? 'assessment' : 'deadline',
        courseId: courseId(plan.course),
        title: plan.title,
        body: extended
          ? `${plan.description}\n\nUpdate: the deadline has been extended by two days.`
          : plan.description,
        links: [],
        pinned: false,
        dueAt,
        startsAt: null,
        venue: isAssessment ? (course.schedule[0]?.venue ?? null) : null,
        taskId,
        edits: extended
          ? [{ editedAt, editedBy: createdBy, changedFields: ['dueAt', 'body'] }]
          : [],
        createdAt: postedAt,
        updatedAt: extended ? editedAt : postedAt,
      });
    }
  }

  // Announcements without a task -----------------------------------------------------------
  for (const plan of DEMO_ANNOUNCEMENTS) {
    const postedAt = past(at(plan.postedDay, plan.postedDay === 0 ? '08:00' : '17:00'));
    const course = plan.course ? (courseByCode.get(plan.course) as DemoCourse) : null;
    const session = plan.appliesToNextSession && course ? nextSession(course) : null;
    const _id = new Types.ObjectId();
    announcements.push({
      _id,
      classId,
      authorId: authorId(plan.by),
      type: plan.type,
      courseId: plan.course ? courseId(plan.course) : null,
      title: plan.title,
      body: plan.body,
      links: plan.links ?? [],
      pinned: plan.pinned ?? false,
      dueAt: null,
      startsAt: session?.startsAt ?? null,
      venue: plan.venue ?? null,
      taskId: null,
      edits: [],
      ...stamp(postedAt),
    });
  }

  // Personal tasks for the demo student ----------------------------------------------------
  for (const plan of DEMO_PERSONAL_TASKS) {
    const _id = new Types.ObjectId();
    taskIds.set(plan.key, _id);
    tasks.push({
      _id,
      classId: null,
      ownerId: studentId,
      announcementId: null,
      courseId: null,
      title: plan.title,
      type: plan.type,
      dueAt: at(plan.day, plan.time),
      description: '',
      effort: null,
      submissionRule: null,
      createdBy: studentId,
      ...stamp(past(at(-1, '21:00'))),
    });
  }

  await TaskModel.insertMany(tasks);
  await AnnouncementModel.insertMany(announcements);

  // Receipts: older announcements have been seen by more students --------------------------
  const receipts = announcements.flatMap((announcement, salt) => {
    const daysAgo = (now.getTime() - announcement.createdAt.getTime()) / (24 * HOUR);
    const share = seenShare(Math.floor(daysAgo));
    const seenAt = past(new Date(announcement.createdAt.getTime() + 2 * HOUR));
    return students
      .filter((student, index) => {
        if (student === DEMO_STUDENT) return daysAgo >= 1;
        if (idOf(student).equals(announcement.authorId)) return true;
        return picked(index, salt, share);
      })
      .map((student) => ({
        announcementId: announcement._id,
        classId,
        userId: idOf(student),
        seenAt,
        ...stamp(seenAt),
      }));
  });
  await AnnouncementReceiptModel.insertMany(receipts);

  // Completed tasks ------------------------------------------------------------------------
  const demoStudentCompleted = new Set(['db-lab-9']);
  const completions = DEMO_TASKS.flatMap((plan, salt) =>
    students
      .filter((student, index) =>
        student === DEMO_STUDENT
          ? demoStudentCompleted.has(plan.key)
          : picked(index, salt + 50, plan.completedShare),
      )
      .map((student) => {
        const completedAt = past(new Date(at(plan.day, plan.time).getTime() - 20 * HOUR));
        return {
          taskId: taskIds.get(plan.key) as Id,
          userId: idOf(student),
          completedAt,
          ...stamp(completedAt),
        };
      }),
  );
  await TaskCompletionModel.insertMany(completions);

  // Study planner --------------------------------------------------------------------------
  const slot = (day: number, start: string, end: string, title: string, taskKey: string) => ({
    userId: studentId,
    taskId: taskIds.get(taskKey) ?? null,
    title,
    start: at(day, start),
    end: at(day, end),
    ...stamp(past(at(-1, '21:30'))),
  });
  await StudySlotModel.insertMany([
    slot(0, '19:00', '21:00', 'Finish Lab 10', 'db-lab-10'),
    slot(1, '17:00', '19:00', 'Heuristic evaluation: first pass', 'hci-a2'),
    slot(2, '18:00', '19:30', 'Subnetting practice', 'cn-a3'),
    slot(2, '20:00', '21:00', 'Sprint demo slides', 'own-slides'),
  ]);

  // Study groups ---------------------------------------------------------------------------
  const byName = (name: string) => {
    const found = students.find((candidate) => candidate.name === name);
    return idOf(found as DemoPerson);
  };
  const groupCreated = past(at(-10, '15:00'));
  const hciGroup = new Types.ObjectId();
  const networksGroup = new Types.ObjectId();
  await StudyGroupModel.insertMany([
    {
      _id: hciGroup,
      classId,
      courseId: courseId('CS-341'),
      ownerId: studentId,
      memberIds: [studentId, byName('Ali Raza'), byName('Fatima Noor'), byName('Omar Farooq')],
      name: 'Heuristic Hunters',
      topic: 'Working through Assignment 2 together: we split the heuristics and compare notes.',
      capacity: 5,
      place: { kind: 'in_person', location: 'Library, group room 3', url: null },
      meetings: [{ kind: 'other', dayOfWeek: 2, start: '16:00', end: '17:30', venue: 'Library' }],
      openToJoin: true,
      ...stamp(groupCreated),
    },
    {
      classId,
      courseId: courseId('CS-363'),
      ownerId: byName('Hira Shah'),
      memberIds: ['Hira Shah', 'Usman Ali', 'Maryam Iqbal', 'Sara Javed'].map(byName),
      name: 'SQL Sprint',
      topic: 'Daily 30-minute SQL practice before the midterm.',
      capacity: 4,
      place: { kind: 'online', location: null, url: 'https://meet.northfield.example/sql-sprint' },
      meetings: [{ kind: 'other', dayOfWeek: 0, start: '20:00', end: '20:30', venue: null }],
      openToJoin: true,
      ...stamp(groupCreated),
    },
    {
      _id: networksGroup,
      classId,
      courseId: courseId('CS-385'),
      ownerId: byName('Bilal Ahmed'),
      memberIds: [byName('Bilal Ahmed'), byName('Hassan Mirza')],
      name: 'Subnet Squad',
      topic: 'Practice problems for Assignment 3 and the networks quiz.',
      capacity: 6,
      place: { kind: 'online', location: null, url: 'https://meet.northfield.example/subnets' },
      meetings: [],
      openToJoin: true,
      ...stamp(groupCreated),
    },
  ]);
  const requested = past(at(0, '07:30'));
  await JoinRequestModel.insertMany([
    {
      groupId: networksGroup,
      userId: studentId,
      message: 'Can I join? I want to practise before Assignment 3.',
      ...stamp(requested),
    },
    {
      groupId: hciGroup,
      userId: byName('Noor Fatima'),
      message: 'I am also evaluating the admissions website. Happy to share my notes.',
      ...stamp(requested),
    },
  ]);

  // Notifications for the demo student -----------------------------------------------------
  const venueChange = announcements.find((item) => item.type === 'venue_change')?._id as Id;
  const announcementLink = (id: Id) => `/classes/${String(classId)}/announcements/${String(id)}`;
  const notification = (
    type: NotificationRecord['type'],
    params: NotificationRecord['params'],
    link: string,
    createdAt: Date,
    read: boolean,
  ) => ({
    userId: studentId,
    type,
    params,
    link,
    deliverAt: createdAt,
    readAt: read ? past(new Date(createdAt.getTime() + HOUR)) : null,
    ...stamp(createdAt),
  });
  await NotificationModel.insertMany([
    notification(
      'announcement.created',
      { title: 'Next HCI session moves to Auditorium 2', course: 'CS-341' },
      announcementLink(venueChange),
      past(at(0, '08:00')),
      false,
    ),
    notification(
      'task.due_soon',
      { title: 'Lab 10: Normalization exercises', course: 'CS-363' },
      `/tasks/${String(taskIds.get('db-lab-10'))}`,
      past(at(0, '09:00')),
      false,
    ),
    notification(
      'study_group.join_requested',
      { name: 'Noor Fatima', group: 'Heuristic Hunters' },
      `/study-groups/${String(hciGroup)}`,
      requested,
      false,
    ),
    notification(
      'announcement.updated',
      { title: 'Assignment 2: Heuristic evaluation', course: 'CS-341' },
      announcementLink(announcementIdsByTask.get('hci-a2') as Id),
      past(at(-6, '18:30')),
      true,
    ),
  ]);

  return {
    users: students.length + 2,
    classes: 1,
    memberships: students.length + 1,
    courses: DEMO_COURSES.length,
    tasks: tasks.length,
    announcements: announcements.length,
    receipts: receipts.length,
    completions: completions.length,
    studySlots: 4,
    studyGroups: 3,
    joinRequests: 2,
    notifications: 4,
  };
}

/** Collection names that belong to Sabaq. */
export const SABAQ_COLLECTIONS: ReadonlySet<string> = new Set(
  ALL_MODELS.map((model) => model.collection.collectionName),
);

export type PrepareResult = { ok: true; cleared: boolean } | { ok: false; reason: string };

/**
 * Makes sure seeding cannot harm anything: refuses databases that hold other applications'
 * collections, and refuses to replace existing Sabaq data unless `reset` is set.
 */
export async function prepareForSeed({ reset }: { reset: boolean }): Promise<PrepareResult> {
  const { db } = mongoose.connection;
  if (!db) throw new Error('Not connected to the database');
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith('system.'));
  const foreign = names.filter((name) => !SABAQ_COLLECTIONS.has(name));
  if (foreign.length > 0) {
    return {
      ok: false,
      reason: `The database "${db.databaseName}" also holds collections that do not belong to Sabaq (${foreign.join(', ')}). Set MONGODB_DB_NAME to a database used only by Sabaq.`,
    };
  }
  const counts = await Promise.all(ALL_MODELS.map((model) => model.countDocuments()));
  const hasData = counts.some((count) => count > 0);
  if (hasData && !reset) {
    return {
      ok: false,
      reason: `The database "${db.databaseName}" already contains Sabaq data. Run the command again with --reset to delete it and start over.`,
    };
  }
  if (hasData) await Promise.all(ALL_MODELS.map((model) => model.deleteMany()));
  return { ok: true, cleared: hasData };
}
