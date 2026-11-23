import {
  type Actor,
  can,
  type ClassAction,
  type ClassForMember,
  type Course,
  type CreateClassInput,
  type CreateCourseInput,
  generateJoinCode,
  type Member,
  type MembershipRole,
  normalizeJoinCode,
  type UpdateClassInput,
  type UpdateCourseInput,
} from '@sabaq/shared';
import { type HydratedDocument, isValidObjectId, type Types } from 'mongoose';
import {
  ClassModel,
  type ClassRecord,
  CourseModel,
  type CourseRecord,
  MembershipModel,
  type MembershipRecord,
  UserModel,
} from '../db/models/index.js';
import { AppError } from '../lib/errors.js';

const MANAGER_ROLES: readonly MembershipRole[] = ['instructor', 'class_rep'];
const ROLE_ORDER: Record<MembershipRole, number> = { instructor: 0, class_rep: 1, student: 2 };

/** The signed-in person's relationship to one class, resolved once per request. */
export interface ClassAccess {
  userId: string;
  actor: Actor;
  classDoc: HydratedDocument<ClassRecord>;
  membership: HydratedDocument<MembershipRecord> | null;
}

const notFound = () =>
  new AppError('not_found', 'This class does not exist, or you are not a member of it.');
const forbidden = (message = 'You do not have permission to do that in this class.') =>
  new AppError('forbidden', message);

/** Course codes are unique within a class; the database reports duplicates as error 11000. */
const isDuplicate = (error: unknown) => (error as { code?: unknown }).code === 11000;
const duplicateCourse = () =>
  new AppError('validation_failed', 'Some fields are not valid.', {
    issues: [
      {
        path: 'code',
        code: 'duplicate',
        message: 'A course with this code already exists in the class.',
      },
    ],
  });

function serializeCourse(course: HydratedDocument<CourseRecord>): Course {
  const { schedule } = course.toObject();
  return {
    id: String(course._id),
    classId: String(course.classId),
    code: course.code,
    title: course.title,
    instructorName: course.instructorName,
    color: course.color,
    schedule: schedule.map(({ kind, dayOfWeek, start, end, venue }) => ({
      kind,
      dayOfWeek,
      start,
      end,
      venue,
    })),
    createdAt: course.createdAt.toISOString(),
  };
}

/** Classes, memberships and courses, with every permission rule in one place. */
export class ClassService {
  // ---- Access -----------------------------------------------------------------------------

  /** Resolves a class for a person; non-members (other than admins) cannot tell it exists. */
  async access(userId: string, classId: string): Promise<ClassAccess> {
    if (!isValidObjectId(classId)) throw notFound();
    const [user, classDoc, membership] = await Promise.all([
      UserModel.findById(userId),
      ClassModel.findOne({ _id: classId, archivedAt: null }),
      MembershipModel.findOne({ classId, userId }),
    ]);
    if (!user || !classDoc) throw notFound();
    if (!membership && user.platformRole !== 'admin') throw notFound();
    return {
      userId,
      classDoc,
      membership,
      actor: { platformRole: user.platformRole, membershipRole: membership?.role ?? null },
    };
  }

  private require(access: ClassAccess, action: ClassAction, message?: string) {
    if (!can(access.actor, action)) throw forbidden(message);
  }

  private async serializeClass(access: ClassAccess): Promise<ClassForMember> {
    const { classDoc, actor } = access;
    const memberCount = await MembershipModel.countDocuments({ classId: classDoc._id });
    return {
      id: String(classDoc._id),
      name: classDoc.name,
      section: classDoc.section,
      program: classDoc.program,
      term: classDoc.term,
      institution: classDoc.institution,
      timeZone: classDoc.timeZone,
      memberCount,
      createdAt: classDoc.createdAt.toISOString(),
      // Admins without a membership see the class as an instructor would.
      role: actor.membershipRole ?? 'instructor',
      joinCode: can(actor, 'class.view_join_code') ? classDoc.joinCode : null,
    };
  }

  // ---- Classes ----------------------------------------------------------------------------

