import {
  addDays,
  type Agenda,
  type AgendaQuery,
  type AgendaTask,
  can,
  canManageItem,
  type CourseSummary,
  type CreateTaskInput,
  plannedSessions,
  type SubmissionRule,
  type UpdateTaskInput,
  zonedDateTime,
} from '@sabaq/shared';
import { type HydratedDocument, isValidObjectId, Types } from 'mongoose';
import {
  AnnouncementModel,
  ClassModel,
  CourseModel,
  MembershipModel,
  type SubmissionRuleRecord,
  TaskCompletionModel,
  TaskModel,
  type TaskRecord,
  UserModel,
} from '../db/models/index.js';
import { AppError } from '../lib/errors.js';

type TaskDocument = HydratedDocument<TaskRecord>;

interface TaskContext {
  userId: string;
  completedAt: Date | null;
  course: CourseSummary | null;
  className: string | null;
  classSection: string | null;
  role: string | null;
  platformRole: string;
}

/** Overdue work older than this no longer appears in the agenda. */
export const OVERDUE_WINDOW_DAYS = 30;

const notFound = () => new AppError('not_found', 'This task does not exist, or you cannot see it.');
const invalidCourse = () =>
  new AppError('validation_failed', 'Some fields are not valid.', {
    issues: [
      { path: 'courseId', code: 'not_found', message: 'This course is not in your classes.' },
    ],
  });

export function serializeRule(rule: SubmissionRuleRecord | null): SubmissionRule | null {
  if (!rule) return null;
  const { kind, graceMinutes, penaltyPercent } = rule.latePolicy;
  return {
    namingPattern: rule.namingPattern,
    caseSensitive: rule.caseSensitive,
    allowedExtensions: [...rule.allowedExtensions],
    maxSizeMB: rule.maxSizeMB,
    channel: { kind: rule.channel.kind, label: rule.channel.label, url: rule.channel.url },
    latePolicy:
      kind === 'penalty'
        ? { kind, graceMinutes, penaltyPercent: penaltyPercent ?? 1 }
        : { kind, graceMinutes },
  };
}

/** What a person sees for a day, a week or a month: their tasks and their class meetings. */
export class TaskService {
  private readonly now: () => Date;

  constructor({ now = () => new Date() }: { now?: () => Date } = {}) {
    this.now = now;
  }

  async agenda(userId: string, { from, to }: AgendaQuery): Promise<Agenda> {
    const user = await UserModel.findById(userId, { preferences: 1, platformRole: 1 });
    if (!user)
      throw new AppError('session_expired', 'Your session has ended. Please sign in again.');
    const timeZone = user.preferences.timeZone;
    const now = this.now();
    const start = zonedDateTime(from, '00:00', timeZone);
    const end = zonedDateTime(addDays(to, 1), '00:00', timeZone);
    const overdueSince = new Date(now.getTime() - OVERDUE_WINDOW_DAYS * 86_400_000);

    const { classes, memberships } = await this.classesOf(userId);
    const classIds = classes.map((item) => item._id);
    const [courses, tasks, changes] = await Promise.all([
      CourseModel.find({ classId: { $in: classIds } }),
      TaskModel.find({
        $and: [
          { $or: [{ classId: { $in: classIds } }, { ownerId: new Types.ObjectId(userId) }] },
          {
            $or: [
              { dueAt: { $gte: start, $lt: end } },
              { dueAt: { $gte: overdueSince, $lt: now } },
            ],
          },
        ],
      }).sort({ dueAt: 1 }),
      AnnouncementModel.find({
        classId: { $in: classIds },
        type: { $in: ['cancellation', 'venue_change'] },
        startsAt: {
          $gte: new Date(start.getTime() - 86_400_000),
          $lt: new Date(end.getTime() + 86_400_000),
        },
      }),
    ]);
    const completions = await TaskCompletionModel.find({
      userId,
      taskId: { $in: tasks.map((task) => task._id) },
    });
    const completedAt = new Map(completions.map((item) => [String(item.taskId), item.completedAt]));
    const courseOf = new Map(courses.map((course) => [String(course._id), course]));
    const classOf = new Map(classes.map((item) => [String(item._id), item]));
    const roleIn = new Map(memberships.map((item) => [String(item.classId), item.role]));
    const summary = (id: Types.ObjectId | null): CourseSummary | null => {
      const course = id ? courseOf.get(String(id)) : undefined;
      return course
        ? { id: String(course._id), code: course.code, title: course.title, color: course.color }
        : null;
    };

    const visible = tasks.filter((task) => {
      const inRange = task.dueAt >= start && task.dueAt < end;
      // Overdue work outside the range shows only while unfinished.
      return inRange || !completedAt.has(String(task._id));
    });

    const sessions = plannedSessions(
      courses.map((course) => ({
        id: String(course._id),
        classId: String(course.classId),
        timeZone: classOf.get(String(course.classId))?.timeZone ?? timeZone,
        schedule: course.schedule.map(({ kind, dayOfWeek, start: begin, end: finish, venue }) => ({
          kind,
          dayOfWeek,
          start: begin,
          end: finish,
          venue,
        })),
      })),
      changes.flatMap((change) =>
        change.startsAt && (change.type === 'cancellation' || change.type === 'venue_change')
          ? [
              {
                id: String(change._id),
                classId: String(change.classId),
                courseId: change.courseId ? String(change.courseId) : null,
                type: change.type,
                startsAt: change.startsAt.toISOString(),
                venue: change.venue,
              },
            ]
          : [],
      ),
      from,
      to,
      timeZone,
    );

    return {
      timeZone,
      from,
      to,
      tasks: visible.map((task) =>
        this.serialize(task, {
          userId,
          completedAt: completedAt.get(String(task._id)) ?? null,
          course: summary(task.courseId),
          className: task.classId ? (classOf.get(String(task.classId))?.name ?? null) : null,
          classSection: task.classId ? (classOf.get(String(task.classId))?.section ?? null) : null,
          role: task.classId ? (roleIn.get(String(task.classId)) ?? null) : null,
          platformRole: user.platformRole,
        }),
      ),
      sessions: sessions.map((session) => ({
        id: `${session.courseId}:${session.startsAt}`,
        classId: session.classId,
        className: classOf.get(session.classId)?.name ?? '',
        course: summary(new Types.ObjectId(session.courseId)) as CourseSummary,
        kind: session.kind,
        day: session.day,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        venue: session.venue,
        originalVenue: session.originalVenue,
        status: session.status,
        announcementId: session.changeId,
      })),
    };
  }

