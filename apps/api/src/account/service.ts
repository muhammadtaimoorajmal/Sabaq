import type { AVATAR_TYPES } from '@sabaq/shared';
import {
  AVATAR_MAX_BYTES,
  changedPreferencePaths,
  type MembershipRole,
  type PreferencesUpdate,
  type ProfileUpdate,
  type User,
} from '@sabaq/shared';
import { randomBytes } from 'node:crypto';
import { isValidObjectId, type Types } from 'mongoose';
import type { Logger } from 'pino';
import {
  AnnouncementReceiptModel,
  type AvatarRecord,
  ClassModel,
  EmailTokenModel,
  JoinRequestModel,
  MembershipModel,
  NotificationModel,
  SessionModel,
  StudyGroupModel,
  StudySlotModel,
  TaskCompletionModel,
  TaskModel,
  UserModel,
} from '../db/models/index.js';
import { AppError } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import { serializeUser } from '../lib/serializers.js';

const MANAGER_ROLES: readonly MembershipRole[] = ['instructor', 'class_rep'];

/** Version of the export file format, so tools reading it can adapt if it changes. */
export const EXPORT_FORMAT_VERSION = 1;

type AvatarType = (typeof AVATAR_TYPES)[number];

/** The first bytes of each accepted image type, so a renamed file of another kind is refused. */
const SIGNATURES: Record<AvatarType, (data: Buffer) => boolean> = {
  'image/png': (data) => data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  'image/jpeg': (data) => data.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
  'image/webp': (data) =>
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP',
};

const sessionEnded = () =>
  new AppError('session_expired', 'Your session has ended. Please sign in again.');
const invalidImage = (message: string) =>
  new AppError('validation_failed', 'Some fields are not valid.', {
    issues: [{ path: 'image', code: 'invalid_image', message }],
  });

/** The photo's public address; the version makes every upload a new address. */
export const avatarPath = (userId: string, version: string) =>
  `/api/users/${userId}/avatar/${version}`;

/**
 * Everything a person controls about their own account: profile, photo, preferences,
 * the welcome steps, a copy of their data and deleting the account.
 */
export class AccountService {
  private readonly logger: Logger;
  private readonly now: () => Date;

  constructor({ logger, now = () => new Date() }: { logger: Logger; now?: () => Date }) {
    this.logger = logger;
    this.now = now;
  }

  async updateProfile(userId: string, update: ProfileUpdate): Promise<User> {
    return this.save(userId, update);
  }

  /** Changes only the given preferences, so two devices editing different ones never clash. */
  async updatePreferences(userId: string, update: PreferencesUpdate): Promise<User> {
    return this.save(userId, changedPreferencePaths(update));
  }

