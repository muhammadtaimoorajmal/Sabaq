import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { runCheck } from './routes/health.js';
import { startServer } from './server.js';
import { memoryLogger } from './test/helpers.js';

const config = { host: '127.0.0.1', port: 0, shutdownTimeoutMs: 1000 };

describe('startServer', () => {
  it('serves requests, then shuts down once and runs cleanup hooks', async () => {
    const { logger, entries } = memoryLogger();
    const app = express().get('/', (_req, res) => {
      res.send('hello');
    });
    const cleanup = vi.fn(() => Promise.resolve());
    const running = await startServer({ app, config, logger, onShutdown: [cleanup] });

    expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(await (await fetch(running.url)).text()).toBe('hello');

    const first = running.shutdown('SIGTERM');
    expect(running.shutdown('SIGINT')).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(running.server.listening).toBe(false);
    expect(entries.map((entry) => entry.msg)).toEqual(['Shutting down', 'Shutdown complete']);
  });

  it('reports localhost for wildcard hosts', async () => {
    const { logger } = memoryLogger();
    const running = await startServer({
      app: express(),
      config: { ...config, host: '0.0.0.0' },
      logger,
    });
    expect(running.url).toMatch(/^http:\/\/localhost:\d+$/);
    await running.shutdown('test');
  });

  it('closes stuck connections after the timeout and reports an unclean exit', async () => {
    const { logger, entries } = memoryLogger();
    // This route never answers, like a request stuck on a slow dependency.
    const app = express().get('/slow', () => undefined);
    const failing = () => Promise.reject(new Error('disconnect failed'));
    const running = await startServer({
      app,
      config: { ...config, shutdownTimeoutMs: 1000 },
      logger,
      onShutdown: [failing],
    });
    const pending = fetch(`${running.url}/slow`).catch(() => 'aborted');
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(running.shutdown('SIGTERM')).resolves.toBe(false);
    expect(await pending).toBe('aborted');
    const messages = entries.map((entry) => entry.msg);
    expect(messages).toContain('Closing connections forcibly');
    expect(messages).toContain('Shutdown step failed');
  });

  it('rejects when the port is already taken', async () => {
    const { logger } = memoryLogger();
    const first = await startServer({ app: express(), config, logger });
    const port = Number(new URL(first.url).port);
    await expect(
      startServer({ app: express(), config: { ...config, port }, logger }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await first.shutdown('test');
  });
});

describe('runCheck', () => {
  it('marks a check that takes too long as down', async () => {
    const outcome = await runCheck({
      name: 'slow',
      check: () => new Promise((resolve) => setTimeout(resolve, 500)),
      timeoutMs: 20,
    });
    expect(outcome.result.status).toBe('down');
    expect(outcome.error).toBeInstanceOf(Error);
  });
});
