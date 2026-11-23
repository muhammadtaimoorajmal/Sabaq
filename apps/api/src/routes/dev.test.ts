import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createMailer } from '../mail/mailer.js';
import { MemoryMailer, memoryLogger, testConfig } from '../test/helpers.js';

describe('development mailbox', () => {
  it('lists sent e-mails, filtered by recipient', async () => {
    const { logger } = memoryLogger();
    const config = testConfig();
    const mailer = createMailer(config, logger);
    const app = createApp({ config, logger, mailer });
    await mailer.send({ to: 'zara@example.com', subject: 'One', text: 'a', html: 'a' });
    await mailer.send({ to: 'ali@example.com', subject: 'Two', text: 'b', html: 'b' });

    const all = await request(app).get('/api/dev/mail').expect(200);
    expect(all.body.map((m: { subject: string }) => m.subject)).toEqual(['Two', 'One']);
    const filtered = await request(app).get('/api/dev/mail?to=ZARA@example.com').expect(200);
    expect(filtered.body).toHaveLength(1);
  });

  it('is never available in production or when e-mail is really sent', async () => {
    const { logger } = memoryLogger();
    const production = testConfig({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost/x',
      JWT_SECRET: 'production-secret-that-is-long-enough-123',
      SMTP_HOST: 'smtp.example.com',
    });
    const outboxMailer = { send: () => Promise.resolve(), outbox: [] };
    await request(createApp({ config: production, logger, mailer: outboxMailer }))
      .get('/api/dev/mail')
      .expect(404);
    await request(createApp({ config: testConfig(), logger, mailer: new MemoryMailer() }))
      .get('/api/dev/mail')
      .expect(404);
  });
});
