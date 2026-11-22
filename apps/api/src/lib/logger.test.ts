import { describe, expect, it } from 'vitest';
import { createLogger, loggerOptions } from './logger.js';

describe('logger', () => {
  it('writes JSON with service details and redacts secrets', () => {
    const lines: string[] = [];
    const logger = createLogger(
      { env: 'production', logLevel: 'info', version: '1.0.0' },
      { write: (line: string) => lines.push(line) },
    );
    logger.info(
      { user: { email: 'ali@example.com', password: 'hunter2' }, body: { token: 'abc' } },
      'signed in',
    );
    logger.debug('not at info level');

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: 30,
      service: 'sabaq-api',
      version: '1.0.0',
      msg: 'signed in',
      user: { email: 'ali@example.com', password: '[redacted]' },
      body: { token: '[redacted]' },
    });
  });

  it('pretty-prints only during development', () => {
    expect(loggerOptions({ env: 'development', logLevel: 'debug', version: 'dev' })).toHaveProperty(
      'transport.target',
      'pino-pretty',
    );
    expect(
      loggerOptions({ env: 'production', logLevel: 'info', version: 'dev' }),
    ).not.toHaveProperty('transport');
  });

  it('logs to standard output when no destination is given', () => {
    const logger = createLogger({ env: 'test', logLevel: 'silent', version: 'dev' });
    expect(logger.level).toBe('silent');
  });
});