  /** Adds a personal task, visible to its owner only. */
  async create(userId: string, input: CreateTaskInput): Promise<AgendaTask> {
    const course = await this.ownCourse(userId, input.courseId);
    const task = await TaskModel.create({
      classId: null,
      ownerId: new Types.ObjectId(userId),
      announcementId: null,
      courseId: input.courseId,
      title: input.title,
      type: input.type,
      dueAt: new Date(input.dueAt),
      description: input.description,
      effort: input.effort,
      submissionRule: input.submissionRule,
      createdBy: new Types.ObjectId(userId),
    });
    return this.serialize(task, {
      userId,
      completedAt: null,
      course,
      className: null,
      classSection: null,
      role: null,
      platformRole: 'user',
    });
  }

  /** One task the person can see, for its own page. */
  async get(userId: string, id: string): Promise<AgendaTask> {
    const task = await this.visible(userId, id);
    return this.serialize(task, await this.contextFor(userId, task));
  }

  /**
   * Sets (or, with `null`, removes) how a task must be submitted. Rules can be set on class tasks
   * created by announcements too: the announcement keeps its title and time, the task its rules.
   */
  async setRule(userId: string, id: string, rule: SubmissionRule | null): Promise<AgendaTask> {
    const task = await this.visible(userId, id);
    const context = await this.contextFor(userId, task);
    if (!this.canEditRule(task, context)) {
      throw new AppError(
        'forbidden',
        'Only instructors and class representatives can set submission rules for class tasks.',
      );
    }
    task.set({ submissionRule: rule });
    await task.save();
    return this.serialize(task, context);
  }

  async update(userId: string, id: string, input: UpdateTaskInput): Promise<AgendaTask> {
    const { task, context } = await this.manageable(userId, id);
    const course =
      input.courseId === undefined ? context.course : await this.ownCourse(userId, input.courseId);
    task.set({
      ...input,
      ...(input.dueAt !== undefined && { dueAt: new Date(input.dueAt) }),
      ...(input.courseId !== undefined && {
        courseId: input.courseId ? new Types.ObjectId(input.courseId) : null,
      }),
    });
    await task.save();
    return this.serialize(task, { ...context, course });
  }

  async remove(userId: string, id: string): Promise<void> {
    const { task } = await this.manageable(userId, id);
    await Promise.all([
      TaskModel.deleteOne({ _id: task._id }),
      TaskCompletionModel.deleteMany({ taskId: task._id }),
    ]);
  }

  /** Marks a task done for this person (class tasks are done per student). */
  async complete(userId: string, id: string): Promise<{ completedAt: string }> {
    const task = await this.visible(userId, id);
    const record = await TaskCompletionModel.findOneAndUpdate(
      { taskId: task._id, userId },
      { $setOnInsert: { taskId: task._id, userId, completedAt: this.now() } },
      { upsert: true, returnDocument: 'after' },
    );
    return { completedAt: (record as { completedAt: Date }).completedAt.toISOString() };
  }

