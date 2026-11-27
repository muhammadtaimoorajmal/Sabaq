import { workloadSchema } from '@sabaq/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
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
  return `Bearer ${String(response.body.accessToken)}`;
}

let rep: string;
let zara: string;
let classId: string;
let courseId: string;

const post = (auth: string, path: string, body: object) =>
  request(app).post(`/api${path}`).set('Authorization', auth).send(body);
const get = (auth: string, path: string) =>
  request(app).get(`/api${path}`).set('Authorization', auth);

beforeEach(async () => {
  app = createApp({
    config: testConfig({ AUTH_RATE_LIMIT_MAX: '1000' }),
    logger: memoryLogger().logger,
    mailer: new MemoryMailer(),
    now: () => NOW,
  });
  rep = await person('Hamza Khan');
  zara = await person('Zara Ahmed');
  const cls = await post(rep, '/classes', {
    name: 'BSCS 5A',
    program: 'BSCS',
    term: 'Fall 2026',
    timeZone: 'Asia/Karachi',
  }).expect(201);
  classId = String(cls.body.id);
  await post(zara, '/classes/join', { code: cls.body.joinCode }).expect(201);
  const course = await post(rep, `/classes/${classId}/courses`, {
    code: 'CS-341',
    title: 'Human-Computer Interaction',
    color: 'teal',
    schedule: [],
  }).expect(201);
  courseId = String(course.body.id);

  const deadline = (title: string, dueAt: string, taskType: string) =>
    post(rep, `/classes/${classId}/announcements`, {
      type: 'deadline',
      title,
      courseId,
      dueAt,
      taskType,
    }).expect(201);
  // Monday 30 November (Karachi): a project and an assignment; Tuesday: a lab.
  await deadline('Project milestone', '2026-11-30T13:00:00.000Z', 'project');
  await deadline('Assignment 2', '2026-11-30T18:59:00.000Z', 'assignment');
  await deadline('Lab 11', '2026-12-01T18:59:00.000Z', 'lab');
  // Late on 30 November in UTC is already 1 December in Karachi.
  await deadline('Reading', '2026-11-30T20:00:00.000Z', 'reading');
});

describe('workload', () => {
  it('adds up each day for a class, in the class’s time zone', async () => {
    const response = await get(
      zara,
      `/classes/${classId}/workload?from=2026-11-29&to=2026-12-02`,
    ).expect(200);
    const workload = workloadSchema.parse(response.body);
    expect(workload.days).toEqual([
      { date: '2026-11-29', taskCount: 0, load: 0, level: 'none' },
      { date: '2026-11-30', taskCount: 2, load: 7, level: 'heavy' },
      { date: '2026-12-01', taskCount: 2, load: 3, level: 'light' },
      { date: '2026-12-02', taskCount: 0, load: 0, level: 'none' },
    ]);
    expect(workload.items[0]).toMatchObject({
      title: 'Project milestone',
      course: { code: 'CS-341' },
      className: 'BSCS 5A',
      effort: null,
    });
  });

  it('includes personal tasks in a person’s own workload, but never in the class’s', async () => {
    await post(zara, '/tasks', {
      title: 'Revise chapter 4',
      type: 'exam',
      dueAt: '2026-12-02T10:00:00.000Z',
    }).expect(201);
    const mine = workloadSchema.parse(
      (await get(zara, '/workload?from=2026-12-02&to=2026-12-02').expect(200)).body,
    );
    expect(mine.days).toEqual([{ date: '2026-12-02', taskCount: 1, load: 5, level: 'moderate' }]);
    expect(mine.items[0]).toMatchObject({ title: 'Revise chapter 4', className: null });

    const cls = workloadSchema.parse(
      (await get(rep, `/classes/${classId}/workload?from=2026-12-02&to=2026-12-02`).expect(200))
        .body,
    );
    expect(cls.items).toEqual([]);
    // Another person's personal task stays private.
    const theirs = workloadSchema.parse(
      (await get(rep, '/workload?from=2026-12-02&to=2026-12-02').expect(200)).body,
    );
    expect(theirs.items).toEqual([]);
  });

  it('hides a class from non-members and refuses bad ranges', async () => {
    const stranger = await person('Someone Else');
    await get(stranger, `/classes/${classId}/workload?from=2026-11-29&to=2026-12-02`).expect(404);
    await get(zara, '/workload?from=2026-12-02&to=2026-11-01').expect(400);
    await get(zara, '/workload?from=2026-01-01&to=2026-12-31').expect(400);
    await request(app).get('/api/workload?from=2026-12-02&to=2026-12-02').expect(401);
  });
});
