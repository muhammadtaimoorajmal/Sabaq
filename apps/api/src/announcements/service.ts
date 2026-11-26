import {
  type AnnouncementFeedQuery,
  type AnnouncementForUser,
  type AnnouncementPage,
  type AnnouncementReceipts,
  can,
  canManageItem,
  changedAnnouncementFields,
  type CreateAnnouncementInput,
  deliveryTime,
  type EditableAnnouncementField,
  isImportantChange,
  type MembershipRole,
  type NotificationType,
  type UnreadCount,
  type UpdateAnnouncementInput,
  type UserSummary,
} from '@sabaq/shared';
import { type HydratedDocument, isValidObjectId, Types } from 'mongoose';
import type { Logger } from 'pino';
import type { ClassAccess } from '../classes/service.js';
import {
  AnnouncementModel,
  AnnouncementReceiptModel,
  type AnnouncementRecord,
  ClassModel,
  CourseModel,
  MembershipModel,
  NotificationModel,
  TaskCompletionModel,
  TaskModel,
  UserModel,
} from '../db/models/index.js';
import { AppError } from '../lib/errors.js';

type AnnouncementDocument = HydratedDocument<AnnouncementRecord>;

const notFound = () =>
  new AppError('not_found', 'This announcement does not exist, or you cannot see it.');
const forbidden = (message: string) => new AppError('forbidden', message);
const invalid = (path: string, code: string, message: string) =>
  new AppError('validation_failed', 'Some fields are not valid.', {
    issues: [{ path, code, message }],
  });

/** Which type-specific fields each announcement type may have. */
const FIELDS_BY_TYPE: Record<AnnouncementRecord['type'], readonly string[]> = {
  deadline: ['dueAt', 'taskType'],
  assessment: ['dueAt', 'taskType', 'venue'],
  venue_change: ['startsAt', 'venue'],
  cancellation: ['startsAt'],
  material: [],
  general: [],
};
const TYPE_SPECIFIC = ['dueAt', 'taskType', 'venue', 'startsAt'] as const;

/** The deep link that opens one announcement in its class. */
export const announcementLink = (classId: string, id: string) =>
  `/classes/${classId}?tab=announcements&announcement=${id}`;

/**
 * Structured announcements: posting (which turns deadlines into tasks for the whole class),
 * edits with a visible history, pinning, "seen by" receipts and the unread feed.
 */
export class AnnouncementService {
  private readonly logger: Logger;
  private readonly now: () => Date;

  constructor({ logger, now = () => new Date() }: { logger: Logger; now?: () => Date }) {
    this.logger = logger;
    this.now = now;
  }

  // ---- Reading ----------------------------------------------------------------------------

  /** Announcements from the person's classes, pinned first, then newest, with read state. */
  async feed(userId: string, query: AnnouncementFeedQuery): Promise<AnnouncementPage> {
    const classIds = await this.classIdsOf(userId);
    if (query.classId && !classIds.some((id) => id.equals(query.classId))) throw notFound();
    const scope = query.classId ? [new Types.ObjectId(query.classId)] : classIds;

    const filter: Record<string, unknown> = { classId: { $in: scope } };
    if (query.type) filter.type = query.type;
    if (query.q) filter.$text = { $search: query.q };
    if (query.unread) {
      const seen = await AnnouncementReceiptModel.distinct('announcementId', {
        userId,
        classId: { $in: scope },
      });
      filter._id = { $nin: seen };
      filter.authorId = { $ne: new Types.ObjectId(userId) };
    }

    const pinned = query.before
      ? []
      : await AnnouncementModel.find({ ...filter, pinned: true }).sort({ createdAt: -1 });
    const rest = await AnnouncementModel.find({
      ...filter,
      pinned: false,
      ...(query.before && { createdAt: { $lt: new Date(query.before) } }),
    })
      .sort({ createdAt: -1 })
      .limit(query.limit + 1);
    const more = rest.length > query.limit;
    const page = rest.slice(0, query.limit);
    return {
      items: await this.serialize(userId, [...pinned, ...page]),
      nextBefore: more ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    };
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    const classIds = await this.classIdsOf(userId);
    const [announcements, seen] = await Promise.all([
      AnnouncementModel.find(
        { classId: { $in: classIds }, authorId: { $ne: new Types.ObjectId(userId) } },
        { _id: 1, classId: 1 },
      ).lean(),
      AnnouncementReceiptModel.distinct('announcementId', { userId, classId: { $in: classIds } }),
    ]);
    const seenIds = new Set(seen.map(String));
    const byClass: Record<string, number> = {};
    let total = 0;
    for (const announcement of announcements) {
      if (seenIds.has(String(announcement._id))) continue;
      const key = String(announcement.classId);
      byClass[key] = (byClass[key] ?? 0) + 1;
      total += 1;
    }
    return { total, byClass };
  }