  async uncomplete(userId: string, id: string): Promise<void> {
    const task = await this.visible(userId, id);
    await TaskCompletionModel.deleteOne({ taskId: task._id, userId });
  }

  // ---- Internals --------------------------------------------------------------------------

  private async classesOf(userId: string) {
    const memberships = await MembershipModel.find({ userId });
    const classes = await ClassModel.find({
      _id: { $in: memberships.map((item) => item.classId) },
      archivedAt: null,
    });
    return { classes, memberships };
  }

  /** A course from one of the person's classes, as a summary; `null` for none. */
  private async ownCourse(userId: string, courseId: string | null): Promise<CourseSummary | null> {
    if (courseId === null) return null;
    const { classes } = await this.classesOf(userId);
    const course = isValidObjectId(courseId)
      ? await CourseModel.findOne({
          _id: courseId,
          classId: { $in: classes.map((item) => item._id) },
        })
      : null;
    if (!course) throw invalidCourse();
    return { id: String(course._id), code: course.code, title: course.title, color: course.color };
  }

  /** A task the person can see: their own, or one of their classes'. */
  private async visible(userId: string, id: string): Promise<TaskDocument> {
    const task = isValidObjectId(id) ? await TaskModel.findById(id) : null;
    if (!task) throw notFound();
    if (task.ownerId) {
      if (String(task.ownerId) !== userId) throw notFound();
      return task;
    }
    const member =
      task.classId &&
      (await MembershipModel.exists({ classId: task.classId, userId })) &&
      (await ClassModel.exists({ _id: task.classId, archivedAt: null }));
    if (!member) throw notFound();
    return task;
  }

  private async manageable(userId: string, id: string) {
    const task = await this.visible(userId, id);
    const context = await this.contextFor(userId, task);
    if (!this.canManage(task, context)) {
      throw new AppError(
        'forbidden',
        task.announcementId
          ? 'This task belongs to an announcement. Edit the announcement instead.'
          : 'Only instructors and class representatives can change class tasks.',
      );
    }
    return { task, context };
  }

  /** Everything about the person and the task's class that the response needs. */
  private async contextFor(userId: string, task: TaskDocument): Promise<TaskContext> {
    const [user, membership, completion, course, cls] = await Promise.all([
      UserModel.findById(userId, { platformRole: 1 }),
      task.classId ? MembershipModel.findOne({ classId: task.classId, userId }) : null,
      TaskCompletionModel.findOne({ taskId: task._id, userId }),
      task.courseId ? CourseModel.findById(task.courseId) : null,
      task.classId ? ClassModel.findById(task.classId) : null,
    ]);
    return {
      userId,
      completedAt: completion?.completedAt ?? null,
      course: course
        ? { id: String(course._id), code: course.code, title: course.title, color: course.color }
        : null,
      className: cls?.name ?? null,
      classSection: cls?.section ?? null,
      role: membership?.role ?? null,
      platformRole: user?.platformRole ?? 'user',
    };
  }

  private canEditRule(
    task: TaskDocument,
    context: { userId: string; role: string | null; platformRole: string },
  ): boolean {
    if (task.ownerId) return String(task.ownerId) === context.userId;
    return can(
      {
        platformRole: context.platformRole as 'user' | 'admin',
        membershipRole: context.role as 'student' | 'class_rep' | 'instructor' | null,
      },
      'task.create_for_class',
    );
  }

  private canManage(
    task: TaskDocument,
    context: { userId: string; role: string | null; platformRole: string },
  ): boolean {
    if (task.ownerId) return String(task.ownerId) === context.userId;
    if (task.announcementId) return false;
    return canManageItem(
      {
        userId: context.userId,
        platformRole: context.platformRole as 'user' | 'admin',
        membershipRole: context.role as 'student' | 'class_rep' | 'instructor' | null,
      },
      String(task.createdBy),
      'task',
    );
  }

  private serialize(task: TaskDocument, context: TaskContext): AgendaTask {
    return {
      id: String(task._id),
      classId: task.classId ? String(task.classId) : null,
      ownerId: task.ownerId ? String(task.ownerId) : null,
      announcementId: task.announcementId ? String(task.announcementId) : null,
      title: task.title,
      type: task.type,
      dueAt: task.dueAt.toISOString(),
      description: task.description,
      courseId: task.courseId ? String(task.courseId) : null,
      effort: task.effort,
      submissionRule: serializeRule(task.submissionRule),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: context.completedAt?.toISOString() ?? null,
      course: context.course,
      className: context.className,
      classSection: context.classSection,
      canManage: this.canManage(task, context),
      canEditRule: this.canEditRule(task, context),
    };
  }
}