  async listForUser(userId: string): Promise<ClassForMember[]> {
    const memberships = await MembershipModel.find({ userId }).sort({ joinedAt: -1 });
    const classes = await ClassModel.find({
      _id: { $in: memberships.map((membership) => membership.classId) },
      archivedAt: null,
    });
    const counts = await MembershipModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { classId: { $in: classes.map((item) => item._id) } } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]);
    const countOf = new Map(counts.map((entry) => [String(entry._id), entry.count]));
    const byId = new Map(classes.map((item) => [String(item._id), item]));
    return memberships.flatMap((membership) => {
      const classDoc = byId.get(String(membership.classId));
      if (!classDoc) return [];
      const actor: Actor = { platformRole: 'user', membershipRole: membership.role };
      return [
        {
          id: String(classDoc._id),
          name: classDoc.name,
          section: classDoc.section,
          program: classDoc.program,
          term: classDoc.term,
          institution: classDoc.institution,
          timeZone: classDoc.timeZone,
          memberCount: countOf.get(String(classDoc._id)) ?? 0,
          createdAt: classDoc.createdAt.toISOString(),
          role: membership.role,
          joinCode: can(actor, 'class.view_join_code') ? classDoc.joinCode : null,
        },
      ];
    });
  }

  /** Creates a class with a fresh join code; the creator becomes its first manager. */
  async create(userId: string, { myRole, ...input }: CreateClassInput): Promise<ClassForMember> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const classDoc = await ClassModel.create({
          ...input,
          section: input.section ?? null,
          institution: input.institution ?? null,
          joinCode: generateJoinCode(),
          createdBy: userId,
        });
        await MembershipModel.create({ classId: classDoc._id, userId, role: myRole });
        return await this.serializeClass(await this.access(userId, String(classDoc._id)));
      } catch (error) {
        // A new code that collides with an existing one: try another.
        if (!isDuplicate(error)) throw error;
      }
    }
    throw new AppError(
      'service_unavailable',
      'Could not create a unique join code. Please try again.',
    );
  }

  async get(access: ClassAccess): Promise<ClassForMember> {
    return this.serializeClass(access);
  }

  async update(access: ClassAccess, input: UpdateClassInput): Promise<ClassForMember> {
    this.require(
      access,
      'class.update',
      'Only instructors and class representatives can edit the class.',
    );
    access.classDoc.set(input);
    await access.classDoc.save();
    return this.serializeClass(access);
  }

  /** Archives the class (its data is kept). Allowed for instructors and the class's creator. */
  async archive(access: ClassAccess): Promise<void> {
    const isCreator =
      String(access.classDoc.createdBy) === access.userId && access.membership !== null;
    if (!isCreator) this.require(access, 'class.delete', 'Only instructors can remove the class.');
    access.classDoc.archivedAt = new Date();
    await access.classDoc.save();
  }

  /** Joins with a code; joining a class you are already in simply opens it. */
  async join(userId: string, code: string): Promise<{ class: ClassForMember; joined: boolean }> {
    const classDoc = await ClassModel.findOne({
      joinCode: normalizeJoinCode(code),
      archivedAt: null,
    });
    if (!classDoc) {
      throw new AppError('join_code_invalid', 'No class uses this code.');
    }
    const existing = await MembershipModel.exists({ classId: classDoc._id, userId });
    if (!existing) {
      try {
        await MembershipModel.create({ classId: classDoc._id, userId, role: 'student' });
      } catch (error) {
        if (!isDuplicate(error)) throw error;
      }
    }
    return {
      class: await this.serializeClass(await this.access(userId, String(classDoc._id))),
      joined: !existing,
    };
  }

  /** Replaces the join code, so an old code that was shared too widely stops working. */
  async regenerateJoinCode(access: ClassAccess): Promise<ClassForMember> {
    this.require(access, 'class.regenerate_join_code');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        access.classDoc.joinCode = generateJoinCode();
        await access.classDoc.save();
        return await this.serializeClass(access);
      } catch (error) {
        if (!isDuplicate(error)) throw error;
      }
    }
    throw new AppError(
      'service_unavailable',
      'Could not create a unique join code. Please try again.',
    );
  }

  // ---- Members ----------------------------------------------------------------------------

  async members(access: ClassAccess): Promise<Member[]> {
    const memberships = await MembershipModel.find({ classId: access.classDoc._id });
    const users = await UserModel.find({
      _id: { $in: memberships.map((membership) => membership.userId) },
    });
    const byId = new Map(users.map((user) => [String(user._id), user]));
    return memberships
      .flatMap((membership) => {
        const user = byId.get(String(membership.userId));
        return user
          ? [
              {
                user: { id: String(user._id), name: user.name, avatarUrl: user.avatarUrl },
                role: membership.role,
                joinedAt: membership.joinedAt.toISOString(),
              },
            ]
          : [];
      })
      .sort(
        (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user.name.localeCompare(b.user.name),
      );
  }

  private async target(access: ClassAccess, userId: string) {
    if (!isValidObjectId(userId))
      throw new AppError('not_found', 'This person is not in the class.');
    const membership = await MembershipModel.findOne({ classId: access.classDoc._id, userId });
    if (!membership) throw new AppError('not_found', 'This person is not in the class.');
    return membership;
  }

  /** A class must always keep someone who can manage it. */
  private async assertNotLastManager(
    access: ClassAccess,
    membership: HydratedDocument<MembershipRecord>,
  ) {
    if (!MANAGER_ROLES.includes(membership.role)) return;
    const managers = await MembershipModel.countDocuments({
      classId: access.classDoc._id,
      role: { $in: MANAGER_ROLES },
    });
    if (managers <= 1) {
      throw new AppError(
        'last_manager',
        'A class needs at least one instructor or class representative.',
      );
    }
  }

  /** Only instructors (and admins) may make someone an instructor or change an instructor. */
  private requireInstructorFor(access: ClassAccess, ...roles: MembershipRole[]) {
    if (!roles.includes('instructor')) return;
    if (access.actor.platformRole === 'admin' || access.actor.membershipRole === 'instructor')
      return;
    throw forbidden('Only instructors can change an instructor’s role.');
  }

  async changeRole(access: ClassAccess, userId: string, role: MembershipRole): Promise<Member[]> {
    this.require(
      access,
      'class.manage_members',
      'Only instructors and class representatives can change roles.',
    );
    const membership = await this.target(access, userId);
    if (membership.role === role) return this.members(access);
    this.requireInstructorFor(access, membership.role, role);
    if (!MANAGER_ROLES.includes(role)) await this.assertNotLastManager(access, membership);
    membership.role = role;
    await membership.save();
    return this.members(access);
  }

  /** Removes someone from the class; removing yourself is leaving it. */
  async removeMember(access: ClassAccess, userId: string): Promise<void> {
    const leaving = userId === access.userId;
    if (!leaving)
      this.require(
        access,
        'class.manage_members',
        'Only instructors and class representatives can remove members.',
      );
    const membership = await this.target(access, userId);
    if (!leaving) this.requireInstructorFor(access, membership.role);
    await this.assertNotLastManager(access, membership);
    await membership.deleteOne();
  }

  // ---- Courses ----------------------------------------------------------------------------

  async courses(access: ClassAccess): Promise<Course[]> {
    const courses = await CourseModel.find({ classId: access.classDoc._id }).sort({ code: 1 });
    return courses.map(serializeCourse);
  }

  async createCourse(access: ClassAccess, input: CreateCourseInput): Promise<Course> {
    this.require(
      access,
      'course.manage',
      'Only instructors and class representatives can add courses.',
    );
    try {
      return serializeCourse(await CourseModel.create({ ...input, classId: access.classDoc._id }));
    } catch (error) {
      if (isDuplicate(error)) throw duplicateCourse();
      throw error;
    }
  }

  private async course(access: ClassAccess, courseId: string) {
    const course = isValidObjectId(courseId)
      ? await CourseModel.findOne({ _id: courseId, classId: access.classDoc._id })
      : null;
    if (!course) throw new AppError('not_found', 'This course does not exist in the class.');
    return course;
  }

  async updateCourse(
    access: ClassAccess,
    courseId: string,
    input: UpdateCourseInput,
  ): Promise<Course> {
    this.require(
      access,
      'course.manage',
      'Only instructors and class representatives can edit courses.',
    );
    const course = await this.course(access, courseId);
    course.set(input);
    try {
      await course.save();
    } catch (error) {
      if (isDuplicate(error)) throw duplicateCourse();
      throw error;
    }
    return serializeCourse(course);
  }

  async deleteCourse(access: ClassAccess, courseId: string): Promise<void> {
    this.require(
      access,
      'course.manage',
      'Only instructors and class representatives can remove courses.',
    );
    await (await this.course(access, courseId)).deleteOne();
  }
}
