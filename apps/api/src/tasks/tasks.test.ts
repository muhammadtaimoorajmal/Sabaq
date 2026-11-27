import { agendaSchema, agendaTaskSchema } from '@sabaq/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { ClassModel, TaskCompletionModel, TaskModel } from '../db/models/index.js';
import { useTestDatabase } from '../test/database.js';
import { MemoryMailer, memoryLogger, testConfig } from '../test/helpers.js';

useTestDatabase();

/** Thursday 26 November 2026, 10:00 in Karachi. */
const NOW = new Date('2026-11-26T05:00:00.000Z');
let app: Express;

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
  put: (path: string) => request(app).put(`/api${path}`).set('Authorization', who.auth),
  patch: (path: string, body: object) =>
    request(app).patch(`/api${path}`).set('Authorization', who.auth).send(body),
  delete: (path: string) => request(app).delete(`/api${path}`).set('Authorization', who.auth),
});

let rep: Person;
let zara: Person;
let classId: string;
let courseId: string;

beforeEach(async () => {
  app = createApp({
    config: testConfig({ AUTH_RATE_LIMIT_MAX: '1000' }),
    logger: memoryLogger().logger,
    mailer: new MemoryMailer(),
    now: () => NOW,
  });
  rep = await person('Hamza Khan');
  zara = await person('Zara Ahmed');
  const cls = await as(rep)
    .post('/classes', {
      name: 'BSCS 5A',
      program: 'BSCS',
      term: 'Fall 2026',
      timeZone: 'Asia/Karachi',
    })
    .expect(201);
  classId = String(cls.body.id);
  await as(zara).post('/classes/join', { code: cls.body.joinCode }).expect(201);
  const course = await as(rep)
    .post(`/classes/${classId}/courses`, {
      code: 'CS-341',
      title: 'Human-Computer Interaction',
      color: 'teal',
      schedule: [
        { kind: 'lecture', dayOfWeek: 1, start: '09:00', end: '10:30', venue: 'B-204' },
        { kind: 'lab', dayOfWeek: 3, start: '11:00', end: '13:00', venue: 'Lab 3' },
      ],
    })
    .expect(201);
  courseId = String(course.body.id);
});

const week = '/agenda?from=2026-11-26&to=2026-12-02';

describe('agenda', () => {
  it('brings class tasks, personal tasks and class meetings together', async () => {
    await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'deadline',
        title: 'Lab 11 report',
        courseId,
        dueAt: '2026-11-28T18:59:00.000Z',
        taskType: 'lab',
      })
      .expect(201);
    await as(zara)
      .post('/tasks', {
        title: 'Revise chapter 4',
        type: 'reading',
        dueAt: '2026-11-27T15:00:00.000Z',
      })
      .expect(201);

    const agenda = agendaSchema.parse((await as(zara).get(week).expect(200)).body);
    expect(agenda.timeZone).toBe('Asia/Karachi');
    expect(agenda.tasks.map((task) => [task.title, task.className, task.canManage])).toEqual([
      ['Revise chapter 4', null, true],
      ['Lab 11 report', 'BSCS 5A', false],
    ]);
    expect(agenda.tasks[1]?.course).toMatchObject({ code: 'CS-341', color: 'teal' });
    expect(agenda.sessions.map((session) => [session.day, session.kind, session.venue])).toEqual([
      ['2026-11-30', 'lecture', 'B-204'],
      ['2026-12-02', 'lab', 'Lab 3'],
    ]);
    expect(agenda.sessions[0]).toMatchObject({
      className: 'BSCS 5A',
      status: 'scheduled',
      startsAt: '2026-11-30T04:00:00.000Z',
    });
  });

  it('shows announced cancellations and room changes on the meetings', async () => {
    const cancelled = await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'cancellation',
        title: 'No HCI on Monday',
        courseId,
        startsAt: '2026-11-30T04:00:00.000Z',
      })
      .expect(201);
    await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'venue_change',
        title: 'Lab moves',
        courseId,
        startsAt: '2026-12-02T06:00:00.000Z',
        venue: 'Hall A',
      })
      .expect(201);
    const agenda = agendaSchema.parse((await as(zara).get(week).expect(200)).body);
    expect(agenda.sessions[0]).toMatchObject({
      status: 'cancelled',
      announcementId: cancelled.body.id,
    });
    expect(agenda.sessions[1]).toMatchObject({
      status: 'moved',
      venue: 'Hall A',
      originalVenue: 'Lab 3',
    });
  });

  it('keeps unfinished overdue work, and drops it once done', async () => {
    const late = await as(zara)
      .post('/tasks', {
        title: 'Late essay',
        type: 'assignment',
        dueAt: '2026-11-20T18:00:00.000Z',
      })
      .expect(201);
    await as(zara)
      .post('/tasks', { title: 'Ancient', type: 'assignment', dueAt: '2026-09-01T18:00:00.000Z' })
      .expect(201);
    let agenda = (await as(zara).get(week).expect(200)).body;
    expect(agenda.tasks.map((task: { title: string }) => task.title)).toEqual(['Late essay']);

    await as(zara).put(`/tasks/${late.body.id}/completion`).expect(200);
    agenda = (await as(zara).get(week).expect(200)).body;
    expect(agenda.tasks).toEqual([]);
  });

  it('refuses ranges that are backwards or too long', async () => {
    await as(zara).get('/agenda?from=2026-12-02&to=2026-11-26').expect(400);
    await as(zara).get('/agenda?from=2026-11-01&to=2027-02-01').expect(400);
    await request(app).get(`/api${week}`).expect(401);
  });
});

