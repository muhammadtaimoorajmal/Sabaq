import { AVATAR_MAX_BYTES } from '@sabaq/shared';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  NotificationModel,
  StudyGroupModel,
  StudySlotModel,
  TaskModel,
  UserModel,
} from '../db/models/index.js';
import { useTestDatabase } from '../test/database.js';
import { memoryLogger } from '../test/helpers.js';
import { AccountService } from './service.js';

useTestDatabase();

const NOW = new Date('2026-11-25T08:00:00.000Z');
let service: AccountService;
let userId: string;

const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString('base64')}`;
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

beforeEach(async () => {
  service = new AccountService({ logger: memoryLogger().logger, now: () => NOW });
  const user = await UserModel.create({
    name: 'Sara Javed',
    email: 'sara@example.com',
    passwordHash: 'not-a-real-hash',
  });
  userId = String(user._id);
});

describe('AccountService', () => {
  it('accepts JPEG and WebP photos by their content', async () => {
    expect((await service.setAvatar(userId, dataUrl('image/jpeg', JPEG))).avatarUrl).toMatch(
      /\/avatar\//,
    );
    const user = await service.setAvatar(userId, dataUrl('image/webp', WEBP));
    const version = String(user.avatarUrl).split('/').at(-1) ?? '';
    expect((await service.avatar(userId, version)).contentType).toBe('image/webp');
  });

  it('refuses empty, oversized and mislabelled photos', async () => {
    await expect(service.setAvatar(userId, 'data:image/gif;base64,R0lG')).rejects.toMatchObject({
      code: 'validation_failed',
    });
    const huge = Buffer.concat([JPEG, Buffer.alloc(AVATAR_MAX_BYTES)]);
    await expect(service.setAvatar(userId, dataUrl('image/jpeg', huge))).rejects.toMatchObject({
      issues: [{ message: 'This image is too large.' }],
    });
    await expect(service.setAvatar(userId, dataUrl('image/webp', JPEG))).rejects.toMatchObject({
      issues: [{ code: 'invalid_image' }],
    });
    await expect(service.avatar(userId, 'nope')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('includes personal tasks, study plans, groups and notifications in the export', async () => {
    const owner = new Types.ObjectId(userId);
    await TaskModel.create({
      ownerId: owner,
      createdBy: owner,
      title: 'Read chapter 3',
      type: 'reading',
      dueAt: NOW,
    });
    await StudySlotModel.create({
      userId: owner,
      title: 'Revise',
      start: NOW,
      end: new Date(NOW.getTime() + 3_600_000),
    });
    await NotificationModel.create({ userId: owner, type: 'task.due_soon', link: '/' });
    await StudyGroupModel.create({
      classId: new Types.ObjectId(),
      courseId: new Types.ObjectId(),
      ownerId: owner,
      memberIds: [owner],
      name: 'Exam prep',
      capacity: 4,
      place: { kind: 'online', location: null, url: null },
    });

    const data = await service.exportData(userId);
    expect(data.exportedAt).toBe(NOW.toISOString());
    expect(data.personalTasks).toEqual([expect.objectContaining({ title: 'Read chapter 3' })]);
    expect(data.studySlots).toHaveLength(1);
    expect(data.notifications).toHaveLength(1);
    expect(data.studyGroups).toEqual([expect.objectContaining({ name: 'Exam prep', owner: true })]);
    expect(data.classes).toEqual([]);
  });

  it('treats a vanished account as an ended session', async () => {
    const ghost = String(new Types.ObjectId());
    const ended = { code: 'session_expired' };
    await expect(service.updateProfile(ghost, { name: 'Ghost' })).rejects.toMatchObject(ended);
    await expect(service.completeOnboarding(ghost)).rejects.toMatchObject(ended);
    await expect(service.exportData(ghost)).rejects.toMatchObject(ended);
    await expect(service.deleteAccount(ghost, 'password')).rejects.toMatchObject(ended);
  });
});
