import { describe, expect, it, vi } from 'vitest';
import { memoryLogger } from '../test/helpers.js';
import { createMailer, OUTBOX_SIZE } from './mailer.js';
import { renderEmail } from './templates.js';

const message = { to: 'zara@example.com', subject: 'Hello', text: 'Plain', html: '<p>Rich</p>' };

describe('createMailer', () => {
  it('writes e-mails to the log when no SMTP server is configured', async () => {
    const { logger, entries } = memoryLogger();
    await createMailer({ mail: { from: 'Sabaq <a@b.c>', smtp: null } }, logger).send(message);
    expect(entries[0]).toMatchObject({
      msg: 'E-mail written to the log (no SMTP server)',
      mail: { to: 'zara@example.com', subject: 'Hello', text: 'Plain' },
    });
  });

  it('sends through SMTP with the configured sender and credentials', async () => {
    const sendMail = vi.fn(() => Promise.resolve({}));
    const createTransport = vi.fn(() => ({ sendMail }));
    const mailer = createMailer(
      {
        mail: {
          from: 'Sabaq <no-reply@sabaq.example>',
          smtp: { host: 'smtp-relay.example', port: 587, user: 'apikey', pass: 'secret' },
        },
      },
      memoryLogger().logger,
      createTransport as never,
    );
    await mailer.send(message);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp-relay.example',
      port: 587,
      secure: false,
      auth: { user: 'apikey', pass: 'secret' },
    });
    expect(sendMail).toHaveBeenCalledWith({ from: 'Sabaq <no-reply@sabaq.example>', ...message });
  });

  it('uses TLS from the start on port 465 and supports servers without authentication', () => {
    const createTransport = vi.fn(() => ({ sendMail: vi.fn() }));
    createMailer(
      {
        mail: { from: 'a@b.c', smtp: { host: 'mail.example', port: 465, user: null, pass: null } },
      },
      memoryLogger().logger,
      createTransport as never,
    );
    expect(createTransport).toHaveBeenCalledWith({ host: 'mail.example', port: 465, secure: true });
  });
});

describe('renderEmail', () => {
  const link = 'https://sabaq.example.com/verify-email#token=abc';

  it('writes English e-mails with the link in text and HTML', () => {
    const email = renderEmail('verify_email', {
      to: 'z@example.com',
      name: 'Zara',
      link,
      language: 'en',
    });
    expect(email.subject).toBe('Confirm your e-mail address for Sabaq');
    expect(email.text).toContain('Hello Zara,');
    expect(email.text).toContain(link);
    expect(email.html).toContain('<html lang="en" dir="ltr">');
    expect(email.html).toContain(`href="${link}"`);
  });

  it('writes Urdu e-mails right to left', () => {
    const email = renderEmail('reset_password', {
      to: 'z@example.com',
      name: 'زارا',
      link,
      language: 'ur',
    });
    expect(email.subject).toBe('اپنا سبق پاس ورڈ دوبارہ ترتیب دیں');
    expect(email.html).toContain('<html lang="ur" dir="rtl">');
    expect(email.text).toContain('السلام علیکم زارا،');
  });

  it('escapes names so they cannot inject markup', () => {
    const email = renderEmail('password_changed', {
      to: 'z@example.com',
      name: '<script>alert("x")</script> & Co',
      link,
      language: 'en',
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co');
  });
});

describe('development outbox', () => {
  it('keeps the newest messages first, up to a limit, only without SMTP', async () => {
    const mailer = createMailer({ mail: { from: 'a@b.c', smtp: null } }, memoryLogger().logger);
    for (let index = 0; index < OUTBOX_SIZE + 5; index += 1) {
      await mailer.send({ ...message, subject: `Message ${index}` });
    }
    expect(mailer.outbox).toHaveLength(OUTBOX_SIZE);
    expect(mailer.outbox?.[0]).toMatchObject({
      to: 'zara@example.com',
      subject: `Message ${OUTBOX_SIZE + 4}`,
    });
    expect(mailer.outbox?.[0]).not.toHaveProperty('html');

    const smtp = createMailer(
      { mail: { from: 'a@b.c', smtp: { host: 'h', port: 587, user: null, pass: null } } },
      memoryLogger().logger,
      (() => ({ sendMail: vi.fn() })) as never,
    );
    expect(smtp.outbox).toBeUndefined();
  });
});
