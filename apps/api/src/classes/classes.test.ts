import { classForMemberSchema, courseSchema, memberSchema } from '@sabaq/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { UserModel } from '../db/models/index.js';
import { useTestDatabase } from '../test/database.js';
import { MemoryMailer, memoryLogger, testConfig } from '../test/helpers.js';

useTestDatabase();

let app: Express;

/** Registers someone and returns their Authorization header and id. */
async function person(name: string) {
  const email = `${name.toLowerCase().replace(/\W/g, '')}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'correct horse battery' })
    .expect(201);
  return { auth: `Bearer ${String(response.body.accessToken)}`, id: String(response.body.user.id) };
}

type Person = Awaited<ReturnType<typeof person>>;
const as = (who: Person) => ({
  get: (path: string) => request(app).get(`/api/classes${path}`).set('Authorization', who.auth),
  post: (path: string, body?: object) =>
    request(app).post(`/api/classes${path}`).set('Authorization', who.auth).send(body),
  patch: (path: string, body: object) =>
    request(app).patch(`/api/classes${path}`).set('Authorization', who.auth).send(body),
  delete: (path: string) =>
    request(app).delete(`/api/classes${path}`).set('Authorization', who.auth),
});

const CLASS = {
  name: 'BS Computer Science',
  section: '5A',
  program: 'BS Computer Science',
  term: 'Fall 2026',
  timeZone: 'Asia/Karachi',
};

let rep: Person;
let student: Person;
let instructor: Person;

beforeEach(async () => {
  app = createApp({
    config: testConfig({ AUTH_RATE_LIMIT_MAX: '1000' }),
    logger: memoryLogger().logger,
    mailer: new MemoryMailer(),
  });
  rep = await person('Hamza Khan');
  student = await person('Zara Ahmed');
  instructor = await person('Ayesha Siddiqui');
});

async function createClass(by: Person = rep, body: object = CLASS) {
  return classForMemberSchema.parse((await as(by).post('', body).expect(201)).body);
}

describe('creating and joining classes', () => {
  it('creates a class with a join code; the creator manages it', async () => {
    const created = await createClass();
    expect(created).toMatchObject({
      name: 'BS Computer Science',
      section: '5A',
      role: 'class_rep',
      memberCount: 1,
    });
    expect(created.joinCode).toMatch(/^[A-Z2-9]{8}$/);

    const asInstructor = await createClass(instructor, {
      ...CLASS,
      myRole: 'instructor',
      section: undefined,
    });
    expect(asInstructor).toMatchObject({ role: 'instructor', section: null });
  });

  it('joins with a code in any letter case and with separators, once', async () => {
    const { joinCode, id } = await createClass();
    const code = `${joinCode?.slice(0, 4).toLowerCase()}-${joinCode?.slice(4)}`;
    const joined = await as(student).post('/join', { code }).expect(201);
    expect(joined.body).toMatchObject({ id, role: 'student', memberCount: 2 });
    // Joining again simply opens the class.
    await as(student).post('/join', { code: joinCode }).expect(200);
    expect((await as(student).get('').expect(200)).body).toHaveLength(1);
  });

  it('explains an unknown code', async () => {
    const response = await as(student).post('/join', { code: 'ABCD2345' }).expect(404);
    expect(response.body.error.code).toBe('join_code_invalid');
    const malformed = await as(student).post('/join', { code: 'nope' }).expect(400);
    expect(malformed.body.error.code).toBe('validation_failed');
  });

  it('validates new classes', async () => {
    const response = await as(rep)
      .post('', { ...CLASS, timeZone: 'Mars/Olympus', name: '' })
      .expect(400);
    expect(response.body.error.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(['name', 'timeZone']),
    );
  });

  it('requires a session', async () => {
    await request(app).get('/api/classes').expect(401);
  });
});

describe('access', () => {
  it('hides classes from people who are not members, and lets admins in', async () => {
    const { id } = await createClass();
    expect((await as(student).get(`/${id}`).expect(404)).body.error.code).toBe('not_found');
    await as(student).get('/not-an-id').expect(404);

    await UserModel.updateOne({ _id: student.id }, { platformRole: 'admin' });
    expect((await as(student).get(`/${id}`).expect(200)).body.role).toBe('instructor');
  });

  it('refuses actions a role may not take, with a clear message', async () => {
    const { id, joinCode } = await createClass();
    await as(student).post('/join', { code: joinCode });
    const response = await as(student).patch(`/${id}`, { name: 'Renamed' }).expect(403);
    expect(response.body.error).toMatchObject({
      code: 'forbidden',
      message: 'Only instructors and class representatives can edit the class.',
    });
    expect((await as(rep).patch(`/${id}`, { name: 'Renamed' }).expect(200)).body.name).toBe(
      'Renamed',
    );
  });
});

describe('members and roles', () => {
  async function classWithMembers() {
    const created = await createClass();
    await as(student).post('/join', { code: created.joinCode });
    await as(instructor).post('/join', { code: created.joinCode });
    await as(rep)
      .patch(`/${created.id}/members/${instructor.id}`, { role: 'class_rep' })
      .expect(200);
    return created;
  }

  it('lists members by role, then name', async () => {
    const { id } = await classWithMembers();
    const members = memberSchema
      .array()
      .parse((await as(student).get(`/${id}/members`).expect(200)).body);
    expect(members.map((member) => [member.user.name, member.role])).toEqual([
      ['Ayesha Siddiqui', 'class_rep'],
      ['Hamza Khan', 'class_rep'],
      ['Zara Ahmed', 'student'],
    ]);
  });

  it('lets only instructors appoint or change instructors', async () => {
    const { id } = await classWithMembers();
    const refused = await as(rep)
      .patch(`/${id}/members/${student.id}`, { role: 'instructor' })
      .expect(403);
    expect(refused.body.error.message).toBe('Only instructors can change an instructor’s role.');
    await as(student).patch(`/${id}/members/${rep.id}`, { role: 'student' }).expect(403);

    await UserModel.updateOne({ _id: instructor.id }, { platformRole: 'admin' });
    await as(instructor)
      .patch(`/${id}/members/${instructor.id}`, { role: 'instructor' })
      .expect(200);
    await UserModel.updateOne({ _id: instructor.id }, { platformRole: 'user' });
    await as(rep).delete(`/${id}/members/${instructor.id}`).expect(403);
    await as(instructor).patch(`/${id}/members/${student.id}`, { role: 'instructor' }).expect(200);
  });

  it('keeps at least one manager in every class', async () => {
    const { id, joinCode } = await createClass();
    await as(student).post('/join', { code: joinCode });
    const leaving = await as(rep).delete(`/${id}/members/${rep.id}`).expect(409);
    expect(leaving.body.error.code).toBe('last_manager');
    await as(rep).patch(`/${id}/members/${rep.id}`, { role: 'student' }).expect(409);

    await as(rep).patch(`/${id}/members/${student.id}`, { role: 'class_rep' }).expect(200);
    await as(rep).delete(`/${id}/members/${rep.id}`).expect(204);
    await as(rep).get(`/${id}`).expect(404);
  });

  it('lets managers remove members and anyone leave', async () => {
    const { id } = await classWithMembers();
    await as(student).delete(`/${id}/members/${rep.id}`).expect(403);
    await as(student).delete(`/${id}/members/${student.id}`).expect(204);
    await as(rep).delete(`/${id}/members/${student.id}`).expect(404);
    await as(rep).patch(`/${id}/members/not-an-id`, { role: 'student' }).expect(404);
    const unchanged = await as(rep)
      .patch(`/${id}/members/${instructor.id}`, { role: 'class_rep' })
      .expect(200);
    expect(unchanged.body).toHaveLength(2);
  });
});

describe('join codes and archiving', () => {
  it('replaces a join code so the old one stops working', async () => {
    const { id, joinCode } = await createClass();
    const renewed = (await as(rep).post(`/${id}/join-code`).expect(200)).body;
    expect(renewed.joinCode).not.toBe(joinCode);
    await as(student).post('/join', { code: joinCode }).expect(404);
    await as(student).post('/join', { code: renewed.joinCode }).expect(201);
    await as(student).post(`/${id}/join-code`).expect(403);
  });

  it('lets the creator or an instructor remove a class, and hides it afterwards', async () => {
    const { id, joinCode } = await createClass();
    await as(student).post('/join', { code: joinCode });
    await as(student).delete(`/${id}`).expect(403);
    await as(rep).delete(`/${id}`).expect(204);
    await as(student).get(`/${id}`).expect(404);
    expect((await as(student).get('').expect(200)).body).toEqual([]);
    await as(instructor).post('/join', { code: joinCode }).expect(404);
  });
});

describe('courses', () => {
  const COURSE = {
    code: 'CS-341',
    title: 'Human-Computer Interaction',
    color: 'blue',
    schedule: [{ kind: 'lecture', dayOfWeek: 1, start: '09:00', end: '10:30', venue: 'B-204' }],
  };

  it('are managed by class representatives and visible to every member', async () => {
    const { id, joinCode } = await createClass();
    await as(student).post('/join', { code: joinCode });
    const created = courseSchema.parse(
      (await as(rep).post(`/${id}/courses`, COURSE).expect(201)).body,
    );
    expect(created).toMatchObject({ code: 'CS-341', instructorName: null, classId: id });

    expect((await as(student).get(`/${id}/courses`).expect(200)).body).toHaveLength(1);
    await as(student)
      .post(`/${id}/courses`, { ...COURSE, code: 'X' })
      .expect(403);

    const updated = await as(rep)
      .patch(`/${id}/courses/${created.id}`, { instructorName: 'Dr. Ayesha Siddiqui' })
      .expect(200);
    expect(updated.body.instructorName).toBe('Dr. Ayesha Siddiqui');
    await as(rep).delete(`/${id}/courses/${created.id}`).expect(204);
    await as(rep).delete(`/${id}/courses/${created.id}`).expect(404);
    await as(rep).patch(`/${id}/courses/not-an-id`, { title: 'x' }).expect(404);
  });

  it('reject duplicate codes (in any letter case) and impossible sessions', async () => {
    const { id } = await createClass();
    const first = (await as(rep).post(`/${id}/courses`, COURSE).expect(201)).body;
    const duplicate = await as(rep)
      .post(`/${id}/courses`, { ...COURSE, code: 'cs-341' })
      .expect(400);
    expect(duplicate.body.error.issues).toEqual([
      {
        path: 'code',
        code: 'duplicate',
        message: 'A course with this code already exists in the class.',
      },
    ]);
    const second = (
      await as(rep)
        .post(`/${id}/courses`, { ...COURSE, code: 'CS-352' })
        .expect(201)
    ).body;
    await as(rep).patch(`/${id}/courses/${second.id}`, { code: first.code }).expect(400);

    const backwards = await as(rep)
      .post(`/${id}/courses`, {
        ...COURSE,
        code: 'CS-363',
        schedule: [{ ...COURSE.schedule[0], end: '08:00' }],
      })
      .expect(400);
    expect(backwards.body.error.issues[0].path).toBe('schedule.0.end');
  });
});
