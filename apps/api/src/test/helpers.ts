import { Writable } from 'node:stream';
import { pino, type Logger } from 'pino';
import { loadConfig, type Config } from '../config/env.js';
import type { MailMessage, Mailer } from '../mail/mailer.js';

/** A valid test configuration; individual tests override only what they exercise. */
export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({ NODE_ENV: 'test', ...env });
}

/** A logger that keeps every entry in memory so tests can assert on what was logged. */
export function memoryLogger(): { logger: Logger; entries: Record<string, unknown>[] } {
  const entries: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      entries.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { logger: pino({ level: 'trace' }, stream), entries };
}

/** A mailer that keeps messages in memory instead of sending them. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  send = (message: MailMessage): Promise<void> => {
    this.sent.push(message);
    return Promise.resolve();
  };

  /** The token inside the link of the latest message to `to`. */
  lastToken(to: string): string {
    const message = this.sent.filter((item) => item.to === to).at(-1);
    const token = /#token=([\w-]{43})/.exec(message?.text ?? '')?.[1];
    if (!token) throw new Error(`No e-mail with a link was sent to ${to}`);
    return token;
  }
}