describe('personal tasks', () => {
  it('adds, edits and deletes a personal task, only for its owner', async () => {
    const created = await as(zara)
      .post('/tasks', {
        title: 'Read paper',
        type: 'reading',
        dueAt: '2026-11-27T15:00:00.000Z',
        courseId,
      })
      .expect(201);
    const task = agendaTaskSchema.parse(created.body);
    expect(task).toMatchObject({
      ownerId: zara.id,
      classId: null,
      canManage: true,
      course: { code: 'CS-341' },
    });

    const edited = await as(zara)
      .patch(`/tasks/${task.id}`, {
        title: 'Read two papers',
        courseId: null,
        dueAt: '2026-11-28T15:00:00.000Z',
      })
      .expect(200);
    expect(edited.body).toMatchObject({
      title: 'Read two papers',
      course: null,
      dueAt: '2026-11-28T15:00:00.000Z',
    });

    await as(rep).patch(`/tasks/${task.id}`, { title: 'Mine now' }).expect(404);
    await as(rep).delete(`/tasks/${task.id}`).expect(404);
    await as(zara).delete(`/tasks/${task.id}`).expect(204);
    expect(await TaskModel.exists({ _id: task.id })).toBeNull();
  });

  it('accepts only courses from the person’s classes', async () => {
    const outsider = await person('Sana Malik');
    const response = await as(outsider)
      .post('/tasks', { title: 'X', type: 'other', dueAt: '2026-11-27T15:00:00.000Z', courseId })
      .expect(400);
    expect(response.body.error.issues[0]).toMatchObject({ path: 'courseId', code: 'not_found' });
    await as(outsider)
      .post('/tasks', {
        title: 'X',
        type: 'other',
        dueAt: '2026-11-27T15:00:00.000Z',
        courseId: 'nope',
      })
      .expect(400);
  });
});

describe('completion', () => {
  it('marks class tasks done per student, and undoes it', async () => {
    const posted = await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'deadline',
        title: 'Lab 11 report',
        dueAt: '2026-11-28T18:59:00.000Z',
      })
      .expect(201);
    const taskId = String(posted.body.taskId);
    const done = await as(zara).put(`/tasks/${taskId}/completion`).expect(200);
    expect(done.body.completedAt).toBe(NOW.toISOString());
    await as(zara).put(`/tasks/${taskId}/completion`).expect(200);
    expect(await TaskCompletionModel.countDocuments({ taskId })).toBe(1);

    const forRep = (await as(rep).get(week).expect(200)).body;
    expect(forRep.tasks[0].completedAt).toBeNull();
    const forZara = (await as(zara).get(week).expect(200)).body;
    expect(forZara.tasks[0].completedAt).toBe(NOW.toISOString());

    await as(zara).delete(`/tasks/${taskId}/completion`).expect(204);
    expect(await TaskCompletionModel.countDocuments({ taskId })).toBe(0);
  });

  it('hides tasks of classes the person is not in', async () => {
    const posted = await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'deadline',
        title: 'Lab 11 report',
        dueAt: '2026-11-28T18:59:00.000Z',
      })
      .expect(201);
    const outsider = await person('Sana Malik');
    await as(outsider)
      .put(`/tasks/${String(posted.body.taskId)}/completion`)
      .expect(404);
    await as(outsider).put('/tasks/not-an-id/completion').expect(404);
  });
});

