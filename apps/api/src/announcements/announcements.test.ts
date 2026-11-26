import {
  announcementForUserSchema,
  announcementPageSchema,
  announcementReceiptsSchema,
  unreadCountSchema,
} from '@sabaq/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  AnnouncementReceiptModel,
  NotificationModel,
  TaskModel,
  UserModel,
} from '../db/models/index.js';
import { useTestDatabase } from '../test/database.js';
import { MemoryMailer, memoryLogger, testConfig } from '../test/helpers.js';

useTestDatabase();

let app: Express;
/** 20:00 UTC = 01:00 in Karachi, inside the default-style quiet hours used below. */
const NOW = new Date('2026-11-26T20:00:00.000Z');
/** The API's clock; tests move it forward. */
let clock = NOW.getTime();

async function person(name: string) {
  const email = `${name.toLowerCase().replace(/\W/g, '')}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email,
      password: 'correct horse battery',
      preferences: { timeZone: 'Asia/Karachi' },
    })
    .expect(201);
  return { auth: `Bearer ${String(response.body.accessToken)}`, id: String(response.body.user.id) };
}
type Person = Awaited<ReturnType<typeof person>>;

const as = (who: Person) => ({
  get: (path: string) => request(app).get(`/api${path}`).set('Authorization', who.auth),
  post: (path: string, body?: object) =>
    request(app).post(`/api${path}`).set('Authorization', who.auth).send(body),
  patch: (path: string, body: object) =>
    request(app).patch(`/api${path}`).set('Authorization', who.auth).send(body),
  delete: (path: string) => request(app).delete(`/api${path}`).set('Authorization', who.auth),
});

let rep: Person;
let zara: Person;
let ali: Person;
let classId: string;
let courseId: string;

const DEADLINE = {
  type: 'deadline',
  title: 'Lab 11: usability test report',
  body: 'Submit one PDF on the LMS.',
  dueAt: '2026-11-28T18:59:00.000Z',
  taskType: 'lab',
};

beforeEach(async () => {
  app = createApp({
    config: testConfig({ AUTH_RATE_LIMIT_MAX: '1000' }),
    logger: memoryLogger().logger,
    mailer: new MemoryMailer(),
    now: () => new Date(clock),
  });
  clock = NOW.getTime();
  rep = await person('Hamza Khan');
  zara = await person('Zara Ahmed');
  ali = await person('Ali Raza');
  const cls = await as(rep)
    .post('/classes', {
      name: 'BSCS 5A',
      program: 'BSCS',
      term: 'Fall 2026',
      timeZone: 'Asia/Karachi',
    })
    .expect(201);
  classId = String(cls.body.id);
  for (const student of [zara, ali]) {
    await as(student).post('/classes/join', { code: cls.body.joinCode }).expect(201);
  }
  const course = await as(rep)
    .post(`/classes/${classId}/courses`, { code: 'CS-330', title: 'HCI', color: 'teal' })
    .expect(201);
  courseId = String(course.body.id);
});

const post = (body: object = DEADLINE, who: Person = rep) =>
  as(who).post(`/classes/${classId}/announcements`, body);

describe('posting', () => {
  it('turns a deadline into one task for the whole class and notifies members after quiet hours', async () => {
    await UserModel.updateOne(
      { _id: zara.id },
      { 'preferences.notifications.quietHours': { enabled: true, start: '22:00', end: '07:00' } },
    );
    const response = await post({ ...DEADLINE, courseId }).expect(201);
    const announcement = announcementForUserSchema.parse(response.body);
    expect(announcement).toMatchObject({
      type: 'deadline',
      taskType: 'lab',
      courseId,
      canManage: true,
      seenAt: NOW.toISOString(),
      receipts: { seen: 0, members: 2 },
      author: { name: 'Hamza Khan' },
    });

    const task = await TaskModel.findById(announcement.taskId);
    expect(task).toMatchObject({ title: DEADLINE.title, type: 'lab', ownerId: null });
    expect(task?.dueAt.toISOString()).toBe(DEADLINE.dueAt);

    const notifications = await NotificationModel.find().sort({ userId: 1 });
    expect(notifications).toHaveLength(2);
    const forZara = notifications.find((item) => String(item.userId) === zara.id);
    const forAli = notifications.find((item) => String(item.userId) === ali.id);
    // 01:00 in Karachi is inside Zara's quiet hours: delivered at 07:00 (02:00 UTC).
    expect(forZara?.deliverAt.toISOString()).toBe('2026-11-27T02:00:00.000Z');
    expect(forAli?.deliverAt.toISOString()).toBe(NOW.toISOString());
    expect(forZara?.link).toBe(
      `/classes/${classId}?tab=announcements&announcement=${announcement.id}`,
    );
  });

  it('keeps type-specific fields: venue changes need a venue and a time', async () => {
    const missing = await post({ type: 'venue_change', title: 'Room change' }).expect(400);
    expect(missing.body.error.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([
      'startsAt',
      'venue',
    ]);
    const ok = await post({
      type: 'venue_change',
      title: 'HCI moves to Lab 3',
      startsAt: '2026-11-27T04:00:00.000Z',
      venue: 'Lab 3',
    }).expect(201);
    expect(ok.body).toMatchObject({ venue: 'Lab 3', taskId: null, dueAt: null });
  });

  it('lets only managers post, and only to courses of the class', async () => {
    const refused = await post(DEADLINE, zara).expect(403);
    expect(refused.body.error.message).toMatch(/instructors and class representatives/);
    const foreign = await post({ ...DEADLINE, courseId: '64b7f0000000000000000009' }).expect(400);
    expect(foreign.body.error.issues[0]).toMatchObject({ path: 'courseId', code: 'not_found' });
  });
});

describe('reading', () => {
  it('shows pinned first, then newest, with read state, to members only', async () => {
    await post({ type: 'general', title: 'Welcome', pinned: true }).expect(201);
    await post({ type: 'material', title: 'Slides for week 12' }).expect(201);
    const page = announcementPageSchema.parse(
      (await as(zara).get('/announcements').expect(200)).body,
    );
    expect(page.items.map((item) => item.title)).toEqual(['Welcome', 'Slides for week 12']);
    expect(page.items[0]).toMatchObject({ seenAt: null, canManage: false, receipts: null });

    const outsider = await person('Sana Malik');
    await as(outsider).get(`/announcements?classId=${classId}`).expect(404);
    expect((await as(outsider).get('/announcements').expect(200)).body.items).toEqual([]);
  });

  it('counts unread announcements and records what was seen', async () => {
    const first = (await post().expect(201)).body;
    await post({ type: 'general', title: 'Bring laptops' }).expect(201);
    expect(unreadCountSchema.parse((await as(zara).get('/announcements/unread')).body)).toEqual({
      total: 2,
      byClass: { [classId]: 2 },
    });
    // The author has nothing unread.
    expect((await as(rep).get('/announcements/unread')).body.total).toBe(0);

    await as(zara)
      .post('/announcements/seen', { ids: [first.id, first.id] })
      .expect(204);
    await as(zara)
      .post('/announcements/seen', { ids: [first.id] })
      .expect(204);
    expect((await as(zara).get('/announcements/unread')).body.total).toBe(1);
    const unread = await as(zara).get('/announcements?unread=true').expect(200);
    expect(unread.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Bring laptops',
    ]);
    expect(await AnnouncementReceiptModel.countDocuments({ userId: zara.id })).toBe(1);
  });

  it('filters by type and finds words in the title or body', async () => {
    await post().expect(201);
    await post({ type: 'material', title: 'Week 12 slides', body: 'Heuristic evaluation' }).expect(
      201,
    );
    const materials = await as(zara).get('/announcements?type=material').expect(200);
    expect(materials.body.items).toHaveLength(1);
    const found = await as(zara).get('/announcements?q=heuristic').expect(200);
    expect(found.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Week 12 slides',
    ]);
  });

  it('pages through older announcements', async () => {
    for (const title of ['One', 'Two', 'Three']) {
      clock += 60_000;
      await post({ type: 'general', title }).expect(201);
    }
    const first = await as(zara).get('/announcements?limit=2').expect(200);
    expect(first.body.items.map((item: { title: string }) => item.title)).toHaveLength(2);
    expect(first.body.nextBefore).not.toBeNull();
    const second = await as(zara)
      .get(`/announcements?limit=2&before=${encodeURIComponent(String(first.body.nextBefore))}`)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextBefore).toBeNull();
  });
});

describe('receipts', () => {
  it('lists who has and has not seen an announcement, for managers only', async () => {
    const announcement = (await post().expect(201)).body;
    await as(zara)
      .post('/announcements/seen', { ids: [announcement.id] })
      .expect(204);
    const receipts = announcementReceiptsSchema.parse(
      (
        await as(rep)
          .get(`/classes/${classId}/announcements/${announcement.id}/receipts`)
          .expect(200)
      ).body,
    );
    expect(receipts).toMatchObject({
      memberCount: 2,
      seenCount: 1,
      notSeen: [{ name: 'Ali Raza' }],
    });
    expect(receipts.seen[0]?.user.name).toBe('Zara Ahmed');
    await as(zara).get(`/classes/${classId}/announcements/${announcement.id}/receipts`).expect(403);

    const listed = await as(rep).get('/announcements').expect(200);
    expect(listed.body.items[0].receipts).toEqual({ seen: 1, members: 2 });
  });
});

describe('editing', () => {
  it('keeps a history, updates the task, and asks everyone to look again when the time changes', async () => {
    const announcement = (await post().expect(201)).body;
    await as(zara)
      .post('/announcements/seen', { ids: [announcement.id] })
      .expect(204);
    await NotificationModel.deleteMany();

    const wording = await as(rep)
      .patch(`/classes/${classId}/announcements/${announcement.id}`, { body: 'Submit one PDF.' })
      .expect(200);
    expect(wording.body.edits).toEqual([
      expect.objectContaining({
        changedFields: ['body'],
        editedBy: expect.objectContaining({ name: 'Hamza Khan' }),
      }),
    ]);
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect((await as(zara).get('/announcements/unread')).body.total).toBe(0);

    const moved = await as(rep)
      .patch(`/classes/${classId}/announcements/${announcement.id}`, {
        dueAt: '2026-11-30T18:59:00.000Z',
        title: 'Lab 11 (extended)',
      })
      .expect(200);
    expect(moved.body.edits.at(-1).changedFields).toEqual(['title', 'dueAt']);
    const task = await TaskModel.findById(announcement.taskId);
    expect(task?.dueAt.toISOString()).toBe('2026-11-30T18:59:00.000Z');
    expect(task?.title).toBe('Lab 11 (extended)');
    // Zara saw the old deadline: it is unread for her again, and both students are told.
    expect((await as(zara).get('/announcements/unread')).body.total).toBe(1);
    expect(await NotificationModel.countDocuments({ type: 'announcement.updated' })).toBe(2);
    expect(moved.body.receipts).toEqual({ seen: 0, members: 2 });
  });

  it('pins without adding to the history, and refuses fields the type does not have', async () => {
    const announcement = (await post({ type: 'general', title: 'Welcome' }).expect(201)).body;
    const pinned = await as(rep)
      .patch(`/classes/${classId}/announcements/${announcement.id}`, { pinned: true })
      .expect(200);
    expect(pinned.body).toMatchObject({ pinned: true, edits: [] });
    const refused = await as(rep)
      .patch(`/classes/${classId}/announcements/${announcement.id}`, { venue: 'Lab 3' })
      .expect(400);
    expect(refused.body.error.issues[0]).toMatchObject({ path: 'venue', code: 'not_applicable' });
  });

  it('keeps a venue on venue changes', async () => {
    const moved = (
      await post({
        type: 'venue_change',
        title: 'HCI moves',
        startsAt: '2026-11-27T04:00:00.000Z',
        venue: 'Lab 3',
      }).expect(201)
    ).body;
    await as(rep)
      .patch(`/classes/${classId}/announcements/${moved.id}`, { venue: null })
      .expect(400);
  });

  it('lets only the author or an instructor change or delete it', async () => {
    const announcement = (await post().expect(201)).body;
    await as(zara)
      .patch(`/classes/${classId}/announcements/${announcement.id}`, { title: 'Hacked' })
      .expect(403);
    await as(zara).delete(`/classes/${classId}/announcements/${announcement.id}`).expect(403);
    await as(rep).get(`/classes/${classId}/announcements/not-an-id/receipts`).expect(404);
  });
});

describe('deleting', () => {
  it('removes the announcement with its task and receipts', async () => {
    const announcement = (await post().expect(201)).body;
    await as(zara)
      .post('/announcements/seen', { ids: [announcement.id] })
      .expect(204);
    await as(rep).delete(`/classes/${classId}/announcements/${announcement.id}`).expect(204);
    expect(await TaskModel.exists({ _id: announcement.taskId })).toBeNull();
    expect(await AnnouncementReceiptModel.countDocuments()).toBe(0);
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect((await as(zara).get('/announcements')).body.items).toEqual([]);
  });
});

describe('edge cases', () => {
  it('moves an announcement to another course, or to no course, and refuses foreign ones', async () => {
    const announcement = (await post({ type: 'material', title: 'Slides' }).expect(201)).body;
    const path = `/classes/${classId}/announcements/${announcement.id}`;
    const moved = await as(rep).patch(path, { courseId }).expect(200);
    expect(moved.body.courseId).toBe(courseId);
    expect(moved.body.edits[0].changedFields).toEqual(['courseId']);
    const cleared = await as(rep).patch(path, { courseId: null }).expect(200);
    expect(cleared.body.courseId).toBeNull();
    await as(rep).patch(path, { courseId: '64b7f0000000000000000009' }).expect(400);
  });

  it('deletes announcements without a task, and ignores unknown ones when marking seen', async () => {
    const announcement = (await post({ type: 'general', title: 'Hello' }).expect(201)).body;
    await as(zara)
      .post('/announcements/seen', { ids: ['64b7f0000000000000000009'] })
      .expect(204);
    expect(await AnnouncementReceiptModel.countDocuments({ userId: zara.id })).toBe(0);
    await as(rep).delete(`/classes/${classId}/announcements/${announcement.id}`).expect(204);
    await as(rep).delete(`/classes/${classId}/announcements/${announcement.id}`).expect(404);
  });

  it('leaves people who left the class out of receipts', async () => {
    const announcement = (await post().expect(201)).body;
    await as(ali).delete(`/classes/${classId}/members/${ali.id}`).expect(204);
    const receipts = await as(rep)
      .get(`/classes/${classId}/announcements/${announcement.id}/receipts`)
      .expect(200);
    expect(receipts.body).toMatchObject({ memberCount: 1, seenCount: 0 });
  });

  it('shows the author as a former member once their account is gone', async () => {
    await post({ type: 'general', title: 'Hello' }).expect(201);
    await UserModel.deleteOne({ _id: rep.id });
    const page = await as(zara).get('/announcements').expect(200);
    expect(page.body.items[0].author).toBeNull();
  });
});
