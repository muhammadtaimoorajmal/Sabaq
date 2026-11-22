import { apiErrorSchema, healthSchema, readinessSchema } from '@sabaq/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { memoryLogger, testConfig } from './test/helpers.js';

function makeApp(env: Record<string, string> = {}) {
  const { logger, entries } = memoryLogger();
  return { app: createApp({ config: testConfig(env), logger }), entries };
}

describe('health', () => {
  it('reports liveness in the shared contract shape, without caching', async () => {
    const { app } = makeApp({ APP_VERSION: '0.5.0' });
    const response = await request(app).get('/api/health').expect(200);
    expect(healthSchema.parse(response.body)).toMatchObject({ status: 'ok', version: '0.5.0' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('reports readiness of every dependency', async () => {
    const { logger } = memoryLogger();
    const config = testConfig();
    const up = createApp({
      config,
      logger,
      healthChecks: [{ name: 'database', check: () => Promise.resolve() }],
    });
    const ready = await request(up).get('/api/health/ready').expect(200);
    expect(readinessSchema.parse(ready.body)).toMatchObject({
      status: 'ready',
      checks: { database: { status: 'up' } },
    });

    const down = createApp({
      config,
      logger,
      healthChecks: [
        { name: 'database', check: () => Promise.reject(new Error('connection refused')) },
        { name: 'mail', check: () => Promise.resolve() },
      ],
    });
    const notReady = await request(down).get('/api/health/ready').expect(503);
    expect(notReady.body).toMatchObject({
      status: 'not_ready',
      checks: { database: { status: 'down' }, mail: { status: 'up' } },
    });
  });

  it('is ready when there are no dependencies yet', async () => {
    const { app } = makeApp();
    await request(app).get('/api/health/ready').expect(200, { status: 'ready', checks: {} });
  });

  it('introduces itself at the root', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/').expect(200);
    expect(response.body).toEqual({ name: 'Sabaq API', version: 'dev', health: '/api/health' });
  });
});

describe('request IDs and logging', () => {
  it('generates an ID, returns it and puts it in error bodies', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/nope').expect(404);
    const id = response.headers['x-request-id'];
    expect(id).toMatch(/^[\da-f-]{36}$/);
    expect(apiErrorSchema.parse(response.body).error.requestId).toBe(id);
  });

  it('keeps a well-formed incoming ID and replaces an unsafe one', async () => {
    const { app } = makeApp();
    const kept = await request(app).get('/api/health').set('X-Request-Id', 'proxy-123');
    expect(kept.headers['x-request-id']).toBe('proxy-123');
    const replaced = await request(app).get('/api/health').set('X-Request-Id', 'bad id\twith tab');
    expect(replaced.headers['x-request-id']).not.toBe('bad id\twith tab');
  });

  it('logs requests with their level, but not health checks or secrets', async () => {
    const { app, entries } = makeApp();
    await request(app).get('/api/health');
    await request(app).get('/api/missing?token=abc').set('Cookie', 'session=secret');
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry).toMatchObject({
      level: 40,
      req: { method: 'GET', path: '/api/missing' },
      res: { statusCode: 404 },
    });
    expect(JSON.stringify(entry)).not.toContain('session=secret');
    expect(JSON.stringify(entry)).not.toContain('token=abc');
  });
});

describe('errors', () => {
  it('answers unknown routes with not_found', async () => {
    const { app } = makeApp();
    const response = await request(app).post('/api/unknown').expect(404);
    expect(response.body.error).toMatchObject({
      code: 'not_found',
      message: 'No route matches POST /api/unknown.',
    });
  });

  it('rejects malformed JSON', async () => {
    const { app } = makeApp();
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_json');
  });

  it('rejects bodies over the size limit', async () => {
    const { app } = makeApp();
    const response = await request(app)
      .post('/api/health')
      .send({ text: 'x'.repeat(110 * 1024) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('payload_too_large');
  });
});

describe('security', () => {
  it('sends hardened headers and hides the framework', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
  });

  it('allows credentialed requests only from listed origins', async () => {
    const { app } = makeApp({ CORS_ORIGINS: 'https://sabaq.example.com' });
    const allowed = await request(app)
      .options('/api/health')
      .set('Origin', 'https://sabaq.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://sabaq.example.com');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limits the API with a clear error, but never the health check', async () => {
    const { app } = makeApp({ RATE_LIMIT_MAX: '2' });
    await request(app).get('/api').expect(200);
    await request(app).get('/api').expect(200);
    const limited = await request(app).get('/api').expect(429);
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers.ratelimit).toBeDefined();
    await request(app).get('/api/health').expect(200);
  });
});
