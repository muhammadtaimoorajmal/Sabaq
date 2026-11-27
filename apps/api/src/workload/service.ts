import {
  addDays,
  can,
  computeDailyLoad,
  type CourseSummary,
  type Workload,
  type WorkloadItem,
  type WorkloadQuery,
  zonedDateTime,
} from '@sabaq/shared';
import { Types } from 'mongoose';
import {
  ClassModel,
  CourseModel,
  MembershipModel,
  TaskModel,
  UserModel,
} from '../db/models/index.js';
import type { ClassService } from '../classes/service.js';
import { AppError } from '../lib/errors.js';

interface ClassDoc {
  _id: Types.ObjectId;
  name: string;
}

/**
 * How heavy each day is. Load comes from every task due that day, weighted by its effort (see
 * the shared workload domain), so heavy days stand out before anyone is overloaded.
 */
export class WorkloadService {
  constructor(private readonly classes: ClassService) {}

  /** A person's workload: tasks from all their classes, plus their personal tasks. */
  async mine(userId: string, range: WorkloadQuery): Promise<Workload> {
    const user = await UserModel.findById(userId, { preferences: 1 });
    if (!user) {
      throw new AppError('session_expired', 'Your session has ended. Please sign in again.');
    }
    const memberships = await MembershipModel.find({ userId });
    const classes = await ClassModel.find({
      _id: { $in: memberships.map((item) => item.classId) },
      archivedAt: null,
    });
    return this.build(
      {
        $or: [
          { classId: { $in: classes.map((item) => item._id) } },
          { ownerId: new Types.ObjectId(userId) },
        ],
      },
      classes,
      range,
      user.preferences.timeZone,
    );
  }

  /** A class's workload across all its courses, in the class's time zone. */
  async ofClass(userId: string, classId: string, range: WorkloadQuery): Promise<Workload> {
    const access = await this.classes.access(userId, classId);
    if (!can(access.actor, 'workload.view_class')) {
      throw new AppError('forbidden', 'You cannot see this class’s workload.');
    }
    const { classDoc } = access;
    return this.build(
      { classId: classDoc._id, ownerId: null },
      [classDoc],
      range,
      classDoc.timeZone,
    );
  }

  private async build(
    filter: Record<string, unknown>,
    classes: readonly ClassDoc[],
    range: WorkloadQuery,
    timeZone: string,
  ): Promise<Workload> {
    const start = zonedDateTime(range.from, '00:00', timeZone);
    const end = zonedDateTime(addDays(range.to, 1), '00:00', timeZone);
    const tasks = await TaskModel.find({ ...filter, dueAt: { $gte: start, $lt: end } }).sort({
      dueAt: 1,
    });
    const courseIds = tasks.flatMap((task) => (task.courseId ? [task.courseId] : []));
    const courses = await CourseModel.find({ _id: { $in: courseIds } });
    const courseOf = new Map(
      courses.map((course): [string, CourseSummary] => [
        String(course._id),
        { id: String(course._id), code: course.code, title: course.title, color: course.color },
      ]),
    );
    const classOf = new Map(classes.map((item) => [String(item._id), item.name]));

    const items: WorkloadItem[] = tasks.map((task) => ({
      id: String(task._id),
      title: task.title,
      type: task.type,
      dueAt: task.dueAt.toISOString(),
      effort: task.effort,
      course: task.courseId ? (courseOf.get(String(task.courseId)) ?? null) : null,
      classId: task.classId ? String(task.classId) : null,
      className: task.classId ? (classOf.get(String(task.classId)) ?? null) : null,
    }));
    return {
      timeZone,
      from: range.from,
      to: range.to,
      days: computeDailyLoad(items, { from: range.from, to: range.to, timeZone }),
      items,
    };
  }
}
