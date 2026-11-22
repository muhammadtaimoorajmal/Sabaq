import { describe, expect, it } from 'vitest';
import { ConfigError, isOrigin, loadConfig } from './env.js';

describe('loadConfig', () => {
  it('applies safe development defaults', () => {
    const config = loadConfig({});
    expect(config).toEqual({
      env: 'development',
      isProduction: false,
      host: '0.0.0.0',
      port: 4000,
      logLevel: 'debug',
      corsOrigins: [],
      trustProxy: 0,
      rateLimit: { windowMs: 900_000, max: 300 },
      bodyLimit: '100kb',
      shutdownTimeoutMs: 10_000,
      version: 'dev',
      database: { uri: null, name: 'sabaq' },
      appUrl: 'http://localhost:5173',
      auth: {
        jwtSecret: expect.stringMatching(/^[\w-]{43}$/),
        accessTokenTtlSeconds: 900,
        refreshTokenTtlDays: 30,
        rateLimitMax: 20,
      },
      mail: { from: 'Sabaq <no-reply@sabaq.local>', smtp: null },
    });
    // A fresh random signing secret on every start outside production.
    expect(loadConfig({}).auth.jwtSecret).not.toBe(config.auth.jwtSecret);
  });

  it('reads production settings and trusts one proxy by default', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '10000',
      CORS_ORIGINS: ' https://sabaq.example.com/ , http://localhost:5173',
      RENDER_GIT_COMMIT: '93917a8c0ffee',
      MONGODB_URI: 'mongodb+srv://app:secret@cluster0.example.mongodb.net/',
      MONGODB_DB_NAME: 'sabaq_demo',
      APP_URL: 'https://sabaq.example.com',
      JWT_SECRET: 'production-secret-that-is-long-enough-123',
      SMTP_HOST: 'smtp-relay.example.com',
      SMTP_USER: 'apikey',
      SMTP_PASS: 'smtp-secret',
      MAIL_FROM: 'Sabaq <no-reply@sabaq.example.com>',
    });
    expect(config).toMatchObject({
      appUrl: 'https://sabaq.example.com',
      auth: { jwtSecret: 'production-secret-that-is-long-enough-123' },
      mail: {
        from: 'Sabaq <no-reply@sabaq.example.com>',
        smtp: { host: 'smtp-relay.example.com', port: 587, user: 'apikey', pass: 'smtp-secret' },
      },
      database: {
        uri: 'mongodb+srv://app:secret@cluster0.example.mongodb.net/',
        name: 'sabaq_demo',
      },
      isProduction: true,
      port: 10_000,
      logLevel: 'info',
      corsOrigins: ['https://sabaq.example.com', 'http://localhost:5173'],
      trustProxy: 1,
      version: '93917a8',
    });
  });

  it('prefers explicit values and treats empty strings as unset', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      TRUST_PROXY: '2',
      APP_VERSION: '1.2.3',
      RENDER_GIT_COMMIT: 'abcdef123',
      PORT: '',
    });
    expect(config).toMatchObject({ logLevel: 'warn', trustProxy: 2, version: '1.2.3', port: 4000 });
    expect(loadConfig({ NODE_ENV: 'test' }).logLevel).toBe('silent');
  });

  it('reports every problem at once, naming each variable', () => {
    let error: unknown;
    try {
      loadConfig({ PORT: '70000', NODE_ENV: 'staging', CORS_ORIGINS: 'example.com' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const { problems, message } = error as ConfigError;
    expect(problems).toHaveLength(3);
    expect(problems.map((problem) => problem.split(':')[0])).toEqual([
      'NODE_ENV',
      'PORT',
      'CORS_ORIGINS.0',
    ]);
    expect(message).toContain('"example.com" is not an origin');
    expect(message.startsWith('Invalid configuration:\n  - ')).toBe(true);
  });
});

describe('database settings', () => {
  it('require a database, a signing secret and a mail server in production', () => {
    let error: unknown;
    try {
      loadConfig({ NODE_ENV: 'production' });
    } catch (caught) {
      error = caught;
    }
    expect((error as ConfigError).problems).toEqual([
      'MONGODB_URI: is required in production',
      'JWT_SECRET: is required in production',
      'SMTP_HOST: is required in production',
    ]);
  });

  it('reject short signing secrets and malformed web app addresses', () => {
    let error: unknown;
    try {
      loadConfig({ JWT_SECRET: 'short', APP_URL: 'sabaq.example.com' });
    } catch (caught) {
      error = caught;
    }
    expect((error as ConfigError).problems).toEqual([
      'APP_URL: must be the web app address, such as https://sabaq.example.com',
      'JWT_SECRET: must be at least 32 characters long',
    ]);
  });

  it('reject malformed connection strings and database names', () => {
    let error: unknown;
    try {
      loadConfig({ MONGODB_URI: 'postgres://db', MONGODB_DB_NAME: 'my db' });
    } catch (caught) {
      error = caught;
    }
    expect((error as ConfigError).problems).toEqual([
      'MONGODB_URI: must start with mongodb:// or mongodb+srv://',
      'MONGODB_DB_NAME: use up to 38 letters, numbers, dashes or underscores',
    ]);
  });
});

describe('isOrigin', () => {
  it.each([
    ['https://app.example.com', true],
    ['http://localhost:5173', true],
    ['https://app.example.com/path', false],
    ['ftp://example.com', false],
    ['not a url', false],
  ])('%s -> %s', (value, expected) => {
    expect(isOrigin(value)).toBe(expected);
  });
});
