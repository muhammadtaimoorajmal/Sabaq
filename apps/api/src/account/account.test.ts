import { userSchema } from '@sabaq/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  ClassModel,
  MembershipModel,
  SessionModel,
  StudyGroupModel,
  UserModel,
} from '../db/models/index.js';
import { useTestDatabase } from '../test/database.js';
import { MemoryMailer, memoryLogger, testConfig } from '../test/helpers.js';

useTestDatabase();

let app: Express;
const PASSWORD = 'correct horse battery';

/** Registers someone and returns their Authorization header and id. */
async function person(name: string, extra: object = {}) {
  const email = `${name.toLowerCase().replace(/\W/g, '')}@example.com`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: PASSWORD, ...extra })
    .expect(201);
  return {
    auth: `Bearer ${String(response.body.accessToken)}`,
    id: String(response.body.user.id),
    user: userSchema.parse(response.body.user),
  };
}
type Person = Awaited<ReturnType<typeof person>>;

const call = (who: Person, method: 'get' | 'patch' | 'put' | 'post' | 'delete', path: string) =>
  request(app)[method](`/api/account${path}`).set('Authorization', who.auth);

/** The smallest valid image of each kind, as data URLs. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

beforeEach(() => {
  app = createApp({
    config: testConfig({ AUTH_RATE_LIMIT_MAX: '1000' }),
    logger: memoryLogger().logger,
    mailer: new MemoryMailer(),
  });
});

describe('sign-up', () => {
  it('keeps display settings chosen before signing up and starts the welcome steps', async () => {
    const sara = await person('Sara Javed', {
      preferences: { theme: 'dark', textScale: 1.25, timeZone: 'Asia/Karachi' },
    });
    expect(sara.user.preferences).toMatchObject({
      theme: 'dark',
      textScale: 1.25,
      timeZone: 'Asia/Karachi',
      language: 'en',
    });
    expect(sara.user.onboardedAt).toBeNull();
  });
});

describe('profile and preferences', () => {
  let sara: Person;
  beforeEach(async () => {
    sara = await person('Sara Javed');
  });

  it('updates the name and student ID, and clears the student ID', async () => {
    const updated = await call(sara, 'patch', '/profile')
      .send({ name: '  Sara J. ', studentId: 'FA24-BCS-042' })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Sara J.', studentId: 'FA24-BCS-042' });
    const cleared = await call(sara, 'patch', '/profile').send({ studentId: null }).expect(200);
    expect(cleared.body.studentId).toBeNull();
  });

  it('rejects an invalid profile with every problem listed', async () => {
    const response = await call(sara, 'patch', '/profile')
      .send({ name: 'S', studentId: 'has spaces' })
      .expect(400);
    expect(response.body.error.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([
      'name',
      'studentId',
    ]);
  });

  it('changes only the preferences sent, so devices never overwrite each other', async () => {
    await call(sara, 'patch', '/preferences')
      .send({ notifications: { quietHours: { enabled: true, start: '23:00' } } })
      .expect(200);
    const response = await call(sara, 'patch', '/preferences').send({ theme: 'dark' }).expect(200);
    expect(response.body.preferences.theme).toBe('dark');
    expect(response.body.preferences.notifications.quietHours).toEqual({
      enabled: true,
      start: '23:00',
      end: '07:00',
    });
    await call(sara, 'patch', '/preferences').send({ textScale: 4 }).expect(400);
  });

  it('records the end of the welcome steps once', async () => {
    const first = await call(sara, 'post', '/onboarding').expect(200);
    expect(first.body.onboardedAt).toEqual(expect.any(String));
    const second = await call(sara, 'post', '/onboarding').expect(200);
    expect(second.body.onboardedAt).toBe(first.body.onboardedAt);
  });

  it('needs a session', async () => {
    await request(app).patch('/api/account/profile').send({ name: 'Nobody' }).expect(401);
  });
});

describe('profile photo', () => {
  let sara: Person;
  beforeEach(async () => {
    sara = await person('Sara Javed');
  });

  it('stores a photo at a cacheable address that changes with each upload', async () => {
    const first = await call(sara, 'put', '/avatar').send({ image: PNG }).expect(200);
    const url = String(first.body.avatarUrl);
    expect(url).toMatch(new RegExp(`^/api/users/${sara.id}/avatar/[\\w-]+$`));

    const photo = await request(app).get(url).expect(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect(photo.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const second = await call(sara, 'put', '/avatar').send({ image: PNG }).expect(200);
    expect(second.body.avatarUrl).not.toBe(url);
    await request(app).get(url).expect(404);

    const removed = await call(sara, 'delete', '/avatar').expect(200);
    expect(removed.body.avatarUrl).toBeNull();
    await request(app).get(String(second.body.avatarUrl)).expect(404);
  });

  it('refuses files that are not really images', async () => {
    const fake = `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;
    const response = await call(sara, 'put', '/avatar').send({ image: fake }).expect(400);
    expect(response.body.error.issues[0]).toMatchObject({ path: 'image', code: 'invalid_image' });
    await call(sara, 'put', '/avatar')
      .send({ image: 'data:image/svg+xml;base64,PHN2Zz4=' })
      .expect(400);
    await request(app).get(`/api/users/not-an-id/avatar/x`).expect(404);
  });

  it('never returns the photo bytes with the user', async () => {
    await call(sara, 'put', '/avatar').send({ image: PNG }).expect(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', sara.auth).expect(200);
    expect(me.body).not.toHaveProperty('avatar');
  });
});

describe('data export', () => {
  it('downloads everything about the person without secrets', async () => {
    const sara = await person('Sara Javed');
    await request(app)
      .post('/api/classes')
      .set('Authorization', sara.auth)
      .send({ name: 'BS Computer Science', program: 'BSCS', term: 'Fall 2026', timeZone: 'UTC' })
      .expect(201);

    const response = await call(sara, 'get', '/export').expect(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="?sabaq-data-\d{4}-\d{2}-\d{2}\.json"?$/,
    );
    expect(response.body).toMatchObject({
      format: { name: 'sabaq-account-export', version: 1 },
      profile: { name: 'Sara Javed', email: 'sarajaved@example.com' },
      classes: [{ name: 'BS Computer Science', role: 'class_rep', removed: false }],
      signedInDevices: [expect.objectContaining({ device: expect.any(String) })],
    });
    const text = JSON.stringify(response.body);
    expect(text).not.toMatch(/passwordHash|tokenHash|failedLoginCount/);
  });
});

describe('deleting the account', () => {
  const createClass = async (who: Person) =>
    (
      await request(app)
        .post('/api/classes')
        .set('Authorization', who.auth)
        .send({ name: 'BS Computer Science', program: 'BSCS', term: 'Fall 2026', timeZone: 'UTC' })
        .expect(201)
    ).body as { id: string; joinCode: string };

  it('needs the correct password', async () => {
    const sara = await person('Sara Javed');
    const response = await call(sara, 'delete', '')
      .send({ password: 'wrong password' })
      .expect(400);
    expect(response.body.error.issues[0]).toMatchObject({ path: 'password', code: 'incorrect' });
    expect(await UserModel.exists({ _id: sara.id })).not.toBeNull();
  });

  it('removes the person, their sessions and classes nobody else is in', async () => {
    const sara = await person('Sara Javed');
    const cls = await createClass(sara);
    const response = await call(sara, 'delete', '').send({ password: PASSWORD }).expect(204);
    expect(String(response.headers['set-cookie'])).toMatch(/sabaq_refresh=;/);

    expect(await UserModel.exists({ _id: sara.id })).toBeNull();
    expect(await SessionModel.countDocuments({ userId: sara.id })).toBe(0);
    expect(await MembershipModel.countDocuments({ userId: sara.id })).toBe(0);
    expect((await ClassModel.findById(cls.id))?.archivedAt).toBeInstanceOf(Date);
    await request(app).get('/api/auth/me').set('Authorization', sara.auth).expect(401);
  });

  it('asks the only manager of a class with members to hand it over first', async () => {
    const hamza = await person('Hamza Khan');
    const zara = await person('Zara Ahmed');
    const cls = await createClass(hamza);
    await request(app)
      .post('/api/classes/join')
      .set('Authorization', zara.auth)
      .send({ code: cls.joinCode })
      .expect(201);

    const refused = await call(hamza, 'delete', '').send({ password: PASSWORD }).expect(409);
    expect(refused.body.error).toMatchObject({
      code: 'last_manager',
      issues: [{ path: `classes.${cls.id}`, message: 'BS Computer Science' }],
    });

    await request(app)
      .patch(`/api/classes/${cls.id}/members/${zara.id}`)
      .set('Authorization', hamza.auth)
      .send({ role: 'class_rep' })
      .expect(200);
    await call(hamza, 'delete', '').send({ password: PASSWORD }).expect(204);
    expect((await ClassModel.findById(cls.id))?.archivedAt).toBeNull();
  });

  it('hands study groups to the next member', async () => {
    const hamza = await person('Hamza Khan');
    const zara = await person('Zara Ahmed');
    const ids = [hamza.id, zara.id];
    const group = await StudyGroupModel.create({
      classId: '64b7f0000000000000000001',
      courseId: '64b7f0000000000000000002',
      ownerId: hamza.id,
      memberIds: ids,
      name: 'Exam prep',
      capacity: 4,
      place: { kind: 'online', location: null, url: null },
    });
    const solo = await StudyGroupModel.create({
      classId: '64b7f0000000000000000001',
      courseId: '64b7f0000000000000000002',
      ownerId: hamza.id,
      memberIds: [hamza.id],
      name: 'Just me',
      capacity: 4,
      place: { kind: 'online', location: null, url: null },
    });
    await call(hamza, 'delete', '').send({ password: PASSWORD }).expect(204);
    const after = await StudyGroupModel.findById(group._id);
    expect(String(after?.ownerId)).toBe(zara.id);
    expect(after?.memberIds.map(String)).toEqual([zara.id]);
    expect(await StudyGroupModel.exists({ _id: solo._id })).toBeNull();
  });
});