describe('class tasks', () => {
  it('are changed through their announcement, or by managers when they have none', async () => {
    const posted = await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'deadline',
        title: 'Lab 11 report',
        dueAt: '2026-11-28T18:59:00.000Z',
      })
      .expect(201);
    const refused = await as(rep)
      .patch(`/tasks/${String(posted.body.taskId)}`, { title: 'Changed' })
      .expect(403);
    expect(refused.body.error.message).toMatch(/Edit the announcement/);

    const plain = await TaskModel.create({
      classId,
      title: 'Bring laptops',
      type: 'other',
      dueAt: new Date('2026-11-28T04:00:00.000Z'),
      createdBy: rep.id,
    });
    await as(zara)
      .patch(`/tasks/${String(plain._id)}`, { title: 'No' })
      .expect(403);
    const edited = await as(rep)
      .patch(`/tasks/${String(plain._id)}`, { title: 'Bring laptops and chargers' })
      .expect(200);
    expect(edited.body).toMatchObject({ canManage: true, className: 'BSCS 5A' });
    await as(rep)
      .delete(`/tasks/${String(plain._id)}`)
      .expect(204);
  });
});

describe('one task and its submission rules', () => {
  const RULE = {
    namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
    allowedExtensions: ['.PDF', 'docx', 'pdf'],
    maxSizeMB: 10,
    channel: { kind: 'lms', label: 'Week 11 folder' },
    latePolicy: { kind: 'penalty', graceMinutes: 15, penaltyPercent: 10 },
  };

  async function labTask() {
    await ClassModel.updateOne({ _id: classId }, { section: '5A' });
    const posted = await as(rep)
      .post(`/classes/${classId}/announcements`, {
        type: 'deadline',
        title: 'Lab 11 report',
        courseId,
        dueAt: '2026-11-28T18:59:00.000Z',
        taskType: 'lab',
      })
      .expect(201);
    return String(posted.body.taskId);
  }

  it('returns one task with its class section and what the person may do', async () => {
    const id = await labTask();
    const forZara = agendaTaskSchema.parse((await as(zara).get(`/tasks/${id}`).expect(200)).body);
    expect(forZara).toMatchObject({
      title: 'Lab 11 report',
      className: 'BSCS 5A',
      classSection: '5A',
      canManage: false,
      canEditRule: false,
      course: { code: 'CS-341' },
      submissionRule: null,
    });
    const forRep = agendaTaskSchema.parse((await as(rep).get(`/tasks/${id}`).expect(200)).body);
    expect(forRep.canEditRule).toBe(true);

    const agenda = agendaSchema.parse((await as(zara).get(week).expect(200)).body);
    expect(agenda.tasks[0]).toMatchObject({ classSection: '5A', canEditRule: false });

    const stranger = await person('Someone Else');
    await as(stranger).get(`/tasks/${id}`).expect(404);
    await as(zara).get('/tasks/not-an-id').expect(404);
  });

  it('lets class managers set and remove rules, even on announcement tasks', async () => {
    const id = await labTask();
    const set = await request(app)
      .put(`/api/tasks/${id}/rule`)
      .set('Authorization', rep.auth)
      .send(RULE)
      .expect(200);
    expect(set.body.submissionRule).toEqual({
      namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
      caseSensitive: false,
      allowedExtensions: ['pdf', 'docx'],
      maxSizeMB: 10,
      channel: { kind: 'lms', label: 'Week 11 folder', url: null },
      latePolicy: { kind: 'penalty', graceMinutes: 15, penaltyPercent: 10 },
    });

    const seen = await as(zara).get(`/tasks/${id}`).expect(200);
    expect(seen.body.submissionRule.namingPattern).toBe('Lab{TASK_NO}_{STUDENT_ID}_{SECTION}');

    const cleared = await as(rep).delete(`/tasks/${id}/rule`).expect(200);
    expect(cleared.body.submissionRule).toBeNull();
  });

  it('refuses rules from students and broken patterns', async () => {
    const id = await labTask();
    const refused = await request(app)
      .put(`/api/tasks/${id}/rule`)
      .set('Authorization', zara.auth)
      .send(RULE)
      .expect(403);
    expect(refused.body.error.code).toBe('forbidden');
    await as(zara).delete(`/tasks/${id}/rule`).expect(403);

    const broken = await request(app)
      .put(`/api/tasks/${id}/rule`)
      .set('Authorization', rep.auth)
      .send({ ...RULE, namingPattern: 'Lab{WEEK}' })
      .expect(400);
    expect(broken.body.error.issues[0]).toMatchObject({ path: 'namingPattern' });
  });

  it('lets people set rules on their own personal tasks only', async () => {
    const own = await as(zara)
      .post('/tasks', { title: 'Essay draft', type: 'assignment', dueAt: '2026-11-29T10:00:00Z' })
      .expect(201);
    expect(own.body.canEditRule).toBe(true);
    const updated = await request(app)
      .put(`/api/tasks/${String(own.body.id)}/rule`)
      .set('Authorization', zara.auth)
      .send({ allowedExtensions: ['docx'], channel: { kind: 'other' } })
      .expect(200);
    expect(updated.body.submissionRule.allowedExtensions).toEqual(['docx']);
    await as(rep)
      .get(`/tasks/${String(own.body.id)}`)
      .expect(404);
  });
});