  /** Records that the person has seen these announcements; unknown or foreign ones are ignored. */
  async markSeen(userId: string, ids: string[]): Promise<void> {
    const classIds = await this.classIdsOf(userId);
    const visible = await AnnouncementModel.find(
      { _id: { $in: ids }, classId: { $in: classIds } },
      { _id: 1, classId: 1 },
    ).lean();
    if (visible.length === 0) return;
    const seenAt = this.now();
    await AnnouncementReceiptModel.bulkWrite(
      visible.map((announcement) => ({
        updateOne: {
          filter: { announcementId: announcement._id, userId: new Types.ObjectId(userId) },
          update: {
            $setOnInsert: {
              announcementId: announcement._id,
              classId: announcement.classId,
              userId: new Types.ObjectId(userId),
              seenAt,
            },
          },
          upsert: true,
        },
      })),
    );
  }

  /** Who has seen an announcement and who has not, for roles allowed to know. */
  async receipts(access: ClassAccess, id: string): Promise<AnnouncementReceipts> {
    if (!can(access.actor, 'announcement.view_receipts')) {
      throw forbidden('Only instructors and class representatives can see who has seen this.');
    }
    const announcement = await this.find(access, id);
    const [memberships, receipts] = await Promise.all([
      MembershipModel.find({
        classId: access.classDoc._id,
        userId: { $ne: announcement.authorId },
      }),
      AnnouncementReceiptModel.find({ announcementId: announcement._id }),
    ]);
    const users = await this.summaries(memberships.map((membership) => membership.userId));
    const seenAt = new Map(receipts.map((receipt) => [String(receipt.userId), receipt.seenAt]));
    const members = memberships
      .map((membership) => users.get(String(membership.userId)))
      .filter((user): user is UserSummary => user !== undefined);
    const seen = members
      .filter((user) => seenAt.has(user.id))
      .map((user) => ({ user, seenAt: (seenAt.get(user.id) as Date).toISOString() }))
      .sort((a, b) => b.seenAt.localeCompare(a.seenAt));
    const notSeen = members
      .filter((user) => !seenAt.has(user.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      announcementId: String(announcement._id),
      memberCount: members.length,
      seenCount: seen.length,
      notSeen,
      seen,
    };
  }

  // ---- Writing ----------------------------------------------------------------------------

  /**
   * Posts an announcement. A deadline or assessment also creates one class task that appears
   * for every member; members are notified, after their quiet hours if they have them.
   */
  async create(access: ClassAccess, input: CreateAnnouncementInput): Promise<AnnouncementForUser> {
    if (!can(access.actor, 'announcement.create')) {
      throw forbidden('Only instructors and class representatives can post announcements.');
    }
    await this.assertCourse(access, input.courseId);
    const now = this.now();
    const _id = new Types.ObjectId();
    const classId = access.classDoc._id;
    const authorId = new Types.ObjectId(access.userId);

    let taskId: Types.ObjectId | null = null;
    if (input.type === 'deadline' || input.type === 'assessment') {
      const task = await TaskModel.create({
        classId,
        ownerId: null,
        announcementId: _id,
        courseId: input.courseId,
        title: input.title,
        type: input.taskType,
        dueAt: new Date(input.dueAt),
        description: input.body,
        submissionRule: input.type === 'deadline' ? input.submissionRule : null,
        createdBy: authorId,
      });
      taskId = task._id;
    }

    const announcement = await AnnouncementModel.create({
      _id,
      classId,
      authorId,
      type: input.type,
      courseId: input.courseId,
      title: input.title,
      body: input.body,
      links: input.links,
      pinned: input.pinned,
      dueAt: 'dueAt' in input ? new Date(input.dueAt) : null,
      startsAt: 'startsAt' in input ? new Date(input.startsAt) : null,
      venue: 'venue' in input ? input.venue : null,
      taskType: 'taskType' in input ? input.taskType : null,
      taskId,
      edits: [],
      createdAt: now,
      updatedAt: now,
    });
    // The author has obviously seen their own post.
    await AnnouncementReceiptModel.create({
      announcementId: _id,
      classId,
      userId: authorId,
      seenAt: now,
    });
    await this.notifyMembers(access, announcement, 'announcement.created');
    this.logger.info(
      { classId: String(classId), announcementId: String(_id), type: input.type },
      'Announcement posted',
    );
    const [serialized] = await this.serialize(access.userId, [announcement]);
    return serialized as AnnouncementForUser;
  }

  /**
   * Edits an announcement and records what changed. When the time or place changes, members
   * see it as unread again and are notified, so nobody acts on old information.
   */
  async update(
    access: ClassAccess,
    id: string,
    input: UpdateAnnouncementInput,
  ): Promise<AnnouncementForUser> {
    const announcement = await this.find(access, id);
    this.assertCanManage(access, announcement);
    for (const field of TYPE_SPECIFIC) {
      if (input[field] !== undefined && !FIELDS_BY_TYPE[announcement.type].includes(field)) {
        throw invalid(
          field,
          'not_applicable',
          `A ${announcement.type} announcement has no ${field}.`,
        );
      }
    }
    if (announcement.type === 'venue_change' && input.venue === null) {
      throw invalid('venue', 'required', 'A venue change needs the new venue.');
    }
    if (input.courseId !== undefined) await this.assertCourse(access, input.courseId);

    const iso = (date: Date | null) => date?.toISOString() ?? null;
    const changed: EditableAnnouncementField[] = changedAnnouncementFields(
      {
        title: announcement.title,
        body: announcement.body,
        courseId: announcement.courseId ? String(announcement.courseId) : null,
        links: announcement.links.map(({ label, url }) => ({ label, url })),
        dueAt: iso(announcement.dueAt),
        startsAt: iso(announcement.startsAt),
        venue: announcement.venue,
        taskType: announcement.taskType,
      },
      {
        ...input,
        dueAt: input.dueAt === undefined ? undefined : new Date(input.dueAt).toISOString(),
        startsAt: input.startsAt === undefined ? undefined : new Date(input.startsAt).toISOString(),
      },
    );

    if (input.pinned !== undefined) announcement.pinned = input.pinned;
    if (changed.length > 0) {
      for (const field of changed) {
        const value = input[field];
        if (field === 'dueAt' || field === 'startsAt')
          announcement.set(field, new Date(value as string));
        else if (field === 'courseId')
          announcement.set(field, value ? new Types.ObjectId(value as string) : null);
        else announcement.set(field, value);
      }
      announcement.edits.push({
        editedAt: this.now(),
        editedBy: new Types.ObjectId(access.userId),
        changedFields: changed,
      });
    }
    await announcement.save();

    if (announcement.taskId && changed.length > 0) {
      await TaskModel.updateOne(
        { _id: announcement.taskId },
        {
          title: announcement.title,
          description: announcement.body,
          dueAt: announcement.dueAt,
          courseId: announcement.courseId,
          ...(announcement.taskType && { type: announcement.taskType }),
        },
      );
    }
    if (isImportantChange(changed)) {
      await AnnouncementReceiptModel.deleteMany({
        announcementId: announcement._id,
        userId: { $ne: new Types.ObjectId(access.userId) },
      });
      await AnnouncementReceiptModel.updateOne(
        { announcementId: announcement._id, userId: new Types.ObjectId(access.userId) },
        {
          $setOnInsert: {
            announcementId: announcement._id,
            classId: announcement.classId,
            userId: new Types.ObjectId(access.userId),
            seenAt: this.now(),
          },
        },
        { upsert: true },
      );
      await this.notifyMembers(access, announcement, 'announcement.updated');
    }
    const [serialized] = await this.serialize(access.userId, [announcement]);
    return serialized as AnnouncementForUser;
  }

  /** Deletes an announcement with its task, receipts and progress. */
  async remove(access: ClassAccess, id: string): Promise<void> {
    const announcement = await this.find(access, id);
    this.assertCanManage(access, announcement);
    if (announcement.taskId) {
      await Promise.all([
        TaskModel.deleteOne({ _id: announcement.taskId }),
        TaskCompletionModel.deleteMany({ taskId: announcement.taskId }),
      ]);
    }
    await Promise.all([
      AnnouncementReceiptModel.deleteMany({ announcementId: announcement._id }),
      NotificationModel.deleteMany({
        link: announcementLink(String(announcement.classId), String(announcement._id)),
      }),
      AnnouncementModel.deleteOne({ _id: announcement._id }),
    ]);
  }

  // ---- Internals --------------------------------------------------------------------------

  private async classIdsOf(userId: string): Promise<Types.ObjectId[]> {
    const memberships = await MembershipModel.find({ userId }, { classId: 1 }).lean();
    const active = await ClassModel.find(
      { _id: { $in: memberships.map((membership) => membership.classId) }, archivedAt: null },
      { _id: 1 },
    ).lean();
    return active.map((item) => item._id);
  }

  private async find(access: ClassAccess, id: string): Promise<AnnouncementDocument> {
    const announcement = isValidObjectId(id)
      ? await AnnouncementModel.findOne({ _id: id, classId: access.classDoc._id })
      : null;
    if (!announcement) throw notFound();
    return announcement;
  }

  private assertCanManage(access: ClassAccess, announcement: AnnouncementDocument) {
    const allowed = canManageItem(
      { ...access.actor, userId: access.userId },
      String(announcement.authorId),
      'announcement',
    );
    if (!allowed) {
      throw forbidden('Only the author or an instructor can change this announcement.');
    }
  }

  private async assertCourse(access: ClassAccess, courseId: string | null) {
    if (courseId === null) return;
    const exists =
      isValidObjectId(courseId) &&
      (await CourseModel.exists({ _id: courseId, classId: access.classDoc._id }));
    if (!exists) throw invalid('courseId', 'not_found', 'This course is not part of the class.');
  }

  /** Notifies every other member, holding notifications back during their quiet hours. */
  private async notifyMembers(
    access: ClassAccess,
    announcement: AnnouncementDocument,
    type: NotificationType,
  ) {
    const memberships = await MembershipModel.find(
      { classId: announcement.classId, userId: { $ne: new Types.ObjectId(access.userId) } },
      { userId: 1 },
    ).lean();
    const users = await UserModel.find(
      { _id: { $in: memberships.map((membership) => membership.userId) } },
      { preferences: 1 },
    ).lean();
    const now = this.now();
    const link = announcementLink(String(announcement.classId), String(announcement._id));
    if (users.length === 0) return;
    await NotificationModel.insertMany(
      users.map((user) => ({
        userId: user._id,
        type,
        params: {
          title: announcement.title,
          kind: announcement.type,
          className: access.classDoc.name,
        },
        link,
        deliverAt: deliveryTime(
          now,
          user.preferences.notifications.quietHours,
          user.preferences.timeZone,
        ),
        readAt: null,
      })),
    );
  }

  private async summaries(ids: Types.ObjectId[]): Promise<Map<string, UserSummary>> {
    const users = await UserModel.find({ _id: { $in: ids } }, { name: 1, avatarUrl: 1 }).lean();
    return new Map(
      users.map((user) => [
        String(user._id),
        { id: String(user._id), name: user.name, avatarUrl: user.avatarUrl },
      ]),
    );
  }

  /** The announcements as one person sees them: read state, permissions and receipt counts. */
  private async serialize(
    userId: string,
    announcements: AnnouncementDocument[],
  ): Promise<AnnouncementForUser[]> {
    if (announcements.length === 0) return [];
    const ids = announcements.map((announcement) => announcement._id);
    const classIds = [...new Set(announcements.map((item) => String(item.classId)))];
    const [user, classMembers, receipts] = await Promise.all([
      UserModel.findById(userId, { platformRole: 1 }).lean(),
      MembershipModel.find(
        { classId: { $in: classIds } },
        { classId: 1, userId: 1, role: 1 },
      ).lean(),
      AnnouncementReceiptModel.find(
        { announcementId: { $in: ids } },
        { announcementId: 1, userId: 1, seenAt: 1 },
      ).lean(),
    ]);
    const people = await this.summaries([
      ...announcements.map((item) => item.authorId),
      ...announcements.flatMap((item) => item.edits.map((edit) => edit.editedBy)),
    ]);
    // Current members of each class, and the signed-in person's role there.
    const membersOf = new Map<string, Set<string>>();
    const roleIn = new Map<string, MembershipRole>();
    for (const membership of classMembers) {
      const key = String(membership.classId);
      const set = membersOf.get(key) ?? new Set<string>();
      set.add(String(membership.userId));
      membersOf.set(key, set);
      if (String(membership.userId) === userId) roleIn.set(key, membership.role);
    }
    const seenBy = new Map<string, Map<string, Date>>();
    for (const receipt of receipts) {
      const key = String(receipt.announcementId);
      const map = seenBy.get(key) ?? new Map<string, Date>();
      map.set(String(receipt.userId), receipt.seenAt);
      seenBy.set(key, map);
    }
    const platformRole = user?.platformRole ?? 'user';

    return announcements.map((announcement) => {
      const id = String(announcement._id);
      const classId = String(announcement.classId);
      const actor = { platformRole, membershipRole: roleIn.get(classId) ?? null };
      const authorId = String(announcement.authorId);
      const seen = seenBy.get(id) ?? new Map<string, Date>();
      const mySeen = authorId === userId ? announcement.createdAt : seen.get(userId);
      // Receipts count current members other than the author.
      const audience = [...(membersOf.get(classId) ?? [])].filter((member) => member !== authorId);
      return {
        id,
        classId,
        author: people.get(authorId) ?? null,
        type: announcement.type,
        courseId: announcement.courseId ? String(announcement.courseId) : null,
        title: announcement.title,
        body: announcement.body,
        links: announcement.links.map(({ label, url }) => ({ label, url })),
        pinned: announcement.pinned,
        dueAt: announcement.dueAt?.toISOString() ?? null,
        startsAt: announcement.startsAt?.toISOString() ?? null,
        venue: announcement.venue,
        taskType: announcement.taskType,
        taskId: announcement.taskId ? String(announcement.taskId) : null,
        edits: announcement.edits.map((edit) => ({
          editedAt: edit.editedAt.toISOString(),
          editedBy: people.get(String(edit.editedBy)) ?? null,
          changedFields: [...edit.changedFields],
        })),
        createdAt: announcement.createdAt.toISOString(),
        updatedAt: announcement.updatedAt.toISOString(),
        seenAt: mySeen?.toISOString() ?? null,
        canManage: canManageItem({ ...actor, userId }, authorId, 'announcement'),
        receipts: can(actor, 'announcement.view_receipts')
          ? {
              seen: audience.filter((member) => seen.has(member)).length,
              members: audience.length,
            }
          : null,
      };
    });
  }
}