  /** Marks the welcome steps as finished (or skipped); later calls keep the first time. */
  async completeOnboarding(userId: string): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, onboardedAt: null },
      { onboardedAt: this.now() },
      { returnDocument: 'after' },
    );
    return user ? serializeUser(user) : this.current(userId);
  }

  async setAvatar(userId: string, dataUrl: string): Promise<User> {
    const match = /^data:(image\/(?:webp|jpeg|png));base64,(.+)$/.exec(dataUrl);
    const contentType = match?.[1] as AvatarType | undefined;
    const data = Buffer.from(match?.[2] ?? '', 'base64');
    if (!contentType || data.length === 0) throw invalidImage('Choose a JPEG, PNG or WebP image.');
    if (data.length > AVATAR_MAX_BYTES) throw invalidImage('This image is too large.');
    if (!SIGNATURES[contentType](data)) {
      throw invalidImage('This file is not a valid JPEG, PNG or WebP image.');
    }
    const version = randomBytes(9).toString('base64url');
    const avatar: AvatarRecord = { data, contentType, version };
    return this.save(userId, { avatar, avatarUrl: avatarPath(userId, version) });
  }

  async removeAvatar(userId: string): Promise<User> {
    return this.save(userId, { avatar: null, avatarUrl: null });
  }

  /** A photo by its address. Unknown or replaced versions are not found. */
  async avatar(userId: string, version: string): Promise<AvatarRecord> {
    const user = isValidObjectId(userId)
      ? await UserModel.findOne({ _id: userId, 'avatar.version': version }).select('+avatar')
      : null;
    if (!user?.avatar) throw new AppError('not_found', 'This photo does not exist.');
    return user.avatar;
  }

  /**
   * A copy of everything Sabaq stores about the person, in a documented JSON format. Security
   * secrets (password and token hashes) are left out.
   */
  async exportData(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) throw sessionEnded();
    const [memberships, personalTasks, completions, slots, notifications, sessions, groups] =
      await Promise.all([
        MembershipModel.find({ userId }).sort({ joinedAt: 1 }),
        TaskModel.find({ ownerId: userId, classId: null }).sort({ dueAt: 1 }),
        TaskCompletionModel.find({ userId }),
        StudySlotModel.find({ userId }).sort({ start: 1 }),
        NotificationModel.find({ userId }).sort({ deliverAt: -1 }),
        SessionModel.find({ userId, revokedAt: null, expiresAt: { $gt: this.now() } }),
        StudyGroupModel.find({ memberIds: user._id }),
      ]);
    const classes = await ClassModel.find({ _id: { $in: memberships.map((m) => m.classId) } });
    const classOf = new Map(classes.map((item) => [String(item._id), item]));

    return {
      format: { name: 'sabaq-account-export', version: EXPORT_FORMAT_VERSION },
      exportedAt: this.now().toISOString(),
      profile: serializeUser(user),
      classes: memberships.flatMap((membership) => {
        const classDoc = classOf.get(String(membership.classId));
        if (!classDoc) return [];
        return [
          {
            id: String(classDoc._id),
            name: classDoc.name,
            section: classDoc.section,
            term: classDoc.term,
            role: membership.role,
            joinedAt: membership.joinedAt.toISOString(),
            removed: classDoc.archivedAt !== null,
          },
        ];
      }),
      personalTasks: personalTasks.map((task) => task.toJSON()),
      completedTasks: completions.map((completion) => completion.toJSON()),
      studySlots: slots.map((slot) => slot.toJSON()),
      studyGroups: groups.map((group) => ({
        id: String(group._id),
        name: group.name,
        owner: String(group.ownerId) === userId,
      })),
      notifications: notifications.map((notification) => notification.toJSON()),
      signedInDevices: sessions.map((session) => ({
        device: session.device,
        signedInAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
      })),
    };
  }

  /**
   * Deletes the account and personal data after checking the password. Classes the person
   * manages alone, with other members, must be handed over first so nobody is left without a
   * manager; classes with no one else are removed. Posts made in a class stay with the class.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user) throw sessionEnded();
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new AppError('validation_failed', 'Some fields are not valid.', {
        issues: [{ path: 'password', code: 'incorrect', message: 'The password is incorrect.' }],
      });
    }

    const managed = await MembershipModel.find({ userId, role: { $in: MANAGER_ROLES } });
    const blocking: { id: string; name: string }[] = [];
    const removable: Types.ObjectId[] = [];
    for (const membership of managed) {
      const classDoc = await ClassModel.findOne({ _id: membership.classId, archivedAt: null });
      if (!classDoc) continue;
      const [others, otherManagers] = await Promise.all([
        MembershipModel.countDocuments({ classId: classDoc._id, userId: { $ne: userId } }),
        MembershipModel.countDocuments({
          classId: classDoc._id,
          userId: { $ne: userId },
          role: { $in: MANAGER_ROLES },
        }),
      ]);
      if (others === 0) removable.push(classDoc._id);
      else if (otherManagers === 0)
        blocking.push({ id: String(classDoc._id), name: classDoc.name });
    }
    if (blocking.length > 0) {
      throw new AppError(
        'last_manager',
        'You are the only manager of some classes. Make someone else an instructor or class representative first.',
        {
          issues: blocking.map((item) => ({
            path: `classes.${item.id}`,
            code: 'last_manager',
            message: item.name,
          })),
        },
      );
    }

    const now = this.now();
    await ClassModel.updateMany({ _id: { $in: removable } }, { archivedAt: now });
    await this.leaveStudyGroups(user._id);
    await Promise.all([
      MembershipModel.deleteMany({ userId }),
      SessionModel.deleteMany({ userId }),
      EmailTokenModel.deleteMany({ userId }),
      NotificationModel.deleteMany({ userId }),
      StudySlotModel.deleteMany({ userId }),
      TaskCompletionModel.deleteMany({ userId }),
      AnnouncementReceiptModel.deleteMany({ userId }),
      JoinRequestModel.deleteMany({ userId }),
      TaskModel.deleteMany({ ownerId: userId, classId: null }),
    ]);
    await UserModel.deleteOne({ _id: userId });
    this.logger.info({ userId, classesRemoved: removable.length }, 'Account deleted');
  }

  /** Leaves every study group; groups now without members are deleted, others get a new owner. */
  private async leaveStudyGroups(userId: Types.ObjectId): Promise<void> {
    const groups = await StudyGroupModel.find({ memberIds: userId });
    for (const group of groups) {
      group.memberIds = group.memberIds.filter((id) => !id.equals(userId));
      const [nextOwner] = group.memberIds;
      if (!nextOwner) {
        await StudyGroupModel.deleteOne({ _id: group._id });
        await JoinRequestModel.deleteMany({ groupId: group._id });
        continue;
      }
      if (group.ownerId.equals(userId)) group.ownerId = nextOwner;
      await group.save();
    }
  }

  private async save(userId: string, update: Record<string, unknown>): Promise<User> {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    if (!user) throw sessionEnded();
    return serializeUser(user);
  }

  private async current(userId: string): Promise<User> {
    const user = await UserModel.findById(userId);
    if (!user) throw sessionEnded();
    return serializeUser(user);
  }
}
